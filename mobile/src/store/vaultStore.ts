import { create } from 'zustand';
import axios from 'axios';
import { API_URL, DEVICE_ID_KEY } from '../config';
import { SecureStorageService } from '../services/secureStorage';
import { encrypt, decrypt } from '@password-manager/crypto-engine';
import type { DerivedKey, VaultEntry, EncryptedVault } from '@password-manager/crypto-engine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Our vault on the server stores an array of entries encrypted as a single JSON blob
export interface VaultEntryLocal extends VaultEntry {
    id: string;
    url: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
    reminderSnoozeUntil?: string;
}

interface ServerVaultRecord {
    ciphertext: string;
    iv: string;
    salt: string;
    tag?: string;
    authTag?: string;
    version?: number;
    timestamp?: number;
    nonce?: string;
    algorithm: 'AES-256-GCM';
    derivationAlgorithm: 'Argon2id';
}

interface SyncConflictState {
    serverEntries: VaultEntryLocal[];
    localEntries: VaultEntryLocal[];
    serverBlob: ServerVaultRecord;
    localBlob: ServerVaultRecord;
    serverTimestamp: number;
}

interface VaultState {
    entries: VaultEntryLocal[];
    isLoading: boolean;
    isSyncing: boolean;
    error: string | null;
    lastSyncTime: number | null;
    version: number;
    pendingSyncCount: number;
    syncConflict: SyncConflictState | null;

    loadVault: (derivedKey: DerivedKey, userId: string) => Promise<void>;
    addEntry: (entry: Omit<VaultEntryLocal, 'id' | 'createdAt' | 'updatedAt'>, derivedKey: DerivedKey, userId: string) => Promise<void>;
    updateEntry: (entry: VaultEntryLocal, derivedKey: DerivedKey, userId: string) => Promise<void>;
    deleteEntry: (id: string, derivedKey: DerivedKey, userId: string) => Promise<void>;
    snoozeEntry: (id: string, derivedKey: DerivedKey, userId: string) => Promise<void>;
    getDeviceIdForSync: () => Promise<string>;
    flushSyncQueue: (derivedKey: DerivedKey, userId: string) => Promise<void>;
    resolveSyncConflict: (choice: 'local' | 'server' | 'merge', derivedKey: DerivedKey, userId: string, conflictOverride?: SyncConflictState) => Promise<boolean>;
    clearVault: () => void;
}

