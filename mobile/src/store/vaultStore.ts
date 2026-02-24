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
    siteUrl?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
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

interface VaultState {
    entries: VaultEntryLocal[];
    isLoading: boolean;
    isSyncing: boolean;
    error: string | null;
    lastSyncTime: number | null;
    version: number;

    loadVault: (derivedKey: DerivedKey, userId: string) => Promise<void>;
    addEntry: (entry: Omit<VaultEntryLocal, 'id' | 'createdAt' | 'updatedAt'>, derivedKey: DerivedKey, userId: string) => Promise<void>;
    updateEntry: (entry: VaultEntryLocal, derivedKey: DerivedKey, userId: string) => Promise<void>;
    deleteEntry: (id: string, derivedKey: DerivedKey, userId: string) => Promise<void>;
    getDeviceIdForSync: () => Promise<string>;
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

function normalizeEntry(raw: any): VaultEntryLocal {
    return {
        id: String(raw?.id || uuidv4()),
        site: String(raw?.site || raw?.siteName || 'Unknown'),
        siteUrl: String(raw?.siteUrl || raw?.url || ''),
        username: String(raw?.username || ''),
        password: String(raw?.password || ''),
        notes: String(raw?.notes || ''),
        createdAt: raw?.createdAt ? String(raw.createdAt) : new Date().toISOString(),
        updatedAt: raw?.updatedAt
            ? String(raw.updatedAt)
            : raw?.lastUpdated
                ? String(raw.lastUpdated)
                : new Date().toISOString(),
    };
}

function toStorageFormat(entry: VaultEntryLocal): Record<string, string> {
    return {
        id: entry.id,
        siteName: entry.site,
        siteUrl: entry.siteUrl || '',
        username: entry.username,
        password: entry.password,
        notes: entry.notes || '',
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || new Date().toISOString(),
        reminderSnoozeUntil: '',
    };
}

// Serialize entries array to an encrypted blob using the derived key.
async function encryptEntries(entries: VaultEntryLocal[], derivedKey: DerivedKey): Promise<ServerVaultRecord> {
    const serialized: VaultEntry = {
        site: '__vault__',
        username: '__vault__',
        password: JSON.stringify(entries.map(toStorageFormat)),
        metadata: { isVaultBlob: true },
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
    if (!normalized.tag) {
        // Legacy compatibility: some old payloads append the GCM tag to ciphertext.
        // The shared crypto engine supports this mode when tag is omitted.
        console.log('[Sync] Decrypting legacy payload without explicit auth tag');
    }

    const decrypted = await decrypt(normalized, derivedKey);
    if (decrypted.metadata?.isVaultBlob && typeof decrypted.password === 'string') {
        const parsed = JSON.parse(decrypted.password);
        if (Array.isArray(parsed)) {
            return parsed.map(normalizeEntry);
        }
        return [normalizeEntry(parsed)];
    }

    // Compatibility: web dashboard stores a VAULT_ROOT wrapper without metadata.
    if (
        typeof decrypted.site === 'string' &&
        decrypted.site === 'VAULT_ROOT' &&
        typeof decrypted.username === 'string' &&
        decrypted.username === 'SYSTEM' &&
        typeof decrypted.password === 'string'
    ) {
        try {
            const parsed = JSON.parse(decrypted.password);
            if (Array.isArray(parsed)) {
                return parsed.map(normalizeEntry);
            }
            if (parsed && typeof parsed === 'object') {
                return [normalizeEntry(parsed)];
            }
        } catch (e) {
            console.warn('[Sync] Failed to parse VAULT_ROOT payload, falling back to single entry', e);
        }
    }

    // Legacy: single entry
    return [normalizeEntry(decrypted)];
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

async function pushVault(userId: string, record: ServerVaultRecord, version: number): Promise<void> {
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
        },
        { headers },
    );
    console.log('[Sync] Push success', { userId, deviceId, version });
}

export const useVaultStore = create<VaultState>((set, get) => ({
    entries: [],
    isLoading: false,
    isSyncing: false,
    error: null,
    lastSyncTime: null,
    version: 0,

    loadVault: async (derivedKey, userId) => {
        set({ isLoading: true, error: null });
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
                set({ isLoading: false });
                return;
            }

            const entries = await decryptEntries(latest, derivedKey);
            const resolvedVersion = Math.max(currentVersion || 0, latest.version || 0, get().version);
            console.log('[Sync] Vault decrypted', {
                entries: entries.length,
                localVersion: get().version,
                serverVersion: resolvedVersion,
            });
            set({ entries, version: resolvedVersion, lastSyncTime: Date.now(), isLoading: false });
        } catch (e: any) {
            console.error('[Sync] Load failed', e?.response?.data || e?.message || e);
            set({ error: e.message || 'Failed to load vault', isLoading: false });
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
            await pushVault(userId, encrypted, nextVersion);
            console.log('[Sync] Add entry synced', { nextVersion, totalEntries: newEntries.length });
            set({ version: nextVersion, lastSyncTime: Date.now(), isSyncing: false });
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
            await pushVault(userId, encrypted, nextVersion);
            console.log('[Sync] Update entry synced', { entryId: entry.id, nextVersion });
            set({ version: nextVersion, lastSyncTime: Date.now(), isSyncing: false });
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
            await pushVault(userId, encrypted, nextVersion);
            console.log('[Sync] Delete entry synced', { entryId: id, nextVersion });
            set({ version: nextVersion, lastSyncTime: Date.now(), isSyncing: false });
        } catch (e: any) {
            console.error('[Sync] Delete entry failed', e?.response?.data || e?.message || e);
            set({ error: e.message, isSyncing: false });
        }
    },

    getDeviceIdForSync: async () => {
        return getDeviceId();
    },

    clearVault: () => set({ entries: [], version: 0, lastSyncTime: null }),
}));
