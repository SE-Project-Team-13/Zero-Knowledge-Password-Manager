"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { deriveKey, DerivedKey, EncryptedVault } from "@password-manager/crypto-engine"; // Using crypto-engine directly
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api-base-url";

// Define the DecryptedEntry type
export interface DecryptedEntry {
    id: string;
    site: string;
    siteUrl: string;
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
    addEntry: (entryCtx: { site: string; username: string; password: string; url: string; notes: string }) => Promise<void>;
    updateEntry: (entry: DecryptedEntry) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    snoozeEntry: (id: string) => Promise<void>;
    setEntryLastUpdated: (id: string, isoDate: string) => Promise<void>;
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
        siteName: entry.site,
        siteUrl: entry.siteUrl,
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
    const [session] = useVaultSync();

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

            // Start parallel execution: Key Derivation (CPU) + Vault Fetch (Network)
            console.log('[VaultContext] Starting parallel unlock operations with stored password...')

            const keyDerivationPromise = deriveKey(sessionPassword, saltBuffer);

            // Fetch vault
            const vaultFetchPromise = (async () => {
                 const userId = session.userId || localStorage.getItem("user_id") || "";
                 const token = localStorage.getItem("auth_token");
                 
                 // 1. Try Modern Sync API first (supports multiple devices/blobs)
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
                             
                             // Robust validation of sync API response
                             if (syncData && typeof syncData === "object" && 
                                 "vaults" in syncData && Array.isArray(syncData.vaults) && 
                                 syncData.vaults.length > 0) {
                                 
                                 const firstVault = syncData.vaults[0];
                                 if (firstVault && typeof firstVault === "object" && "ciphertext" in firstVault) {
                                     return { ok: true, status: 200, json: async () => firstVault };
                                 }
                             }
                             console.log("[VaultContext] Sync API empty or invalid format, trying compatibility");
                         } else if (syncResponse.status === 401) {
                             // Authentication failed, try compatibility layer
                             console.warn("[VaultContext] Sync API auth failed, trying compatibility layer");
                         } else {
                             console.warn("[VaultContext] Sync API failed with status", syncResponse.status);
                         }
                     } catch (err) {
                         console.warn("[VaultContext] Sync API failed, trying compatibility layer", err);
                     }
                 }

                 // 2. Fallback to Compatibility API
                 if (!userId) throw new Error("No user ID found");
                 const response = await fetch(buildApiUrl(`/api/vault/${encodeURIComponent(userId)}`), {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    cache: "no-store"
                });
                
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
                    const cryptoEngine = await import("@password-manager/crypto-engine");

                    // Decrypt with secure logic
                    let decryptedEntry: unknown;
                    
                    // Standardize data tags (sync uses authTag, extension uses tag)
                    const vaultData = {
                        ciphertext: data.ciphertext,
                        iv: data.iv,
                        salt: data.salt,  // Important: vault has its own salt!
                        tag: data.authTag || data.tag,
                        algorithm: "AES-256-GCM" as const,
                        derivationAlgorithm: "Argon2id" as const
                    };

                    // SECURITY: Only decrypt using the master password with vault's salt
                    try {
                        console.log("[VaultContext] Attempting decryption with master password...");
                        const decryptResult = await cryptoEngine.decryptVault(sessionPassword, vaultData);
                        if (decryptResult.success && decryptResult.data) {
                            decryptedEntry = decryptResult.data;
                            console.log("[VaultContext] Decryption succeeded");
                        } else {
                            throw new Error("Decryption failed");
                        }
                    } catch (decryptErr) {
                        console.error("[VaultContext] Decryption failed:", decryptErr);
                        toast.error("Failed to decrypt vault. Please ensure your password is correct.");
                        setIsLoadingVault(false);
                        return;
                    }

                    setDerivedKeys(keys);

                    // Parse entries (handle legacy formats)
                    let entries: Array<Record<string, unknown>> = [];
                    if (Array.isArray(decryptedEntry)) {
                        entries = decryptedEntry as Array<Record<string, unknown>>;
                    } else if (decryptedEntry && typeof decryptedEntry === "object") {
                        // Check for wrapped password field
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

                        // Check for array properties
                        if (entries.length === 0) {
                            const possibleArrays = Object.values(decryptedObject).filter(
                                (val) => Array.isArray(val),
                            );
                            if (possibleArrays.length > 0) {
                                entries = possibleArrays[0] as Array<Record<string, unknown>>;
                            } else {
                                // Treat as single object if it looks like an entry
                                if (decryptedObject.site || decryptedObject.siteName) {
                                    entries = [decryptedObject];
                                }
                            }
                        }
                    }

                    const entriesWithVisibility = entries
                        .filter((entry) => {
                            const siteName = String(entry.siteName || entry.site || "");
                            return siteName !== "VAULT_ROOT" && siteName !== "SYSTEM";
                        })
                        .map((entry) => ({
                            id: String(entry.id || Math.random().toString(36).substring(7)),
                            site: String(entry.siteName || entry.site || "Unknown"),
                            username: String(entry.username || ""),
                            password: String(entry.password || ""),
                            siteUrl: String(entry.siteUrl || entry.url || ""),
                            notes: String(entry.notes || ""),
                            createdAt: String(entry.createdAt || new Date().toISOString()),
                            updatedAt: String(entry.updatedAt || entry.lastUpdated || new Date().toISOString()),
                            lastUpdated: String(entry.updatedAt || entry.lastUpdated || new Date().toISOString()),
                            reminderSnoozeUntil: String(entry.reminderSnoozeUntil || ""),
                            isPasswordVisible: false,
                        }));

                    setDecryptedEntries(entriesWithVisibility);
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
            toast.error("Failed to unlock vault: " + (err instanceof Error ? err.message : "Unknown error"));
        } finally {
            setIsLoadingVault(false);
        }
    }, [isUnlocked, decryptedEntries.length, session.userId]);

    const addEntry = async (entryCtx: { site: string; username: string; password: string; url: string; notes: string }) => {
        if (!derivedKeys) {
            toast.error("Encryption key not available");
            return;
        }

        try {
            const entryId = Math.random().toString(36).substring(7);
            const newCredential = {
                id: entryId,
                siteName: entryCtx.site,
                siteUrl: entryCtx.url || "",
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
                site: entryCtx.site,
                siteUrl: entryCtx.url,
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
            toast.error("Failed to save credential");
        }
    };

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
            toast.error("Failed to update credential");
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
            toast.error("Failed to delete credential");
        }
    };

    const snoozeEntry = async (id: string) => {
        if (!derivedKeys) return;

        try {
            const snoozeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const updatedEntries = decryptedEntries.map((e) =>
                e.id === id
                    ? { ...e, reminderSnoozeUntil: snoozeUntil }
                    : e,
            );

            const transportEntries = updatedEntries.map((e) => toStorageFormat(e));

            await saveVault(transportEntries, derivedKeys);
            setDecryptedEntries(updatedEntries);
            toast.info("Reminder snoozed for 7 days");
        } catch (err) {
            console.error("Snooze entry error:", err);
            toast.error("Failed to snooze reminder");
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
            toast.error("Failed to set last updated date");
        }
    };

    // Helper to encrypt and save
    const saveVault = async (entries: StorageVaultEntry[], keys: DerivedKey) => {
        const { encrypt } = await import("@password-manager/crypto-engine");
        const vaultEntry = {
            site: "VAULT_ROOT",
            username: "SYSTEM",
            password: JSON.stringify(entries),
        };

        const encryptedVault = await encrypt(vaultEntry, keys);
        const labels = entries.map((e) => e.siteName.toLowerCase());
        const userId = (session.userId || localStorage.getItem("user_id") || "").trim();
        const token = localStorage.getItem("auth_token");

        if (!userId) throw new Error("User ID not found for sync");

        console.log(`[VaultContext] Saving vault for ${userId}...`);

        // 1. Update Compatibility API (Legacy/Simple)
        const compatUrl = buildApiUrl(`/api/vault/${encodeURIComponent(userId)}`);
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
            },
        );

        if (!response.ok) {
            console.error(`[VaultContext] Compatibility API save failed: ${response.status}`);
            throw new Error("Failed to save to compatibility backend");
        }

        console.log("[VaultContext] Compatibility API save successful");

        // 2. Also push to Modern Sync API for consistency
        const syncUserId = session.userId || localStorage.getItem("user_id");
        const deviceId = localStorage.getItem("device_id") || "web-dashboard";
        
        if (syncUserId && deviceId && token) {
            try {
                const syncUrl = buildApiUrl("/sync/push");
                const syncResponse = await fetch(syncUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        userId: syncUserId,
                        deviceId,
                        vault: {
                            ciphertext: encryptedVault.ciphertext,
                            iv: encryptedVault.iv,
                            salt: encryptedVault.salt,
                            authTag: encryptedVault.tag,
                            version: Date.now(), // Using timestamp as a simple version to ensure it's always "newer"
                            timestamp: Date.now(),
                            nonce: Math.random().toString(36).substring(7)
                        }
                    })
                });
                
                if (syncResponse.ok) {
                    console.log("[VaultContext] Sync API push successful");
                } else {
                    console.warn(`[VaultContext] Sync API push failed with status: ${syncResponse.status}`);
                }
            } catch (syncErr) {
                console.warn("[VaultContext] Sync API push failed:", syncErr);
            }
        }
    };

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
            setEntryLastUpdated
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
