"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { deriveKey, DerivedKey, VaultEntry, EncryptedVault } from "@password-manager/crypto-engine"; // Using crypto-engine directly
import { toast } from "sonner";

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

export function VaultProvider({ children }: { children: ReactNode }) {
    const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>([]);
    const [derivedKeys, setDerivedKeys] = useState<DerivedKey | null>(null);
    const [isLoadingVault, setIsLoadingVault] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [session] = useVaultSync();

    const unlockVault = async () => {
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

            const saltBuffer = new Uint8Array(
                salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
            );

            // Start parallel execution: Key Derivation (CPU) + Vault Fetch (Network)
            console.log('[VaultContext] Starting parallel unlock operations with stored password...')

            const keyDerivationPromise = deriveKey(sessionPassword, saltBuffer);

            // Fetch vault
            const vaultFetchPromise = (async () => {
                 const email = session.email || localStorage.getItem("user_email") || "";
                 const userId = session.userId || localStorage.getItem("user_id") || "";
                 const token = localStorage.getItem("auth_token");
                 
                 // 1. Try Modern Sync API first (supports multiple devices/blobs)
                 if (userId && token) {
                     try {
                         const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/sync/pull`, {
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
                             // Sync API returns { vaults: [...], lastSyncTimestamp, currentVersion, success }
                             if (syncData.vaults && syncData.vaults.length > 0) {
                                 // Return the latest vault blob
                                 return { ok: true, status: 200, json: async () => syncData.vaults[0] };
                             } else {
                                 // Empty vault from sync API
                                 console.log("[VaultContext] Sync API empty, trying compatibility");
                             }
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
                 if (!email) throw new Error("No user email found");
                 const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(email)}`, {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                console.log("[VaultContext] Compatibility API status:", response.status);
                if (response.ok) {
                    const data = await response.json();
                    console.log("[VaultContext] Compatibility API data:", { hasData: !!data, hasCiphertext: !!data?.ciphertext });
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

                    // Decrypt with fallback logic
                    let decryptedEntry: any;
                    let finalKeys = keys;
                    
                    // Standardize data tags (sync uses authTag, extension uses tag)
                    const vaultData = {
                        ciphertext: data.ciphertext,
                        iv: data.iv,
                        salt: data.salt,  // Important: vault has its own salt!
                        tag: data.authTag || data.tag,
                        algorithm: "AES-256-GCM" as const,
                        derivationAlgorithm: "Argon2id" as const
                    };

                    // First try using the vault's own salt with decryptVault
                    // This handles the case where password was reset and vault re-encrypted with new salt
                    try {
                        console.log("[VaultContext] Attempting decryption with vault's own salt...");
                        const decryptResult = await cryptoEngine.decryptVault(sessionPassword, vaultData);
                        if (decryptResult.success && decryptResult.data) {
                            decryptedEntry = decryptResult.data;
                            console.log("[VaultContext] Decryption succeeded with vault's salt");
                        } else {
                            throw new Error("Decryption failed");
                        }
                    } catch (firstAttemptErr) {
                        console.warn("[VaultContext] Vault salt decryption failed, trying with user salt...");
                        
                        // Fallback: Try with pre-derived keys (original approach)
                        try {
                            decryptedEntry = await cryptoEngine.decrypt(vaultData as any, keys);
                            console.log("[VaultContext] Decryption succeeded with user salt");
                        } catch (secondAttemptErr) {
                            console.warn("[VaultContext] User salt decryption failed, trying email fallback...");
                            
                            // Last resort: Re-derive using email as password
                            const email = session.email || localStorage.getItem("user_email") || "";
                            try {
                                const emailDecryptResult = await cryptoEngine.decryptVault(email, vaultData);
                                if (emailDecryptResult.success && emailDecryptResult.data) {
                                    decryptedEntry = emailDecryptResult.data;
                                    console.log("[VaultContext] Decryption succeeded with email fallback");
                                } else {
                                    throw new Error("Email fallback failed");
                                }
                            } catch (finalErr) {
                                console.warn("[VaultContext] All vault decryption attempts failed. User may have changed password without re-encryption.");
                                toast.error("Failed to decrypt vault. Your data is unreadable due to the password change. You can start fresh by adding new credentials.");
                                
                                // Allow starting fresh with empty vault
                                setDecryptedEntries([]);
                                setDerivedKeys(keys);
                                setIsUnlocked(true);
                                setIsLoadingVault(false);
                                return;
                            }
                        }
                    }

                    setDerivedKeys(finalKeys);

                    // Parse entries (handle legacy formats)
                    let entries: any[] = [];
                    if (Array.isArray(decryptedEntry)) {
                        entries = decryptedEntry;
                    } else if (decryptedEntry && typeof decryptedEntry === "object") {
                        // Check for wrapped password field
                        if (decryptedEntry.password) {
                            try {
                                const parsed = JSON.parse(decryptedEntry.password);
                                if (Array.isArray(parsed)) {
                                    entries = parsed;
                                }
                            } catch { }
                        }

                        // Check for array properties
                        if (entries.length === 0) {
                            const possibleArrays = Object.values(decryptedEntry).filter(
                                (val) => Array.isArray(val),
                            );
                            if (possibleArrays.length > 0) {
                                entries = possibleArrays[0] as any[];
                            } else {
                                // Treat as single object if it looks like an entry
                                if (decryptedEntry.site || decryptedEntry.siteName) {
                                    entries = [decryptedEntry];
                                }
                            }
                        }
                    }

                    const entriesWithVisibility = entries
                        .filter((entry: any) => {
                            const siteName = entry.siteName || entry.site || "";
                            return siteName !== "VAULT_ROOT" && siteName !== "SYSTEM";
                        })
                        .map((entry: any) => ({
                            id: entry.id || Math.random().toString(36).substring(7),
                            site: entry.siteName || entry.site || "Unknown",
                            username: entry.username || "",
                            password: entry.password || "",
                            siteUrl: entry.siteUrl || entry.url || "",
                            siteName: entry.siteName || entry.site || "Unknown",
                            notes: entry.notes || "",
                            createdAt: entry.createdAt || new Date().toISOString(),
                            updatedAt: entry.updatedAt || entry.lastUpdated || new Date().toISOString(),
                            lastUpdated: entry.updatedAt || entry.lastUpdated || new Date().toISOString(),
                            reminderSnoozeUntil: entry.reminderSnoozeUntil || "",
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
                     console.error("[VaultContext] Failed to fetch vault:", fetchResult.status);
                 }
            }

        } catch (err) {
            console.error("[VaultContext] Unlock error:", err);
            // toast.error("Failed to unlock vault");
        } finally {
            setIsLoadingVault(false);
        }
    };

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
                ...decryptedEntries.map((e) => ({
                    id: e.id,
                    siteName: e.site,
                    siteUrl: e.siteUrl,
                    username: e.username,
                    password: e.password,
                    notes: e.notes,
                    createdAt: e.createdAt,
                    updatedAt: e.updatedAt || e.lastUpdated || new Date().toISOString(),
                    reminderSnoozeUntil: e.reminderSnoozeUntil || "",
                })),
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

            const transportEntries = updatedEntries.map((e) => ({
                id: e.id,
                siteName: e.site,
                siteUrl: e.siteUrl,
                username: e.username,
                password: e.password,
                notes: e.notes,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt || new Date().toISOString(),
                reminderSnoozeUntil: e.reminderSnoozeUntil || "",
            }));

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
            const transportEntries = updatedEntries.map((e) => ({
                id: e.id,
                siteName: e.site,
                siteUrl: e.siteUrl,
                username: e.username,
                password: e.password,
                notes: e.notes,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt || new Date().toISOString(),
                reminderSnoozeUntil: e.reminderSnoozeUntil || "",
            }));

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

            const transportEntries = updatedEntries.map((e) => ({
                id: e.id,
                siteName: e.site,
                siteUrl: e.siteUrl,
                username: e.username,
                password: e.password,
                notes: e.notes,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt || new Date().toISOString(),
                reminderSnoozeUntil: e.reminderSnoozeUntil || "",
            }));

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

            const transportEntries = updatedEntries.map((e) => ({
                id: e.id,
                siteName: e.site,
                siteUrl: e.siteUrl,
                username: e.username,
                password: e.password,
                notes: e.notes,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt || new Date().toISOString(),
                reminderSnoozeUntil: e.reminderSnoozeUntil || "",
            }));

            await saveVault(transportEntries, derivedKeys);
            setDecryptedEntries(updatedEntries);
            toast.info("Last updated date changed");
        } catch (err) {
            console.error("Set lastUpdated error:", err);
            toast.error("Failed to set last updated date");
        }
    };

    // Helper to encrypt and save
    const saveVault = async (entries: any[], keys: DerivedKey) => {
        const { encrypt } = await import("@password-manager/crypto-engine");
        const vaultEntry = {
            site: "VAULT_ROOT",
            username: "SYSTEM",
            password: JSON.stringify(entries),
        };

        const encryptedVault = await encrypt(vaultEntry, keys);
        const labels = entries.map((e) => (e.siteName || "").toLowerCase());
        const email = session.email || localStorage.getItem("user_email") || "";

        const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(email)}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    encryptedVault,
                    labels,
                }),
            },
        );

        if (!response.ok) throw new Error("Failed to save to backend");
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
    }, [session.isAuthenticated, isUnlocked]);

    // Initial load
    useEffect(() => {
        const sessionPassword = sessionStorage.getItem("session_master_password");
        const token = localStorage.getItem("auth_token");
        if (sessionPassword && token) {
            unlockVault(); // Try immediately on mount
        } else {
            setIsLoadingVault(false);
        }
    }, []);

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
