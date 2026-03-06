"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { deriveKey, decrypt, DerivedKey, EncryptedVault } from "@password-manager/crypto-engine"; // Using crypto-engine directly
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api-base-url";

const WEB_SYNC_INTERVAL_MS = 3 * 60 * 1000;
const LAST_SYNC_TS_KEY_PREFIX = "vault_last_sync_ts:";
const WEB_OFFLINE_QUEUE_KEY_PREFIX = "vault_offline_sync_queue:";
const WEB_LOCAL_BLOB_PREFIX = "vault_local_blob:";

const getSyncTsKey = (userId: string) => `${LAST_SYNC_TS_KEY_PREFIX}${userId}`;
const getOfflineQueueKey = (userId: string) => `${WEB_OFFLINE_QUEUE_KEY_PREFIX}${userId}`;
// Sharing Key Storage Keys (must match shareCrypto.ts)
// Sharing Key Storage Keys (prefixed by userId in shareCrypto.ts)
const getPrivateKeyKey = (userId?: string) => userId ? `share_private_key_pkcs8_${userId}` : "share_private_key_pkcs8"
const getPublicKeyKey = (userId?: string) => userId ? `share_public_key_spki_${userId}` : "share_public_key_spki"
const getSignPrivateKeyKey = (userId?: string) => userId ? `share_sign_private_key_pkcs8_${userId}` : "share_sign_private_key_pkcs8"
const getSignPublicKeyKey = (userId?: string) => userId ? `share_sign_public_key_spki_${userId}` : "share_sign_public_key_spki"

// Define the DecryptedEntry type
export interface DecryptedEntry {
    id: string;
    url: string;
    username: string;
    password: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
    lastUpdated: string;
    reminderSnoozeUntil?: string;
    isPasswordVisible: boolean;
}

interface VaultContextType {
    decryptedEntries: DecryptedEntry[];
    setDecryptedEntries: React.Dispatch<React.SetStateAction<DecryptedEntry[]>>;
    derivedKeys: DerivedKey | null;
    isLoadingVault: boolean;
    isUnlocked: boolean;
    unlockVault: () => Promise<void>;
    addEntry: (entryCtx: { username: string; password: string; url: string; notes: string }) => Promise<void>;
    updateEntry: (entry: DecryptedEntry) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    snoozeEntry: (id: string) => Promise<void>;
    setEntryLastUpdated: (id: string, isoDate: string) => Promise<void>;
    syncNow: () => Promise<boolean>;
    isSyncing: boolean;
    lastSyncedAt: number | null;
    syncError: string | null;
    pendingSyncCount: number;
    syncConflict: SyncConflictState | null;
    resolveSyncConflict: (choice: "local" | "server") => Promise<boolean>;
    incomingShares: any[];
    refreshIncoming: () => Promise<void>;
    acceptShare: (shareId: string) => Promise<void>;
    rejectShare: (shareId: string) => Promise<void>;
    sendShare: (entry: DecryptedEntry, recipientEmail: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

interface StorageVaultEntry {
    id: string;
    siteName: string;
    siteUrl: string;
    username: string;
    password: string;
    notes: string;
    createdAt: string;
    updatedAt: string;
    reminderSnoozeUntil: string;
}

interface SyncBlobPayload {
    ciphertext: string;
    iv: string;
    salt: string;
    authTag?: string;
    tag?: string;
    version?: number;
    timestamp?: number;
    nonce?: string;
}

interface OfflineQueueItem {
    id: string;
    userId: string;
    deviceId: string;
    createdAt: number;
    blob: SyncBlobPayload;
}

interface SyncConflictState {
    serverEntries: DecryptedEntry[];
    localEntries: DecryptedEntry[];
    serverBlob: SyncBlobPayload;
    localBlob: SyncBlobPayload;
    serverTimestamp: number;
}

function parseHexToBytes(hex: string, fieldName: string): Uint8Array {
    const chunks = hex.match(/.{1,2}/g);
    if (!chunks) {
        throw new Error(`Invalid ${fieldName} format`);
    }
    return new Uint8Array(chunks.map((byte) => parseInt(byte, 16)));
}

/**
 * Helper function to convert DecryptedEntry to storage format
 * Normalizes field names to use siteName and siteUrl for storage
 */
function toStorageFormat(entry: DecryptedEntry): StorageVaultEntry {
    return {
        id: entry.id,
        siteName: entry.url,
        siteUrl: entry.url,
        username: entry.username,
        password: entry.password,
        notes: entry.notes,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt || entry.lastUpdated || new Date().toISOString(),
        reminderSnoozeUntil: entry.reminderSnoozeUntil || "",
    };
}

export function VaultProvider({ children }: { children: ReactNode }) {
    const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>([]);
    const [derivedKeys, setDerivedKeys] = useState<DerivedKey | null>(null);
    const [isLoadingVault, setIsLoadingVault] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [syncConflict, setSyncConflict] = useState<SyncConflictState | null>(null);
    const [incomingShares, setIncomingShares] = useState<any[]>([]);
    const [isRefreshingShares, setIsRefreshingShares] = useState(false);
    const sharingRegisteredRef = useRef(false);
    const [hasSharingKeysInVault, setHasSharingKeysInVault] = useState(false);
    const syncInFlightRef = useRef(false);
    const [session] = useVaultSync();

    const getLocalBlobKey = React.useCallback((userId: string) => `${WEB_LOCAL_BLOB_PREFIX}${userId}`, []);

    const readOfflineQueue = React.useCallback((userId: string): OfflineQueueItem[] => {
        if (typeof window === "undefined") return [];
        try {
            const raw = localStorage.getItem(getOfflineQueueKey(userId));
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, []);

    const writeOfflineQueue = React.useCallback((userId: string, queue: OfflineQueueItem[]) => {
        if (typeof window === "undefined") return;
        localStorage.setItem(getOfflineQueueKey(userId), JSON.stringify(queue));
        setPendingSyncCount(queue.length);
    }, []);

    const enqueueOfflineSync = React.useCallback((item: Omit<OfflineQueueItem, "id" | "createdAt">) => {
        const queue = readOfflineQueue(item.userId);
        queue.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: Date.now(),
            ...item,
        });
        writeOfflineQueue(item.userId, queue);
    }, [readOfflineQueue, writeOfflineQueue]);

    const drainOfflineQueue = React.useCallback(async (): Promise<number> => {
        const userId = (session.userId || localStorage.getItem("user_id") || "").trim();
        if (!userId) return 0;

        const queue = readOfflineQueue(userId);
        if (queue.length === 0) {
            setPendingSyncCount(0);
            return 0;
        }

        const remaining: OfflineQueueItem[] = [];
        for (const item of queue) {
            const token = localStorage.getItem("auth_token");
            if (!token) {
                remaining.push(item);
                continue;
            }
            try {
                const syncResponse = await fetch(buildApiUrl("/sync/blob/push"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        userId: item.userId,
                        deviceId: item.deviceId,
                        blob: item.blob,
                    }),
                });
                if (!syncResponse.ok) {
                    remaining.push(item);
                    if (syncResponse.status >= 500) {
                        remaining.push(...queue.slice(queue.indexOf(item) + 1));
                        break;
                    }
                }
            } catch {
                remaining.push(item);
                remaining.push(...queue.slice(queue.indexOf(item) + 1));
                break;
            }
        }

        writeOfflineQueue(userId, remaining);
        return remaining.length;
    }, [readOfflineQueue, writeOfflineQueue, session.userId]);

