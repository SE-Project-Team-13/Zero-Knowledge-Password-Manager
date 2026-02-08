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
                 // Determine email - session might not be ready, try storage or session
                 const email = session.email || localStorage.getItem("user_email") || "";
                 if (!email) throw new Error("No user email found");
                 
                 return fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(email)}`, {
                    method: "GET",
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem("auth_token")}`
                    }
                })
            })();

            const [keys, response] = await Promise.all([keyDerivationPromise, vaultFetchPromise]);

            if (response.ok) {
                const data = await response.json();
                
                 if (data && data.ciphertext) {
                    const cryptoEngine = await import("@password-manager/crypto-engine");
                    
                    // Decrypt with fallback logic
                    let decryptedEntry: any;
                    let finalKeys = keys;
                    
                    try {
                        decryptedEntry = await cryptoEngine.decrypt(data, keys);
                    } catch (decryptErr) {
                         console.warn("[VaultContext] Master password failed, trying email fallback");
                         // Re-derive using email as password
                         const email = session.email || localStorage.getItem("user_email") || "";
                         const fallbackKeys = await deriveKey(email, saltBuffer);
                         decryptedEntry = await cryptoEngine.decrypt(data, fallbackKeys);
                         finalKeys = fallbackKeys;
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
            } else {
                 console.error("[VaultContext] Failed to fetch vault:", response.status);
                 // Don't throw here, just leave unlocked false
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
            }));
            
            await saveVault(transportEntries, derivedKeys);
            setDecryptedEntries(updatedEntries);
            toast.success("Credential deleted!");
        } catch (err) {
            console.error("Delete entry error:", err);
            toast.error("Failed to delete credential");
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
            deleteEntry
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
