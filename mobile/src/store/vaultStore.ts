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
    createdAt?: string;
    updatedAt?: string;
}

interface ServerVaultRecord {
    ciphertext: string;
    iv: string;
    salt: string;
    tag?: string;
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
    deleteEntry: (id: string, derivedKey: DerivedKey, userId: string) => Promise<void>;
    clearVault: () => void;
}

async function getDeviceId(): Promise<string> {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = uuidv4(); await AsyncStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
}

async function getAuthHeaders() {
    const token = await SecureStorageService.getSessionId();
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

/** Serialize entries array → encrypted blob using derive key */
async function encryptEntries(entries: VaultEntryLocal[], derivedKey: DerivedKey): Promise<ServerVaultRecord> {
    const serialized: VaultEntry = {
        site: '__vault__',
        username: '__vault__',
        password: JSON.stringify(entries), // Pack all entries into password field
        metadata: { isVaultBlob: true },
    };
    const encrypted = await encrypt(serialized, derivedKey);
    return encrypted as ServerVaultRecord;
}

/** Decrypt blob → entries array */
async function decryptEntries(record: ServerVaultRecord, derivedKey: DerivedKey): Promise<VaultEntryLocal[]> {
    const decrypted = await decrypt(record as EncryptedVault, derivedKey);
    if (decrypted.metadata?.isVaultBlob && typeof decrypted.password === 'string') {
        return JSON.parse(decrypted.password) as VaultEntryLocal[];
    }
    // Legacy: single entry
    return [{ ...decrypted, id: uuidv4() }];
}

async function pullVaults(userId: string, version: number): Promise<{ vaults: any[]; currentVersion: number }> {
    const headers = await getAuthHeaders();
    const deviceId = await getDeviceId();
    const res = await axios.post(`${API_URL}/sync/pull`, { userId, deviceId, lastVersion: version }, { headers });
    return { vaults: res.data.vaults || [], currentVersion: res.data.currentVersion || 0 };
}

async function pushVault(userId: string, record: ServerVaultRecord, version: number): Promise<void> {
    const headers = await getAuthHeaders();
    const deviceId = await getDeviceId();
    await axios.post(`${API_URL}/sync/push`, {
        userId,
        deviceId,
        vault: {
            ...record,
            version,
        },
    }, { headers });
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
            const { vaults, currentVersion } = await pullVaults(userId, get().version);
            if (vaults.length === 0) { set({ isLoading: false }); return; }
            const latest = vaults[vaults.length - 1];
            const entries = await decryptEntries(latest, derivedKey);
            set({ entries, version: currentVersion, lastSyncTime: Date.now(), isLoading: false });
        } catch (e: any) {
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
            set({ version: nextVersion, lastSyncTime: Date.now(), isSyncing: false });
        } catch (e: any) {
            set({ error: e.message, isSyncing: false });
        }
    },

    deleteEntry: async (id, derivedKey, userId) => {
        const newEntries = get().entries.filter(e => e.id !== id);
        set({ entries: newEntries, isSyncing: true });
        try {
            const encrypted = await encryptEntries(newEntries, derivedKey);
            const nextVersion = get().version + 1;
            await pushVault(userId, encrypted, nextVersion);
            set({ version: nextVersion, lastSyncTime: Date.now(), isSyncing: false });
        } catch (e: any) {
            set({ error: e.message, isSyncing: false });
        }
    },

    clearVault: () => set({ entries: [], version: 0, lastSyncTime: null }),
}));