async function getDeviceId(): Promise<string> {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = uuidv4();
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

async function getAuthHeaders() {
    const token = await SecureStorageService.getSessionId();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function normalizeEntry(raw: any): VaultEntryLocal | null {
    const siteName = String(raw?.siteName || raw?.site || "");
    if (siteName === "VAULT_ROOT" || siteName === "SYSTEM" || siteName === "SYSTEM_SHARING_KEYS") {
        return null;
    }

    return {
        id: String(raw?.id || uuidv4()),
        url: String(raw?.url || raw?.siteUrl || raw?.siteName || raw?.site || 'Unknown'),
        username: String(raw?.username || ''),
        password: String(raw?.password || ''),
        notes: String(raw?.notes || ''),
        createdAt: raw?.createdAt ? String(raw.createdAt) : new Date().toISOString(),
        updatedAt: raw?.updatedAt
            ? String(raw.updatedAt)
            : raw?.lastUpdated
                ? String(raw.lastUpdated)
                : new Date().toISOString(),
        reminderSnoozeUntil: raw?.reminderSnoozeUntil ? String(raw.reminderSnoozeUntil) : '',
    };
}

function toStorageFormat(entry: VaultEntryLocal): Record<string, string> {
    return {
        id: entry.id,
        siteName: entry.url,
        siteUrl: entry.url,
        username: entry.username,
        password: entry.password,
        notes: entry.notes || '',
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || new Date().toISOString(),
        reminderSnoozeUntil: entry.reminderSnoozeUntil || '',
    };
}

function mergeEntries(local: VaultEntryLocal[], server: VaultEntryLocal[]): VaultEntryLocal[] {
    const mergedMap = new Map<string, VaultEntryLocal>();

    // Add all local entries
    local.forEach((e) => mergedMap.set(e.id, e));

    // Add or merge server entries
    server.forEach((s) => {
        const existing = mergedMap.get(s.id);
        if (!existing) {
            // New from server
            mergedMap.set(s.id, s);
        } else {
            // Both have it, compare updatedAt
            const localTs = new Date(existing.updatedAt || 0).getTime();
            const serverTs = new Date(s.updatedAt || 0).getTime();
            if (serverTs > localTs) {
                mergedMap.set(s.id, s);
            }
        }
    });

    return Array.from(mergedMap.values());
}

// Serialize entries array to an encrypted blob using the derived key.
async function encryptEntries(entries: VaultEntryLocal[], derivedKey: DerivedKey): Promise<ServerVaultRecord> {
    const transportEntries = entries.map(toStorageFormat);
    
    // Re-add sharing keys if they exist in SecureStorage (Parity with web)
    const pub = await SecureStorageService.getItem("share_public_key_spki");
    const priv = await SecureStorageService.getItem("share_private_key_pkcs8");
    const sPub = await SecureStorageService.getItem("share_sign_public_key_spki");
    const sPriv = await SecureStorageService.getItem("share_sign_private_key_pkcs8");

    if (pub && priv && sPub && sPriv) {
        transportEntries.push({
            id: "system-sharing-keys",
            siteName: "SYSTEM_SHARING_KEYS",
            siteUrl: "system-sharing-keys",
            username: "system",
            password: "system-sharing-keys",
            notes: "Auto-synced sharing keys",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reminderSnoozeUntil: "",
            publicKey: pub,
            privateKey: priv,
            signingPublicKey: sPub,
            signingPrivateKey: sPriv
        } as any);
    }

    const serialized: VaultEntry = {
        url: 'VAULT_ROOT',
        username: 'SYSTEM',
        password: JSON.stringify(transportEntries),
    };
    const encrypted = await encrypt(serialized, derivedKey);
    return encrypted as ServerVaultRecord;
}

// Decrypt blob to entries array.
async function decryptEntries(record: ServerVaultRecord, derivedKey: DerivedKey): Promise<VaultEntryLocal[]> {
    const normalized: EncryptedVault = {
        ciphertext: record.ciphertext,
        iv: record.iv,
        salt: record.salt,
        tag: record.tag || record.authTag || '',
        algorithm: 'AES-256-GCM',
        derivationAlgorithm: 'Argon2id',
    };

    const decrypted = await decrypt(normalized, derivedKey);
    let rawEntries: any[] = [];

    if (decrypted.metadata?.isVaultBlob && typeof decrypted.password === 'string') {
        rawEntries = JSON.parse(decrypted.password);
    } else if (
        decrypted.url === 'VAULT_ROOT' &&
        decrypted.username === 'SYSTEM' &&
        typeof decrypted.password === 'string'
    ) {
        rawEntries = JSON.parse(decrypted.password);
    } else {
        // Single entry or unknown format
        rawEntries = [decrypted];
    }

    if (!Array.isArray(rawEntries)) rawEntries = [rawEntries];

    // Extract sharing keys fromraw entries if present (Parity with web)
    const sharingKeysEntry = rawEntries.find(e => e.siteName === "SYSTEM_SHARING_KEYS");
    if (sharingKeysEntry) {
        console.log('[Sync] Found persisted sharing keys in blob, restoring...');
        if (sharingKeysEntry.publicKey) await SecureStorageService.saveItem("share_public_key_spki", sharingKeysEntry.publicKey);
        if (sharingKeysEntry.privateKey) await SecureStorageService.saveItem("share_private_key_pkcs8", sharingKeysEntry.privateKey);
        if (sharingKeysEntry.signingPublicKey) await SecureStorageService.saveItem("share_sign_public_key_spki", sharingKeysEntry.signingPublicKey);
        if (sharingKeysEntry.signingPrivateKey) await SecureStorageService.saveItem("share_sign_private_key_pkcs8", sharingKeysEntry.signingPrivateKey);
    }

    return rawEntries
        .map(normalizeEntry)
        .filter((e): e is VaultEntryLocal => e !== null);
}

async function pullVaults(userId: string, version: number, lastSyncTime: number | null): Promise<{ vaults: any[]; currentVersion: number }> {
    const headers = await getAuthHeaders();
    const deviceId = await getDeviceId();
    // Use -1 for first sync so legacy records with version 0 are not skipped.
    const effectiveLastVersion = version > 0 ? version : -1;
    const effectiveLastTimestamp = lastSyncTime && lastSyncTime > 0 ? lastSyncTime : undefined;
    console.log('[Sync] Pull request', { userId, deviceId, lastVersion: effectiveLastVersion, lastTimestamp: effectiveLastTimestamp });
    const res = await axios.post(
        `${API_URL}/sync/pull`,
        { userId, deviceId, lastVersion: effectiveLastVersion, lastTimestamp: effectiveLastTimestamp },
        { headers },
    );
    console.log('[Sync] Pull response', {
        status: res.status,
        vaultCount: res.data?.vaults?.length || 0,
        currentVersion: res.data?.currentVersion || 0,
    });
    return { vaults: res.data.vaults || [], currentVersion: res.data.currentVersion || 0 };
}

async function pullCompatibilityVault(userId: string): Promise<ServerVaultRecord | null> {
    const headers = await getAuthHeaders();
    console.log('[Sync] Compatibility pull request', { userId });
    const res = await axios.get(`${API_URL}/api/vault/${encodeURIComponent(userId)}`, { headers });
    const data = res.data;

    const candidates = [
        data,
        data?.data,
        data?.encryptedVault,
        data?.vault,
        data?.payload,
        data?.data?.encryptedVault,
        data?.data?.vault,
    ].filter(Boolean);

    const payload =
        candidates.find(
            (c) =>
                typeof c?.ciphertext === 'string' &&
                typeof c?.iv === 'string' &&
                typeof c?.salt === 'string',
        ) || null;

    console.log('[Sync] Compatibility payload keys', payload ? Object.keys(payload) : []);

    if (!payload || !payload.ciphertext) {
        console.log('[Sync] Compatibility pull empty');
        return null;
    }

    const compatRecord: ServerVaultRecord = {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        salt: payload.salt,
        tag: payload.tag || payload.authTag,
        authTag: payload.authTag || payload.tag,
        algorithm: 'AES-256-GCM',
        derivationAlgorithm: 'Argon2id',
        version: payload.version,
        timestamp: payload.timestamp,
        nonce: payload.nonce,
    };

    console.log('[Sync] Compatibility pull hit', {
        ciphertextLength: compatRecord.ciphertext?.length || 0,
        hasTag: !!(compatRecord.tag || compatRecord.authTag),
    });
    return compatRecord;
}

async function pushVault(userId: string, record: ServerVaultRecord, version: number, baseTimestamp?: number): Promise<void> {
    const headers = await getAuthHeaders();
    const deviceId = await getDeviceId();
    console.log('[Sync] Push request', {
        userId,
        deviceId,
        version,
        ciphertextLength: record.ciphertext?.length || 0,
    });
    await axios.post(
        `${API_URL}/sync/push`,
        {
            userId,
            deviceId,
            vault: {
                ciphertext: record.ciphertext,
                iv: record.iv,
                salt: record.salt,
                authTag: record.tag || record.authTag,
                version,
                timestamp: Date.now(),
                nonce: uuidv4(),
            },
            baseTimestamp,
        },
        { headers },
    );
    console.log('[Sync] Push success', { userId, deviceId, version });
}

interface OfflineQueueItem {
    id: string;
    userId: string;
    version: number;
    createdAt: number;
    vault: ServerVaultRecord;
}

interface LocalVaultSnapshot {
    entries: VaultEntryLocal[];
    version: number;
    lastSyncTime: number | null;
    updatedAt: number;
}

const OFFLINE_QUEUE_PREFIX = 'vault_offline_queue:';
const LOCAL_SNAPSHOT_PREFIX = 'vault_local_snapshot:';

function queueKey(userId: string): string {
    return `${OFFLINE_QUEUE_PREFIX}${userId}`;
}

function snapshotKey(userId: string): string {
    return `${LOCAL_SNAPSHOT_PREFIX}${userId}`;
}

function isOfflineLikeError(error: any): boolean {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    return (
        !error?.response ||
        code === 'ECONNABORTED' ||
        /network error/i.test(message) ||
        /timeout/i.test(message)
    );
}

async function readQueue(userId: string): Promise<OfflineQueueItem[]> {
    try {
        const raw = await AsyncStorage.getItem(queueKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeQueue(userId: string, queue: OfflineQueueItem[]): Promise<void> {
    await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

async function enqueueSync(userId: string, version: number, vault: ServerVaultRecord): Promise<number> {
    const queue = await readQueue(userId);
    queue.push({
        id: uuidv4(),
        userId,
        version,
        createdAt: Date.now(),
        vault,
    });
    await writeQueue(userId, queue);
    return queue.length;
}

async function persistSnapshot(userId: string, snapshot: LocalVaultSnapshot): Promise<void> {
    await AsyncStorage.setItem(snapshotKey(userId), JSON.stringify(snapshot));
}

async function loadSnapshot(userId: string): Promise<LocalVaultSnapshot | null> {
    try {
        const raw = await AsyncStorage.getItem(snapshotKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.entries)) return null;
        return parsed as LocalVaultSnapshot;
    } catch {
        return null;
    }
}

async function drainQueue(userId: string): Promise<number> {
    let queue = await readQueue(userId);
    if (queue.length === 0) return 0;

    const remaining: OfflineQueueItem[] = [];
    for (const item of queue) {
        try {
            await pushVault(userId, item.vault, item.version);
        } catch (error) {
            remaining.push(item);
            if (isOfflineLikeError(error)) {
                remaining.push(...queue.slice(queue.indexOf(item) + 1));
                break;
            }
        }
    }

    await writeQueue(userId, remaining);
    return remaining.length;
}

export const useVaultStore = create<VaultState>((set, get) => ({
    entries: [],
    isLoading: false,
    isSyncing: false,
    error: null,
    lastSyncTime: null,
    version: 0,
    pendingSyncCount: 0,
    syncConflict: null,

    loadVault: async (derivedKey, userId) => {
        set({ error: null });

        // --- Step 1: Show cached entries instantly (no spinner) ---
        const cached = await loadSnapshot(userId);
        if (cached) {
            set({
                entries: cached.entries,
                version: Math.max(get().version, cached.version || 0),
                lastSyncTime: cached.lastSyncTime || get().lastSyncTime,
                isLoading: false,   // Already have data — no blocking spinner
                isSyncing: true,    // Show a non-blocking sync indicator instead
            });
        } else {
            // No cache yet (first launch) — show full-screen loader
            set({ isLoading: true, isSyncing: false });
        }

        // --- Step 2: Pull from server in background ---
        try {
            const { vaults, currentVersion } = await pullVaults(userId, get().version, get().lastSyncTime);
            let latest: ServerVaultRecord | null = null;

            if (vaults.length > 0) {
                latest = vaults[0] as ServerVaultRecord;
            } else {
                console.log('[Sync] No sync vaults returned, trying compatibility fallback');
                latest = await pullCompatibilityVault(userId);
            }

            if (!latest) {
                console.log('[Sync] No vault data available from sync or compatibility store');
                set({ isLoading: false, isSyncing: false });
                return;
            }

            const entries = await decryptEntries(latest, derivedKey);
            const resolvedVersion = Math.max(currentVersion || 0, latest.version || 0, get().version);
            console.log('[Sync] Vault decrypted', {
                entries: entries.length,
                localVersion: get().version,
                serverVersion: resolvedVersion,
            });
            const now = Date.now();
            await persistSnapshot(userId, {
                entries,
                version: resolvedVersion,
                lastSyncTime: now,
                updatedAt: now,
            });
            const pending = await drainQueue(userId);
            set({ entries, version: resolvedVersion, lastSyncTime: now, pendingSyncCount: pending, syncConflict: null, isLoading: false, isSyncing: false });
        } catch (e: any) {
            console.error('[Sync] Load failed', e?.response?.data || e?.message || e);
            const pending = (await readQueue(userId)).length;
            set({
                isLoading: false,
                isSyncing: false,
                pendingSyncCount: pending,
                // Don't show an error if we had cached data and it's just a network glitch
                error: (cached && isOfflineLikeError(e)) ? null : (e.message || 'Failed to load vault'),
            });
        }
    },

    addEntry: async (data, derivedKey, userId) => {
        const newEntry: VaultEntryLocal = {
            ...data,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const newEntries = [...get().entries, newEntry];
        set({ entries: newEntries, isSyncing: true });
        try {
            const encrypted = await encryptEntries(newEntries, derivedKey);
            const nextVersion = get().version + 1;
            const now = Date.now();
            await persistSnapshot(userId, { entries: newEntries, version: nextVersion, lastSyncTime: now, updatedAt: now });
            try {
                await pushVault(userId, encrypted, nextVersion, get().lastSyncTime || undefined);
                const pending = await drainQueue(userId);
                console.log('[Sync] Add entry synced', { nextVersion, totalEntries: newEntries.length });
                set({ version: nextVersion, lastSyncTime: now, pendingSyncCount: pending, syncConflict: null, isSyncing: false });
            } catch (syncError: any) {
                if (syncError?.response?.status === 409 && syncError?.response?.data?.conflict) {
                    const conflict = syncError.response.data.conflict;
                    const serverBlob: ServerVaultRecord = {
                        ciphertext: conflict.latestServerBlob.ciphertext,
                        iv: conflict.latestServerBlob.iv,
                        salt: conflict.latestServerBlob.salt,
                        tag: conflict.latestServerBlob.tag || conflict.latestServerBlob.authTag,
                        authTag: conflict.latestServerBlob.authTag || conflict.latestServerBlob.tag,
                        algorithm: 'AES-256-GCM',
                        derivationAlgorithm: 'Argon2id',
                        version: conflict.latestServerBlob.version,
                        timestamp: conflict.latestServerBlob.timestamp,
                        nonce: conflict.latestServerBlob.nonce,
                    };
                    const serverEntries = await decryptEntries(serverBlob, derivedKey);
                    const conflictData = {
                        serverEntries,
                        localEntries: newEntries,
                        serverBlob,
                        localBlob: encrypted,
                        serverTimestamp: Number(conflict.latestServerTimestamp || 0),
                    };
                    set({ syncConflict: conflictData });
                    await get().resolveSyncConflict('merge', derivedKey, userId, conflictData);
                    return;
                }
                const pending = await enqueueSync(userId, nextVersion, encrypted);
                console.warn('[Sync] Add entry queued for later sync', { nextVersion, pending });
                set({
                    version: nextVersion,
                    lastSyncTime: now,
                    pendingSyncCount: pending,
                    error: isOfflineLikeError(syncError) ? null : syncError?.message,
                    isSyncing: false,
                });
            }
        } catch (e: any) {
            console.error('[Sync] Add entry failed', e?.response?.data || e?.message || e);
            set({ error: e.message, isSyncing: false });
        }
    },

    updateEntry: async (entry, derivedKey, userId) => {
        const newEntries = get().entries.map((e) => (e.id === entry.id ? { ...entry, updatedAt: new Date().toISOString() } : e));
        set({ entries: newEntries, isSyncing: true });
        try {
            const encrypted = await encryptEntries(newEntries, derivedKey);
            const nextVersion = get().version + 1;
            const now = Date.now();
            await persistSnapshot(userId, { entries: newEntries, version: nextVersion, lastSyncTime: now, updatedAt: now });
            try {
                await pushVault(userId, encrypted, nextVersion, get().lastSyncTime || undefined);
                const pending = await drainQueue(userId);
                console.log('[Sync] Update entry synced', { entryId: entry.id, nextVersion });
                set({ version: nextVersion, lastSyncTime: now, pendingSyncCount: pending, syncConflict: null, isSyncing: false });
            } catch (syncError: any) {
                if (syncError?.response?.status === 409 && syncError?.response?.data?.conflict) {
                    const conflict = syncError.response.data.conflict;
                    const serverBlob: ServerVaultRecord = {
                        ciphertext: conflict.latestServerBlob.ciphertext,
                        iv: conflict.latestServerBlob.iv,
                        salt: conflict.latestServerBlob.salt,
                        tag: conflict.latestServerBlob.tag || conflict.latestServerBlob.authTag,
                        authTag: conflict.latestServerBlob.authTag || conflict.latestServerBlob.tag,
                        algorithm: 'AES-256-GCM',
                        derivationAlgorithm: 'Argon2id',
                        version: conflict.latestServerBlob.version,
                        timestamp: conflict.latestServerBlob.timestamp,
                        nonce: conflict.latestServerBlob.nonce,
                    };
                    const serverEntries = await decryptEntries(serverBlob, derivedKey);
                    const conflictData = {
                        serverEntries,
                        localEntries: newEntries,
                        serverBlob,
                        localBlob: encrypted,
                        serverTimestamp: Number(conflict.latestServerTimestamp || 0),
                    };
                    set({ syncConflict: conflictData });
                    await get().resolveSyncConflict('merge', derivedKey, userId, conflictData);
                    return;
                }
                const pending = await enqueueSync(userId, nextVersion, encrypted);
                console.warn('[Sync] Update entry queued for later sync', { entryId: entry.id, nextVersion, pending });
                set({
                    version: nextVersion,
                    lastSyncTime: now,
                    pendingSyncCount: pending,
                    error: isOfflineLikeError(syncError) ? null : syncError?.message,
                    isSyncing: false,
                });
            }
        } catch (e: any) {
            console.error('[Sync] Update entry failed', e?.response?.data || e?.message || e);
            set({ error: e.message, isSyncing: false });
        }
    },

    deleteEntry: async (id, derivedKey, userId) => {
        const newEntries = get().entries.filter((e) => e.id !== id);
        set({ entries: newEntries, isSyncing: true });
        try {
            const encrypted = await encryptEntries(newEntries, derivedKey);
            const nextVersion = get().version + 1;
            const now = Date.now();
            await persistSnapshot(userId, { entries: newEntries, version: nextVersion, lastSyncTime: now, updatedAt: now });
            try {
                await pushVault(userId, encrypted, nextVersion, get().lastSyncTime || undefined);
                const pending = await drainQueue(userId);
                console.log('[Sync] Delete entry synced', { entryId: id, nextVersion });
                set({ version: nextVersion, lastSyncTime: now, pendingSyncCount: pending, syncConflict: null, isSyncing: false });
            } catch (syncError: any) {
                if (syncError?.response?.status === 409 && syncError?.response?.data?.conflict) {
                    const conflict = syncError.response.data.conflict;
                    const serverBlob: ServerVaultRecord = {
                        ciphertext: conflict.latestServerBlob.ciphertext,
                        iv: conflict.latestServerBlob.iv,
                        salt: conflict.latestServerBlob.salt,
                        tag: conflict.latestServerBlob.tag || conflict.latestServerBlob.authTag,
                        authTag: conflict.latestServerBlob.authTag || conflict.latestServerBlob.tag,
                        algorithm: 'AES-256-GCM',
                        derivationAlgorithm: 'Argon2id',
                        version: conflict.latestServerBlob.version,
                        timestamp: conflict.latestServerBlob.timestamp,
                        nonce: conflict.latestServerBlob.nonce,
                    };
                    const serverEntries = await decryptEntries(serverBlob, derivedKey);
                    const conflictData = {
                        serverEntries,
                        localEntries: newEntries,
                        serverBlob,
                        localBlob: encrypted,
                        serverTimestamp: Number(conflict.latestServerTimestamp || 0),
                    };
                    set({ syncConflict: conflictData });
                    await get().resolveSyncConflict('merge', derivedKey, userId, conflictData);
                    return;
                }
                const pending = await enqueueSync(userId, nextVersion, encrypted);
                console.warn('[Sync] Delete entry queued for later sync', { entryId: id, nextVersion, pending });
                set({
                    version: nextVersion,
                    lastSyncTime: now,
                    pendingSyncCount: pending,
                    error: isOfflineLikeError(syncError) ? null : syncError?.message,
                    isSyncing: false,
                });
            }
        } catch (e: any) {
            console.error('[Sync] Delete entry failed', e?.response?.data || e?.message || e);
            set({ error: e.message, isSyncing: false });
        }
    },

    snoozeEntry: async (id, derivedKey, userId) => {
        const snoozeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const newEntries = get().entries.map((e) => (e.id === id ? { ...e, reminderSnoozeUntil: snoozeUntil } : e));
        set({ entries: newEntries, isSyncing: true });
        try {
            const encrypted = await encryptEntries(newEntries, derivedKey);
            const nextVersion = get().version + 1;
            const now = Date.now();
            await persistSnapshot(userId, { entries: newEntries, version: nextVersion, lastSyncTime: now, updatedAt: now });
            try {
                await pushVault(userId, encrypted, nextVersion, get().lastSyncTime || undefined);
                const pending = await drainQueue(userId);
                set({ version: nextVersion, lastSyncTime: now, pendingSyncCount: pending, syncConflict: null, isSyncing: false });
            } catch (syncError: any) {
                const pending = await enqueueSync(userId, nextVersion, encrypted);
                set({
                    version: nextVersion,
                    lastSyncTime: now,
                    pendingSyncCount: pending,
                    error: isOfflineLikeError(syncError) ? null : syncError?.message,
                    isSyncing: false,
                });
            }
        } catch (e: any) {
            console.error('[Sync] Snooze entry failed', e?.response?.data || e?.message || e);
            set({ error: e.message, isSyncing: false });
        }
    },

    getDeviceIdForSync: async () => {
        return getDeviceId();
    },

    flushSyncQueue: async (_derivedKey, userId) => {
        set({ isSyncing: true });
        try {
            const pending = await drainQueue(userId);
            set({ pendingSyncCount: pending, isSyncing: false });
        } catch (e: any) {
            set({ error: e?.message || 'Failed to flush sync queue', isSyncing: false });
        }
    },

    resolveSyncConflict: async (choice, derivedKey, userId, conflictOverride) => {
        const conflict = conflictOverride || get().syncConflict;
        if (!conflict) return false;
        try {
            const headers = await getAuthHeaders();
            const deviceId = await getDeviceId();
            
            let chosenBlob: ServerVaultRecord;
            let resolvedEntries: VaultEntryLocal[];

            if (choice === 'merge') {
                resolvedEntries = mergeEntries(conflict.localEntries, conflict.serverEntries);
                chosenBlob = await encryptEntries(resolvedEntries, derivedKey);
            } else {
                chosenBlob = choice === 'local' ? conflict.localBlob : conflict.serverBlob;
                resolvedEntries = choice === 'local' ? conflict.localEntries : conflict.serverEntries;
            }

            const response = await axios.post(
                `${API_URL}/sync/blob/resolve`,
                {
                    userId,
                    deviceId,
                    chosenBlob: {
                        ciphertext: chosenBlob.ciphertext,
                        iv: chosenBlob.iv,
                        salt: chosenBlob.salt,
                        authTag: chosenBlob.authTag || chosenBlob.tag,
                    },
                    expectedServerTimestamp: conflict.serverTimestamp,
                },
                { headers },
            );

            const resolvedVersion = Number(response.data?.resolvedVersion || get().version + 1);
            const resolvedTimestamp = Number(response.data?.resolvedTimestamp || Date.now());
            await persistSnapshot(userId, {
                entries: resolvedEntries,
                version: resolvedVersion,
                lastSyncTime: resolvedTimestamp,
                updatedAt: Date.now(),
            });

            // If we merged, update Compatibility API (parity with web)
            if (choice === 'merge') {
                try {
                    const transportEntries = resolvedEntries.map(toStorageFormat);
                    const serialized = {
                        url: 'VAULT_ROOT',
                        username: 'SYSTEM',
                        password: JSON.stringify(transportEntries),
                    };
                    const encryptedVault = await encrypt(serialized, derivedKey);
                    const labels = resolvedEntries.map((e) => e.url.toLowerCase());
                    await axios.put(`${API_URL}/api/vault/${encodeURIComponent(userId)}`, 
                        { encryptedVault, labels },
                        { headers }
                    );
                } catch (compatErr) {
                    console.warn('[Sync] Post-merge compatibility sync failed', compatErr);
                }
            }

            set({
                entries: resolvedEntries,
                version: resolvedVersion,
                lastSyncTime: resolvedTimestamp,
                syncConflict: null,
                error: null,
            });
            return true;
        } catch (e: any) {
            set({ error: e?.response?.data?.message || e?.message || 'Failed to resolve conflict' });
            return false;
        }
    },

    clearVault: () => set({ entries: [], version: 0, lastSyncTime: null, pendingSyncCount: 0, syncConflict: null }),
}));