    const parseDecryptedEntries = React.useCallback((decryptedEntry: unknown): DecryptedEntry[] => {
        let entries: Array<Record<string, unknown>> = [];
        if (Array.isArray(decryptedEntry)) {
            entries = decryptedEntry as Array<Record<string, unknown>>;
        } else if (decryptedEntry && typeof decryptedEntry === "object") {
            const decryptedObject = decryptedEntry as Record<string, unknown>;
            if (typeof decryptedObject.password === "string") {
                try {
                    const parsed = JSON.parse(decryptedObject.password);
                    if (Array.isArray(parsed)) {
                        entries = parsed as Array<Record<string, unknown>>;
                    }
                } catch (parseErr) {
                    console.error("[VaultContext] Failed to parse vault entries:", parseErr);
                }
            }

            if (entries.length === 0) {
                const possibleArrays = Object.values(decryptedObject).filter((val) => Array.isArray(val));
                if (possibleArrays.length > 0) {
                    entries = possibleArrays[0] as Array<Record<string, unknown>>;
                } else if (decryptedObject.site || decryptedObject.siteName) {
                    entries = [decryptedObject];
                }
            }
        }

        return entries
            .filter((entry) => {
                const siteName = String(entry.siteName || entry.site || "");
                return siteName !== "VAULT_ROOT" && siteName !== "SYSTEM" && siteName !== "SYSTEM_SHARING_KEYS";
            })
            .map((entry) => ({
                id: String(entry.id || Math.random().toString(36).substring(7)),
                url: String(entry.siteUrl || entry.url || entry.siteName || entry.site || "Unknown"), // fallback chain
                username: String(entry.username || ""),
                password: String(entry.password || ""),
                notes: String(entry.notes || ""),
                createdAt: String(entry.createdAt || new Date().toISOString()),
                updatedAt: String(entry.updatedAt || entry.lastUpdated || new Date().toISOString()),
                lastUpdated: String(entry.updatedAt || entry.lastUpdated || new Date().toISOString()),
                reminderSnoozeUntil: String(entry.reminderSnoozeUntil || ""),
                isPasswordVisible: false,
            }));
    }, []);

    const restoreSharingKeys = React.useCallback((entries: Array<Record<string, any>>, userId?: string): boolean => {
        const sharingKeysEntry = entries.find(e => e.siteName === "SYSTEM_SHARING_KEYS");
        if (sharingKeysEntry) {
            console.log("[VaultContext] Found persisted sharing keys, restoring to localStorage...");
            const pk = getPrivateKeyKey(userId);
            const pub = getPublicKeyKey(userId);
            const sPk = getSignPrivateKeyKey(userId);
            const sPub = getSignPublicKeyKey(userId);

            if (sharingKeysEntry.publicKey) localStorage.setItem(pub, sharingKeysEntry.publicKey);
            if (sharingKeysEntry.privateKey) localStorage.setItem(pk, sharingKeysEntry.privateKey);
            if (sharingKeysEntry.signingPublicKey) localStorage.setItem(sPub, sharingKeysEntry.signingPublicKey);
            if (sharingKeysEntry.signingPrivateKey) localStorage.setItem(sPk, sharingKeysEntry.signingPrivateKey);
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const userId = (session.userId || localStorage.getItem("user_id") || "").trim();
        if (!userId) return;
        
        const saved = Number(localStorage.getItem(getSyncTsKey(userId)) || "0");
        if (saved > 0) {
            setLastSyncedAt(saved);
        }
        setPendingSyncCount(readOfflineQueue(userId).length);
    }, [session.userId, readOfflineQueue]);

    // Cleanup on logout
    useEffect(() => {
        if (!session.isAuthenticated) {
            setIsUnlocked(false);
            setDecryptedEntries([]);
            setDerivedKeys(null);
            setHasSharingKeysInVault(false);
            setSyncConflict(null);
            setLastSyncedAt(0);
            sharingRegisteredRef.current = false;
        }
    }, [session.isAuthenticated]);

    const unlockVault = React.useCallback(async () => {
        // If already unlocked and we have data, don't reload unless forced
        if (isUnlocked && decryptedEntries.length > 0) {
            setIsLoadingVault(false);
            return;
        }

        setIsLoadingVault(true);
        try {
            const hasToken = typeof window !== 'undefined' && localStorage.getItem("auth_token");
            if (!hasToken) {
                setIsLoadingVault(false);
                return;
            }

            // 1. Ensure we have the master password (from temp storage or state)
            const sessionPassword = sessionStorage.getItem("session_master_password");

            if (!sessionPassword) {
                // Not an error, just means we can't auto-unlock
                console.log('[VaultContext] No session password found, cannot auto-unlock');
                setIsLoadingVault(false);
                return;
            }

            // 2. Derive encryption key locally
            const salt = localStorage.getItem("user_salt");
            if (!salt) {
                console.error("[VaultContext] No salt found");
                setIsLoadingVault(false);
                return;
            }

            const saltBuffer = parseHexToBytes(salt, "salt");

            // Read the Argon2 params saved during login/registration.
            // These MUST match the params used when the vault was first encrypted.
            // Using different params (e.g. default 8192 instead of 128) produces
            // a completely different AES key → GHASH (auth tag) failure on decrypt.
            const argon2Memory = Number(localStorage.getItem("argon2_memory") || "128");
            const argon2Iterations = Number(localStorage.getItem("argon2_iterations") || "1");

            // Start parallel execution: Key Derivation (CPU) + Vault Fetch (Network)
            console.log(`[VaultContext] Starting parallel unlock (m=${argon2Memory} KB, t=${argon2Iterations})...`);

            const keyDerivationPromise = deriveKey(sessionPassword, saltBuffer, {
                memorySize: argon2Memory,
                iterations: argon2Iterations,
            });

            // Fetch vault
            const vaultFetchPromise = (async () => {
                 const userId = session.userId || localStorage.getItem("user_id") || "";
                 const token = localStorage.getItem("auth_token");
                 
                 // 1. Try blob mailbox API first.
                 if (userId && token) {
                     try {
                         const blobResponse = await fetch(buildApiUrl("/sync/blob/pull"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                userId,
                                // Force latest blob retrieval on unlock.
                                lastKnownTimestamp: 0,
                            })
                         });
                         
                         if (blobResponse.ok) {
                             const blobData = await blobResponse.json();
                             if (blobData?.blob?.ciphertext) {
                                 return { ok: true, status: 200, json: async () => blobData.blob };
                             }
                             if (blobData?.hasUpdate === false) {
                                 return { ok: true, status: 200, json: async () => null };
                             }
                         } else if (blobResponse.status === 401) {
                             console.warn("[VaultContext] Blob pull auth failed, trying fallback APIs");
                         } else {
                             console.warn("[VaultContext] Blob pull failed with status", blobResponse.status);
                         }
                     } catch (err) {
                         console.warn("[VaultContext] Blob pull failed, trying fallback APIs", err);
                     }
                 }

                 // 2. Try legacy sync API fallback.
                 if (userId && token) {
                     try {
                         const syncResponse = await fetch(buildApiUrl("/sync/pull"), {
                             method: "POST",
                             headers: {
                                 "Content-Type": "application/json",
                                 "Authorization": `Bearer ${token}`
                             },
                             body: JSON.stringify({
                                 userId,
                                 deviceId: "web-dashboard"
                             })
                         });

                         if (syncResponse.ok) {
                             const syncData = await syncResponse.json();
                             if (syncData?.vaults?.length > 0 && syncData.vaults[0]?.ciphertext) {
                                 return { ok: true, status: 200, json: async () => syncData.vaults[0] };
                             }
                             console.log("[VaultContext] Sync API empty, trying compatibility API");
                         } else {
                             console.warn("[VaultContext] Sync API failed with status", syncResponse.status);
                         }
                     } catch (err) {
                         console.warn("[VaultContext] Sync API failed, trying compatibility API", err);
                     }
                 }

                 // 3. Fallback to Compatibility API
                 if (!userId) throw new Error("No user ID found");
                 let response: Response;
                 try {
                    response = await fetch(buildApiUrl(`/api/vault/${encodeURIComponent(userId)}`), {
                        method: "GET",
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        cache: "no-store"
                    });
                 } catch {
                    const cachedRaw = localStorage.getItem(getLocalBlobKey(userId));
                    if (cachedRaw) {
                        try {
                            const cachedBlob = JSON.parse(cachedRaw);
                            if (cachedBlob?.ciphertext) {
                                console.log("[VaultContext] Loaded vault from local offline cache");
                                return { ok: true, status: 200, json: async () => cachedBlob };
                            }
                        } catch {
                            // no-op
                        }
                    }
                    throw new Error("Network unavailable and no local vault cache found");
                 }
                
                console.log("[VaultContext] Compatibility API status:", response.status);
                if (response.ok) {
                    const data = await response.json();
                    
                    // Robust validation of compatibility API response
                    if (!data || typeof data !== "object") {
                        throw new Error("Invalid response from vault API: Expected object");
                    }
                    
                    if (!("ciphertext" in data) && !("vaults" in data)) {
                         console.warn("[VaultContext] Response object missing expected vault fields");
                    }
                    
                    console.log("[VaultContext] Compatibility API data retrieved successfully");
                    return { ok: true, status: 200, json: async () => data };
                }
                
                return response;
            })();

            const [keys, fetchResult] = await Promise.all([keyDerivationPromise, vaultFetchPromise]);
            
            if (fetchResult.ok) {
                const data = await fetchResult.json();
                
                 // Handle empty vault (null data or no ciphertext)
                 if (!data || !data.ciphertext) {
                      console.log("[VaultContext] No vault data found (empty vault or new user)");
                      setDerivedKeys(keys);
                      setDecryptedEntries([]);
                      setIsUnlocked(true);
                      setIsLoadingVault(false);
                      return;
                 }
                
                 if (data && data.ciphertext) {
                    // Standardize data tags (sync uses authTag, extension uses tag)
                    const vaultData: EncryptedVault = {
                        ciphertext: data.ciphertext,
                        iv: data.iv,
                        salt: data.salt,
                        tag: data.authTag || data.tag,
                        algorithm: "AES-256-GCM" as const,
                        derivationAlgorithm: "Argon2id" as const,
                    };

                    // Use the already-derived `keys` (from the parallel key derivation above).
                    // IMPORTANT: Do NOT call decryptVault(password, ...) here — that function
                    // re-derives the Argon2 key using default params (8192 KB memory), which
                    // won't match the key used at registration (128 KB). This mismatch was the
                    // root cause of persistent decryption failure even with the correct password.
                    let decryptedEntry: unknown;
                    try {
                        console.log("[VaultContext] Attempting decryption with derived keys...");
                        decryptedEntry = await decrypt(vaultData, keys);
                        console.log("[VaultContext] Decryption succeeded");
                    } catch (decryptErr) {
                        console.error("[VaultContext] Decryption failed:", decryptErr);
                        // Clear stale local cache so next load starts fresh.
                        const resolvedUserId = (session.userId || localStorage.getItem("user_id") || "").trim();
                        if (resolvedUserId) {
                            localStorage.removeItem(getLocalBlobKey(resolvedUserId));
                            console.log("[VaultContext] Cleared stale local vault cache for user", resolvedUserId);
                        }
                        localStorage.removeItem(getSyncTsKey(resolvedUserId));
                        console.log("[VaultContext] Treating as empty vault (cache cleared)");
                        setDerivedKeys(keys);
                        setDecryptedEntries([]);
                        setIsUnlocked(true);
                        setIsLoadingVault(false);
                        return;
                    }


                    setDerivedKeys(keys);

                    const rawEntries = Array.isArray(decryptedEntry) ? decryptedEntry : [];
                    // Restore sharing keys if present in the decrypted vault
                    const keysFound = restoreSharingKeys(rawEntries, session.userId || undefined);
                    setHasSharingKeysInVault(keysFound);

                    // Immediately re-register restored keys with the server
                    // This ensures the server's public key matches our private key
                    if (keysFound) {
                        try {
                            const { ensureShareKeyPair } = await import("@/lib/shareCrypto");
                            const myKeys = await ensureShareKeyPair(session.userId || undefined);
                            const regToken = localStorage.getItem("auth_token");
                            if (regToken) {
                                await fetch(buildApiUrl("/share/public-key"), {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        "Authorization": `Bearer ${regToken}`
                                    },
                                    body: JSON.stringify({
                                        publicKey: myKeys.publicKey,
                                        signingPublicKey: myKeys.signingPublicKey
                                    })
                                });
                                console.log("[VaultContext] Re-registered sharing keys with server after vault restore");
                            }
                        } catch (regErr) {
                            console.warn("[VaultContext] Failed to re-register sharing keys:", regErr);
                        }
                    }

                    const entriesWithVisibility = parseDecryptedEntries(decryptedEntry);

                    setDecryptedEntries(entriesWithVisibility);
                    if (typeof window !== "undefined" && data.timestamp) {
                        const ts = Number(data.timestamp);
                        const resolvedUserId = (session.userId || localStorage.getItem("user_id") || "").trim();
                        localStorage.setItem(getSyncTsKey(resolvedUserId), String(ts));
                        setLastSyncedAt(ts);
                    }
                    const resolvedUserId = (session.userId || localStorage.getItem("user_id") || "").trim();
                    if (typeof window !== "undefined" && resolvedUserId && data?.ciphertext) {
                        localStorage.setItem(getLocalBlobKey(resolvedUserId), JSON.stringify(data));
                    }
                    setIsUnlocked(true);
                    // toast.success(`Vault loaded: ${entriesWithVisibility.length} entries`);
                } else {
                    // No data but successful fetch usually means empty vault for new user
                    console.log("[VaultContext] No vault data found (empty vault)");
                    setDerivedKeys(keys); // Still set keys so we can add entries
                    setIsUnlocked(true);
                }
            } else if (fetchResult.status === 404) {
                // No vault found (new user) - initialize as empty
                console.log("[VaultContext] Vault not found (404), initializing empty vault");
                setDerivedKeys(keys);
                setIsUnlocked(true);
            } else {
                 if (fetchResult.status === 404) {
                     console.log("[VaultContext] Vault not found on server (new user or reset account).");
                     setDerivedKeys(keys);
                     setDecryptedEntries([]);
                     setIsUnlocked(true);
                 } else {
                     console.error("[VaultContext] Failed to fetch vault:", fetchResult.status);                     toast.error(`Failed to load vault (HTTP ${fetchResult.status})`);                 }
            }

        } catch (err) {
            console.error("[VaultContext] Unlock error:", err);
            toast.error(`Vault unlock failed: ${err instanceof Error ? err.message : "Possible network issue or server error"}`);
        } finally {
            setIsLoadingVault(false);
        }
    }, [isUnlocked, decryptedEntries.length, session.userId, parseDecryptedEntries, getLocalBlobKey, restoreSharingKeys]);

    const addEntry = async (entryCtx: { username: string; password: string; url: string; notes: string }) => {
        if (!derivedKeys) {
            toast.error("Encryption key not available");
            return;
        }

        try {
            const entryId = Math.random().toString(36).substring(7);
            const newCredential = {
                id: entryId,
                siteName: entryCtx.url,
                siteUrl: entryCtx.url,
                username: entryCtx.username,
                password: entryCtx.password,
                notes: entryCtx.notes || "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                reminderSnoozeUntil: "",
            };

            const updatedEntries = [
                ...decryptedEntries.map((e) => toStorageFormat(e)),
                newCredential,
            ];

            // Re-encrypt and save
            await saveVault(updatedEntries, derivedKeys);

            // Update local state
            const displayEntry: DecryptedEntry = {
                id: entryId,
                url: entryCtx.url,
                username: entryCtx.username,
                password: entryCtx.password,
                notes: entryCtx.notes,
                createdAt: new Date().toISOString(),
                updatedAt: newCredential.updatedAt,
                lastUpdated: newCredential.updatedAt,
                reminderSnoozeUntil: "",
                isPasswordVisible: false,
            };

            setDecryptedEntries([...decryptedEntries, displayEntry]);
            toast.success("Credential saved successfully!");
        } catch (err) {
            console.error("Add entry error:", err);
            if (err instanceof Error && err.message === "SYNC_CONFLICT_DETECTED") {
                toast.error("Conflict detected. Choose which version to keep.");
            } else {
                toast.error("Unable to save credential at this time");
            }
        }
    };

    const syncNow = React.useCallback(async (): Promise<boolean> => {
        if (syncInFlightRef.current) return false;
        syncInFlightRef.current = true;
        setIsSyncing(true);
        setSyncError(null);

        try {
            const token = localStorage.getItem("auth_token");
            const userId = (session.userId || localStorage.getItem("user_id") || "").trim();
            const sessionPassword = sessionStorage.getItem("session_master_password");
            if (!token || !userId || !sessionPassword || !isUnlocked) {
                return false;
            }
            await drainOfflineQueue();

            const lastKnownTimestamp = Number(localStorage.getItem(getSyncTsKey(userId)) || "0");
            const response = await fetch(buildApiUrl("/sync/blob/pull"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ userId, lastKnownTimestamp }),
            });

            if (!response.ok) {
                setSyncError(`Sync failed (${response.status})`);
                return false;
            }

            const payload = await response.json();
            if (!payload?.hasUpdate || !payload?.blob?.ciphertext) {
                return false;
            }

            const blob = payload.blob;
            const cryptoEngine = await import("@password-manager/crypto-engine");
            const decryptResult = await cryptoEngine.decryptVault(sessionPassword, {
                ciphertext: blob.ciphertext,
                iv: blob.iv,
                salt: blob.salt,
                tag: blob.authTag || blob.tag,
                algorithm: "AES-256-GCM" as const,
                derivationAlgorithm: "Argon2id" as const,
            });
            if (!decryptResult.success || !decryptResult.data) {
                setSyncError("Failed to decrypt synced data");
                return false;
            }

            const nextEntries = parseDecryptedEntries(decryptResult.data);
            setDecryptedEntries(nextEntries);
            const ts = Number(payload.serverTimestamp || blob.timestamp || Date.now());
            localStorage.setItem(getSyncTsKey(userId), String(ts));
            localStorage.setItem(getLocalBlobKey(userId), JSON.stringify(blob));
            setLastSyncedAt(ts);
            return true;
        } catch (err) {
            console.warn("[VaultContext] Background web sync failed", err);
            setSyncError("Sync request failed");
            return false;
        } finally {
            setIsSyncing(false);
            syncInFlightRef.current = false;
        }
    }, [session.userId, isUnlocked, parseDecryptedEntries, drainOfflineQueue, getLocalBlobKey]);

    const updateEntry = async (entry: DecryptedEntry) => {
        if (!derivedKeys) return;

        try {
            const updatedEntries = decryptedEntries.map((e) =>
                e.id === entry.id
                    ? {
                        ...entry,
                        lastUpdated: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    }
                    : e,
            );

            const transportEntries = updatedEntries.map((e) => toStorageFormat(e));

            await saveVault(transportEntries, derivedKeys);
            setDecryptedEntries(updatedEntries);
            toast.success("Credential updated!");
        } catch (err) {
            console.error("Update entry error:", err);
            if (err instanceof Error && err.message === "SYNC_CONFLICT_DETECTED") {
                toast.error("Conflict detected. Choose which version to keep.");
            } else {
                toast.error("Unable to update credential");
            }
        }
    };

    const deleteEntry = async (id: string) => {
        if (!derivedKeys) {
            toast.error("Encryption key not available");
            return;
        }

        try {
            const updatedEntries = decryptedEntries.filter((e) => e.id !== id);
            const transportEntries = updatedEntries.map((e) => toStorageFormat(e));

            await saveVault(transportEntries, derivedKeys);
            setDecryptedEntries(updatedEntries);
            toast.success("Credential deleted!");
        } catch (err) {
            console.error("Delete entry error:", err);
            if (err instanceof Error && err.message === "SYNC_CONFLICT_DETECTED") {
                toast.error("Conflict detected. Choose which version to keep.");
            } else {
                toast.error("Unable to delete credential");
            }
        }
    };

    const snoozeEntry = async (id: string) => {
        if (!derivedKeys) return;

        try {
            const snoozeDuration = 180 * 24 * 60 * 60 * 1000; // 6 months
            const snoozeUntil = new Date(Date.now() + snoozeDuration).toISOString();
            const updatedEntries = decryptedEntries.map((e) =>
                e.id === id
                    ? { ...e, reminderSnoozeUntil: snoozeUntil }
                    : e,
            );

            const transportEntries = updatedEntries.map((e) => toStorageFormat(e));

            await saveVault(transportEntries, derivedKeys);
            setDecryptedEntries(updatedEntries);
            toast.info("Reminder snoozed for 6 months");
        } catch (err) {
            console.error("Snooze entry error:", err);
            toast.error("Unable to snooze reminder");
        }
    };

    const setEntryLastUpdated = async (id: string, isoDate: string) => {
        if (!derivedKeys) return;

        const parsed = new Date(isoDate).toISOString();

        try {
            const updatedEntries = decryptedEntries.map((e) =>
                e.id === id
                    ? { ...e, updatedAt: parsed, lastUpdated: parsed }
                    : e,
            );

            const transportEntries = updatedEntries.map((e) => toStorageFormat(e));

            await saveVault(transportEntries, derivedKeys);
            setDecryptedEntries(updatedEntries);
            toast.info("Last updated date changed");
        } catch (err) {
            console.error("Set lastUpdated error:", err);
            toast.error("Unable to update timestamp");
        }
    };

    // Helper to encrypt and save
    const saveVault = async (entries: StorageVaultEntry[], keys: DerivedKey) => {
        const { encrypt } = await import("@password-manager/crypto-engine");
        const vaultEntry = {
            url: "VAULT_ROOT",
            username: "SYSTEM",
            password: JSON.stringify(entries),
        };

        const updatedEntries = [...entries];
        
        // Include sharing keys in the vault if they exist in localStorage
        const userId = (session.userId || localStorage.getItem("user_id") || "").trim();
        const pub = localStorage.getItem(getPublicKeyKey(userId));
        const priv = localStorage.getItem(getPrivateKeyKey(userId));
        const sPub = localStorage.getItem(getSignPublicKeyKey(userId));
        const sPriv = localStorage.getItem(getSignPrivateKeyKey(userId));

        if (pub && priv && sPub && sPriv) {
            // Remove existing if any
            const filtered = updatedEntries.filter(e => e.siteName !== "SYSTEM_SHARING_KEYS");
            filtered.push({
                id: "system-sharing-keys",
                siteName: "SYSTEM_SHARING_KEYS",
                siteUrl: "system-sharing-keys",
                username: "system",
                password: "system-sharing-keys",
                notes: "Auto-synced sharing keys",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                reminderSnoozeUntil: "",
                // Store actual keys in the entry (they are already encrypted because the whole vault is)
                publicKey: pub,
                privateKey: priv,
                signingPublicKey: sPub,
                signingPrivateKey: sPriv
            } as any);
            
            // Re-stringify with keys
            vaultEntry.password = JSON.stringify(filtered);
            setHasSharingKeysInVault(true);
        }

        const encryptedVault = await encrypt(vaultEntry, keys);
        const labels = entries.map((e) => e.siteName.toLowerCase());
        const token = localStorage.getItem("auth_token");

        if (!userId) throw new Error("User ID not found for sync");

        console.log(`[VaultContext] Saving vault for ${userId}...`);
        const syncUserId = session.userId || localStorage.getItem("user_id");
        const deviceId = localStorage.getItem("device_id") || "web-dashboard";
        const nowTs = Date.now();
        const blobPayload: SyncBlobPayload = {
            ciphertext: encryptedVault.ciphertext,
            iv: encryptedVault.iv,
            salt: encryptedVault.salt,
            authTag: encryptedVault.tag,
            version: nowTs,
            timestamp: nowTs,
            nonce: Math.random().toString(36).substring(7),
        };
        localStorage.setItem(getLocalBlobKey(userId), JSON.stringify(blobPayload));
        const baseTimestamp = Number(localStorage.getItem(getSyncTsKey(userId)) || "0") || 0;

        // 1. Update Compatibility API (Legacy/Simple)
        const compatUrl = buildApiUrl(`/api/vault/${encodeURIComponent(userId)}`);
        let compatOk = false;
        try {
            const response = await fetch(compatUrl, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    encryptedVault,
                    labels,
                }),
            });
            compatOk = response.ok;
            if (!response.ok) {
                console.warn(`[VaultContext] Compatibility API save failed: ${response.status}`);
            }
        } catch (compatErr) {
            console.warn("[VaultContext] Compatibility API save failed", compatErr);
        }

        if (compatOk) {
            console.log("[VaultContext] Compatibility API save successful");
        }

        // 2. Also push to Modern Sync API for consistency
        if (syncUserId && deviceId && token) {
            try {
                const syncUrl = buildApiUrl("/sync/blob/push");
                const syncResponse = await fetch(syncUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        userId: syncUserId,
                        deviceId,
                        blob: blobPayload,
                        baseTimestamp,
                    })
                });
                
                if (syncResponse.ok) {
                    console.log("[VaultContext] Sync API push successful");
                    localStorage.setItem(getSyncTsKey(userId), String(nowTs));
                    setLastSyncedAt(nowTs);
                    await drainOfflineQueue();
                } else {
                    if (syncResponse.status === 409) {
                        const payload = await syncResponse.json();
                        const conflict = payload?.conflict;
                        const sessionPassword = sessionStorage.getItem("session_master_password");
                        if (conflict?.latestServerBlob?.ciphertext && sessionPassword) {
                            const cryptoEngine = await import("@password-manager/crypto-engine");
                            const serverDecrypt = await cryptoEngine.decryptVault(sessionPassword, {
                                ciphertext: conflict.latestServerBlob.ciphertext,
                                iv: conflict.latestServerBlob.iv,
                                salt: conflict.latestServerBlob.salt,
                                tag: conflict.latestServerBlob.authTag || conflict.latestServerBlob.tag,
                                algorithm: "AES-256-GCM" as const,
                                derivationAlgorithm: "Argon2id" as const,
                            });
                            const serverEntries = serverDecrypt.success && serverDecrypt.data
                                ? parseDecryptedEntries(serverDecrypt.data)
                                : [];
                            const localEntries = entries.map((entry) => ({
                                id: String(entry.id),
                                url: String(entry.siteUrl || entry.siteName || "Unknown"),
                                username: String(entry.username || ""),
                                password: String(entry.password || ""),
                                notes: String(entry.notes || ""),
                                createdAt: String(entry.createdAt || new Date().toISOString()),
                                updatedAt: String(entry.updatedAt || new Date().toISOString()),
                                lastUpdated: String(entry.updatedAt || new Date().toISOString()),
                                reminderSnoozeUntil: String(entry.reminderSnoozeUntil || ""),
                                isPasswordVisible: false,
                            }));
                            setSyncConflict({
                                serverEntries,
                                localEntries,
                                serverBlob: conflict.latestServerBlob,
                                localBlob: blobPayload,
                                serverTimestamp: Number(conflict.latestServerTimestamp || 0),
                            });
                            throw new Error("SYNC_CONFLICT_DETECTED");
                        }
                    }
                    console.warn(`[VaultContext] Sync API push failed with status: ${syncResponse.status}`);
                    enqueueOfflineSync({ userId: syncUserId, deviceId, blob: blobPayload });
                }
            } catch (syncErr) {
                if (syncErr instanceof Error && syncErr.message === "SYNC_CONFLICT_DETECTED") {
                    throw syncErr;
                }
                console.warn("[VaultContext] Sync API push failed:", syncErr);
                enqueueOfflineSync({ userId: syncUserId, deviceId, blob: blobPayload });
            }
        }
    };

    const resolveSyncConflict = React.useCallback(async (choice: "local" | "server"): Promise<boolean> => {
        if (!syncConflict) return false;
        const token = localStorage.getItem("auth_token");
        const userId = (session.userId || localStorage.getItem("user_id") || "").trim();
        const deviceId = localStorage.getItem("device_id") || "web-dashboard";
        if (!token || !userId) return false;

        const chosenBlob = choice === "local" ? syncConflict.localBlob : syncConflict.serverBlob;

        const response = await fetch(buildApiUrl("/sync/blob/resolve"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                userId,
                deviceId,
                chosenBlob: {
                    ciphertext: chosenBlob.ciphertext,
                    iv: chosenBlob.iv,
                    salt: chosenBlob.salt,
                    authTag: chosenBlob.authTag || (chosenBlob as any).tag
                },
                expectedServerTimestamp: syncConflict.serverTimestamp,
            }),
        });

        if (!response.ok) {
            return false;
        }

        const payload = await response.json();
        const resolvedTs = Number(payload?.resolvedTimestamp || Date.now());
        localStorage.setItem(getSyncTsKey(userId), String(resolvedTs));
        setLastSyncedAt(resolvedTs);

        if (choice === "local") {
            setDecryptedEntries(syncConflict.localEntries);
            localStorage.setItem(getLocalBlobKey(userId), JSON.stringify(syncConflict.localBlob));
            // When choosing local, we MUST check if local has sharing keys
            // The conflict state stores localEntries (filtered), so we check localBlob unparsed if needed
            // but for simplicity, if we were the ones saving, we almost certainly have keys.
            setHasSharingKeysInVault(true); 
        } else {
            setDecryptedEntries(syncConflict.serverEntries);
            localStorage.setItem(getLocalBlobKey(userId), JSON.stringify(syncConflict.serverBlob));
            
            // Critical Fix: SyncConflict serverEntries are filtered by parseDecryptedEntries.
            // We need to check the raw content to see if sharing keys exist in the server version.
            try {
                const sessionPassword = sessionStorage.getItem("session_master_password");
                if (sessionPassword) {
                    const { decryptVault } = await import("@password-manager/crypto-engine");
                    const decrypted = await decryptVault(sessionPassword, {
                        ciphertext: syncConflict.serverBlob.ciphertext,
                        iv: syncConflict.serverBlob.iv,
                        salt: syncConflict.serverBlob.salt,
                        tag: syncConflict.serverBlob.authTag || syncConflict.serverBlob.tag,
                        algorithm: "AES-256-GCM" as const,
                        derivationAlgorithm: "Argon2id" as const,
                    });
                    if (decrypted.success && decrypted.data) {
                        const rawEntries = Array.isArray(decrypted.data) ? decrypted.data : [];
                        const keysFound = restoreSharingKeys(rawEntries, userId);
                        setHasSharingKeysInVault(keysFound);
                    }
                }
            } catch (err) {
                console.error("[VaultContext] Failed to restore keys from server conflict selection:", err);
            }
        }
        setSyncConflict(null);
        return true;
    }, [syncConflict, session.userId, getLocalBlobKey, restoreSharingKeys]);

    // Auto-unlock effect
    useEffect(() => {
        if (session.isAuthenticated && !isUnlocked && !isLoadingVault) {
            // Try to unlock if we have session password
            const sessionPassword = sessionStorage.getItem("session_master_password");
            if (sessionPassword) {
                unlockVault();
            }
        }
    }, [session.isAuthenticated, isUnlocked, isLoadingVault, unlockVault]);

    // Initial load
    useEffect(() => {
        const sessionPassword = sessionStorage.getItem("session_master_password");
        const token = localStorage.getItem("auth_token");
        if (sessionPassword && token) {
            unlockVault(); // Try immediately on mount
        } else {
            setIsLoadingVault(false);
        }
    }, [unlockVault]);

    // Periodic web sync while unlocked.
    useEffect(() => {
        if (!isUnlocked || !session.isAuthenticated) return;

        const interval = setInterval(() => {
            void syncNow();
        }, WEB_SYNC_INTERVAL_MS);

        const onVisible = () => {
            if (!document.hidden) {
                void syncNow();
            }
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [isUnlocked, session.isAuthenticated, syncNow]);

    useEffect(() => {
        const onOnline = () => {
            void drainOfflineQueue();
        };
        window.addEventListener("online", onOnline);
        return () => window.removeEventListener("online", onOnline);
    }, [drainOfflineQueue]);

    const registerSharingKey = React.useCallback(async () => {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        try {
            const { ensureShareKeyPair } = await import("@/lib/shareCrypto");
            const userId = session.userId || localStorage.getItem("user_id");
            const { publicKey, signingPublicKey } = await ensureShareKeyPair(userId || undefined);
            
            // Check both React state AND localStorage to avoid stale closure race
            const keysAlreadyInVault = hasSharingKeysInVault || (() => {
                const pk = userId ? `share_private_key_pkcs8_${userId}` : "share_private_key_pkcs8";
                const sPub = userId ? `share_sign_public_key_spki_${userId}` : "share_sign_public_key_spki";
                return !!(localStorage.getItem(pk) && localStorage.getItem(sPub));
            })();

            if (!keysAlreadyInVault && isUnlocked && derivedKeys) {
                console.log("[VaultContext] Sharing keys not found in vault, triggering persistence save...");
                try {
                    const transportEntries = decryptedEntries.map((e) => toStorageFormat(e));
                    await saveVault(transportEntries, derivedKeys);
                } catch (saveErr) {
                    // Don't let sync conflicts from key registration block the app
                    if (saveErr instanceof Error && saveErr.message === "SYNC_CONFLICT_DETECTED") {
                        console.warn("[VaultContext] Skipping sharing key persistence due to sync conflict (will retry next session)");
                    } else {
                        throw saveErr;
                    }
                }
            }

            await fetch(buildApiUrl("/share/public-key"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ publicKey, signingPublicKey })
            });
        } catch (error) {
            console.error("[VaultContext] Failed to register sharing keys:", error);
        }
    }, [decryptedEntries, isUnlocked, derivedKeys, hasSharingKeysInVault, saveVault, session.userId]);

    const refreshIncoming = React.useCallback(async () => {
        const token = localStorage.getItem("auth_token");
        if (!token || isRefreshingShares) return;
        setIsRefreshingShares(true);
        try {
            const res = await fetch(buildApiUrl("/share/incoming"), {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIncomingShares(data.shares || []);
            }
        } catch (error) {
            console.error("[VaultContext] Failed to refresh shares:", error);
        } finally {
            setIsRefreshingShares(false);
        }
    }, [isRefreshingShares]);

    const sendShare = React.useCallback(async (entry: DecryptedEntry, recipientEmail: string) => {
        const token = localStorage.getItem("auth_token");
        if (!token) throw new Error("Authentication required");
        
        const { createShareEnvelope, ensureShareKeyPair } = await import("@/lib/shareCrypto");
        const userId = session.userId || localStorage.getItem("user_id");

        // 1. Get our current keys and ALWAYS re-register them with the server
        //    This is the self-healing step that ensures server + localStorage are in sync
        const myKeys = await ensureShareKeyPair(userId || undefined);
        console.log("[VaultContext] Syncing signing key with server before share...");
        const regRes = await fetch(buildApiUrl("/share/public-key"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                publicKey: myKeys.publicKey,
                signingPublicKey: myKeys.signingPublicKey
            })
        });
        if (!regRes.ok) {
            console.error("[VaultContext] Failed to sync signing key with server");
        }

        // 2. Get recipient public key
        const pkRes = await fetch(buildApiUrl(`/share/public-key/${encodeURIComponent(recipientEmail.trim().toLowerCase())}`), {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!pkRes.ok) throw new Error("Recipient sharing not enabled or user not found");
        const { publicKey: recipientPubKey } = await pkRes.json();

        // 3. Create envelope (uses the same keys we just registered)
        const envelope = await createShareEnvelope(
            {
                url: entry.url,
                username: entry.username,
                password: entry.password,
                notes: entry.notes
            },
            recipientPubKey,
            recipientEmail,
            userId || undefined
        );

        // 4. Send
        const sendRes = await fetch(buildApiUrl("/share/send"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                recipientEmail: recipientEmail.trim().toLowerCase(),
                credentialLabel: entry.url || "Shared Credential",
                ...envelope
            })
        });
        if (!sendRes.ok) {
            const status = sendRes.status;
            const text = await sendRes.text();
            console.error(`[VaultContext] Share send failed (Status ${status}):`, text);
            let errorMessage = "Failed to send share";
            try {
                const err = JSON.parse(text);
                errorMessage = err.error || errorMessage;
            } catch (e) {
                // Not JSON
            }
            throw new Error(errorMessage);
        }
        toast.success("Credential shared securely!");
    }, [session.userId]);

    const acceptShare = React.useCallback(async (shareId: string) => {
        const token = localStorage.getItem("auth_token");
        if (!token) {
            toast.error("Authentication required");
            return;
        }
        const share = incomingShares.find(s => s.id === shareId);
        if (!share) {
            toast.error("Share not found");
            return;
        }

        try {
            console.log("[VaultContext] Accepting share:", shareId);
            const { verifyShareEnvelopeSignature, decryptShareEnvelope } = await import("@/lib/shareCrypto");
            
            // 1. Verify signature
            console.log("[VaultContext] Verifying share signature...");
            const sigOk = await verifyShareEnvelopeSignature(
                {
                    encryptedSessionKey: share.encryptedSessionKey,
                    ciphertext: share.ciphertext,
                    iv: share.iv,
                    signature: share.signature,
                },
                share.senderSigningPublicKey,
                (share.recipientEmail || session.email || "").trim().toLowerCase()
            );
            
            if (!sigOk) {
                console.error("[VaultContext] Signature verification failed");
                toast.error("Security alert: Share signature verification failed! The message may have been tampered with.");
                return;
            }

            // 2. Decrypt
            console.log("[VaultContext] Decrypting share envelope...");
            let decrypted;
            try {
                const userId = session.userId || localStorage.getItem("user_id");
                decrypted = await decryptShareEnvelope({
                    encryptedSessionKey: share.encryptedSessionKey,
                    ciphertext: share.ciphertext,
                    iv: share.iv,
                }, userId || undefined);
            } catch (decryptErr) {
                console.error("[VaultContext] RSA Decryption failed (OperationError usually means key mismatch):", decryptErr);
                console.log("[VaultContext] Share data ID:", shareId);
                console.log("[VaultContext] Recipient Email in share:", share.recipientEmail);
                throw new Error("Unable to decrypt shared credential. This usually happens if your sharing keys have changed or didn't sync correctly.");
            }

            // 3. Add to vault
            console.log("[VaultContext] Adding decrypted credential to vault...");
            await addEntry({
                url: decrypted.url || decrypted.siteUrl || decrypted.site || "Shared Credential",
                username: decrypted.username || "",
                password: decrypted.password || "",
                notes: decrypted.notes || `Shared by ${share.sender.email}`
            });

            // 4. Mark accepted on server
            console.log("[VaultContext] Marking share as accepted on server...");
            const acceptRes = await fetch(buildApiUrl(`/share/${encodeURIComponent(shareId)}/accept`), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!acceptRes.ok) {
                console.warn("[VaultContext] Server failed to mark share as accepted, but it was added to vault locally.");
            }

            setIncomingShares(prev => prev.filter(s => s.id !== shareId));
            toast.success("Shared credential added to vault");
        } catch (error) {
            console.error("[VaultContext] Accept share failed:", error);
            toast.error(`Failed to accept share: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }, [incomingShares, addEntry, session.email, session.userId]);

    const rejectShare = React.useCallback(async (shareId: string) => {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        try {
            await fetch(buildApiUrl(`/share/${encodeURIComponent(shareId)}/reject`), {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            setIncomingShares(prev => prev.filter(s => s.id !== shareId));
            toast.success("Share request rejected");
        } catch (error) {
            console.error("[VaultContext] Reject share failed:", error);
        }
    }, []);

    // Reset sharing registration when user changes
    useEffect(() => {
        sharingRegisteredRef.current = false;
    }, [session.userId]);

    // Effect to register keys and check for shares on unlock
    useEffect(() => {
        if (!isUnlocked) return;

        // Register sharing key only once per session
        if (!sharingRegisteredRef.current) {
            sharingRegisteredRef.current = true;
            registerSharingKey();
        }

        // Always fetch incoming shares (idempotent, safe to re-run)
        const token = localStorage.getItem("auth_token");
        if (token) {
            fetch(buildApiUrl("/share/incoming"), {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data) setIncomingShares(data.shares || []); })
            .catch(err => console.error("[VaultContext] Auto-fetch incoming shares failed:", err));
        }
    }, [isUnlocked, session.userId]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <VaultContext.Provider value={{
            decryptedEntries,
            setDecryptedEntries,
            derivedKeys,
            isLoadingVault,
            isUnlocked,
            unlockVault,
            addEntry,
            updateEntry,
            deleteEntry,
            snoozeEntry,
            setEntryLastUpdated,
            syncNow,
            isSyncing,
            lastSyncedAt,
            syncError,
            pendingSyncCount,
            syncConflict,
            resolveSyncConflict,
            incomingShares,
            refreshIncoming,
            acceptShare,
            rejectShare,
            sendShare,
        }}>
            {children}
        </VaultContext.Provider>
    );
}

export const useVault = () => {
    const context = useContext(VaultContext);
    if (context === undefined) {
        throw new Error("useVault must be used within a VaultProvider");
    }
    return context;
};
