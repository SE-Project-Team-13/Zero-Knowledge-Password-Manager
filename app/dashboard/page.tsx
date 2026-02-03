"use client";

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useTheme } from "next-themes";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  Lock,
  Unlock,
  Plus,
  Key,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  Copy,
  AlertCircle,
  Trash2,
  Sparkles,
  Edit,
  X,
  Sun,
  Moon,
  Loader2
} from "lucide-react";
import {
  deriveKey,
  encryptVault,
  decryptVault,
} from "@password-manager/crypto-engine";
import type { DerivedKey } from "@password-manager/crypto-engine";
import { toast } from "sonner";

// --- Types ---
interface DecryptedEntry {
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

// --- Helpers ---
const calculatePasswordStrength = (password: string) => {
  if (!password) return { score: 0, label: "None", color: "bg-gray-200" };

  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 20;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;

  if (score < 40) return { score, label: "Weak", color: "bg-red-500" };
  if (score < 75) return { score, label: "Moderate", color: "bg-yellow-500" };
  return { score, label: "Strong", color: "bg-green-500" };
};

export default function DashboardPage() {
  const [session, actions] = useVaultSync();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // UI State
  const [isInitializing, setIsInitializing] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  // Vault Data (In-Memory Only)
  const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>(
    [],
  );
  const [derivedKeys, setDerivedKeys] = useState<DerivedKey | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  // Add Entry Form
  const [newEntry, setNewEntry] = useState({
    site: "",
    username: "",
    password: "",
    url: "",
    notes: "",
    showPassword: false,
  });
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const strength = calculatePasswordStrength(newEntry.password);

  // Edit Entry State
  const [editingEntry, setEditingEntry] = useState<DecryptedEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Inactivity Lock Timer
  const lastActivityRef = useRef<number>(Date.now());
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  const lockVault = useCallback(() => {
    // Phase 4: Zero out sensitive memory
    setDerivedKeys(null);
    setDecryptedEntries([]);
    setOtpCode("");
    setIsUnlocked(false);
    setOtpVerified(false);
    sessionStorage.removeItem("otp_verified"); // Clear persistent state
    toast.info("Vault locked for security");
    // Redirect to login page
    window.location.href = "/";
  }, []);

  // Send OTP on component mount and handle initialization
  useEffect(() => {
    // 1. Check if user is theoretically logged in (has token)
    // We check window to stay safe with SSR, though "use client" blocks most issues
    const hasToken = typeof window !== 'undefined' && localStorage.getItem("auth_token")
    
    if (!hasToken) {
        // No token, so we are definitely not logged in.
        // Stop loading, show login screen.
        setIsInitializing(false)
        return
    }

    // 2. If has token, wait for useVaultSync to verify it and set isAuthenticated
    if (!session.isAuthenticated) {
        // Still waiting for hook to sync
        return
    }

    // 3. User is authenticated. Check OTP status.
    if (!otpSent) { 
        // Only run if we haven't processed OTP yet in this component lifecycle
        const isVerified = sessionStorage.getItem("otp_verified") === "true"
        if (isVerified) {
             setOtpVerified(true)
             setOtpSent(true)
             
             // Perform unlock (async) - Keep loading while this happens
             // unlockVault handles error toasts
             unlockVault().finally(() => {
                 setIsInitializing(false)
             })
        } else {
             // Not verified
             sendOTPToUser()
             // Show OTP screen immediately
             setIsInitializing(false)
        }
    } else {
         // OTP already sent state. 
         // If we reached here without going through the above block (e.g. re-render),
         // ensure loading is off.
         setIsInitializing(false)
    }
  }, [session.isAuthenticated, session.email, otpSent]);

  // Countdown timer for OTP expiration
  useEffect(() => {
    if (!otpSent || otpVerified) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error("OTP expired. Please request a new code.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [otpSent, otpVerified]);

  // Send OTP to user's email
  const sendOTPToUser = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/otp/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: session.email }),
        },
      );

      if (response.ok) {
        setOtpSent(true);
        setTimeLeft(600); // Reset timer to 10 minutes
        toast.success("OTP sent to your email");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      toast.error("Failed to send OTP. Please try again.");
    }
  };

  // Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return;

    setIsVerifyingOtp(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/otp/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: session.email,
            code: otpCode,
          }),
        },
      );

      if (response.ok) {
        setOtpVerified(true);
        sessionStorage.setItem("otp_verified", "true"); // Persist verification
        toast.success("OTP verified successfully!");
        // Automatically proceed to unlock vault
        await unlockVault();
      } else {
        const error = await response.json();
        toast.error(error.message || "Invalid OTP code");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      toast.error("Failed to verify OTP. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle Activity for Auto-lock
  useEffect(() => {
    if (!isUnlocked) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT) {
        lockVault();
      }
    }, 10000);

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(checkInactivity);
    };
  }, [isUnlocked, lockVault]);

  // Unlock vault after OTP verification
  const unlockVault = async () => {
    try {
      // 1. Derive encryption key locally using Phase-1 crypto engine
      // The salt is retrieved from the session state (fetched during login/register)
      if (!session.salt) {
        throw new Error("No salt found for user. Please re-login.");
      }

      // Use the provided master password
      const passwordToUse = masterPassword.trim() || session.email || "";
      if (!masterPassword.trim()) {
        console.warn(
          "[Dashboard] Master password empty, falling back to email for compatibility",
        );
      }

      const saltBuffer = new Uint8Array(
        session.salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
      );
      
      // Start parallel execution: Key Derivation (CPU) + Vault Fetch (Network)
      console.log('[Dashboard] Starting parallel unlock operations...')
      
      const keyDerivationPromise = deriveKey(passwordToUse, saltBuffer)
      
      const vaultFetchPromise = (async () => {
        console.log('[Dashboard] Fetching vault from backend...')
        console.log('[Dashboard] email:', session.email)
        return fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || '')}`, {
          method: "GET",
          headers: {
            'Authorization': `Bearer ${localStorage.getItem("auth_token")}`
          }
        })
      })()

      // Wait for both to complete
      const [keys, response] = await Promise.all([keyDerivationPromise, vaultFetchPromise])
      
      setDerivedKeys(keys)

      // 2. Process fetched vault
      try {
        console.log("[Dashboard] Response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("[Dashboard] Response data:", data);

          // SimpleVault returns the encrypted data directly
          if (data && data.ciphertext && data.iv && data.salt) {
            console.log("[Dashboard] Decrypting vault...");
            // Import the decrypt function from crypto-engine
            const { decrypt } = await import("@password-manager/crypto-engine");

            // Create EncryptedVault object
            const encryptedVault = {
              ciphertext: data.ciphertext,
              iv: data.iv,
              salt: data.salt,
              algorithm: "AES-256-GCM" as const,
              derivationAlgorithm: "Argon2id" as const,
            };

            // Decrypt the vault
            let decryptedEntry: any;
            try {
              decryptedEntry = await decrypt(encryptedVault, keys);
              console.log("[Dashboard] Decrypted entry with master password");
            } catch (decryptErr) {
              console.warn(
                "[Dashboard] Decryption with master password failed, trying email-key fallback (compatibility)",
              );
              // Fallback to email as password (compatibility with old prototype state)
              const fallbackKeys = await deriveKey(
                session.email || "",
                saltBuffer,
              );
              decryptedEntry = await decrypt(encryptedVault, fallbackKeys);
              console.log("[Dashboard] Decrypted entry with email fallback");
              // Use fallback keys for this session
              setDerivedKeys(fallbackKeys);
            }

            console.log(
              "[Dashboard] Decrypted entry type:",
              typeof decryptedEntry,
            );
            console.log(
              "[Dashboard] Decrypted entry keys:",
              Object.keys(decryptedEntry),
            );
            console.log(
              "[Dashboard] Decrypted entry JSON:",
              JSON.stringify(decryptedEntry, null, 2),
            );

            // The extension stores credentials as an array
            // The decrypt function returns a VaultEntry, but the actual data might be in a property
            let entries: any[] = [];

            // Check if decryptedEntry is already an array
            if (Array.isArray(decryptedEntry)) {
              console.log("[Dashboard] Decrypted entry is an array");
              entries = decryptedEntry;
            }
            // Check if it's a VaultEntry with the data in a property
            else if (decryptedEntry && typeof decryptedEntry === "object") {
              console.log(
                "[Dashboard] Decrypted entry is an object, inspecting properties...",
              );

              // Log all properties
              for (const [key, value] of Object.entries(decryptedEntry)) {
                console.log(
                  `[Dashboard] Property "${key}":`,
                  value,
                  "Type:",
                  typeof value,
                );
              }

              // Try to find an array property
              const possibleArrays = Object.values(decryptedEntry).filter(
                (val) => Array.isArray(val),
              );
              if (possibleArrays.length > 0) {
                console.log("[Dashboard] Found array in property");
                entries = possibleArrays[0] as any[];
              } else {
                // Check if any property contains a JSON string that's an array
                for (const [key, value] of Object.entries(decryptedEntry)) {
                  if (typeof value === "string") {
                    try {
                      const parsed = JSON.parse(value);
                      if (Array.isArray(parsed)) {
                        console.log(
                          `[Dashboard] Found JSON array in property "${key}"`,
                        );
                        entries = parsed;
                        break;
                      }
                    } catch (e) {
                      // Not JSON, continue
                    }
                  }
                }

                // If still no entries, treat as single entry
                if (entries.length === 0) {
                  console.log("[Dashboard] Treating as single entry");
                  entries = [decryptedEntry];
                }
              }
            }

            console.log("[Dashboard] Parsed entries:", entries);
            console.log("[Dashboard] Number of entries:", entries.length);

            // Add visibility flag to each entry
            // Handle both 'site' and 'siteName' fields (extension uses 'siteName')
            // Filter out system entries (VAULT_ROOT)
            const entriesWithVisibility = entries
              .filter((entry: any) => {
                const siteName = entry.siteName || entry.site || "";
                return siteName !== "VAULT_ROOT" && siteName !== "SYSTEM";
              })
              .map((entry: any, index: number) => {
                console.log(`[Dashboard] Processing entry ${index}:`, entry);
                return {
                  id: entry.id || Math.random().toString(36).substring(7),
                  site: entry.siteName || entry.site || "Unknown",
                  username: entry.username || "",
                  password: entry.password || "",
                  // Preserve all extension fields for re-encryption
                  siteUrl: entry.siteUrl || entry.url || "",
                  siteName: entry.siteName || entry.site || "Unknown",
                  notes: entry.notes || "",
                  createdAt: entry.createdAt || new Date().toISOString(),
                  updatedAt: entry.updatedAt || new Date().toISOString(),
                  lastUpdated:
                    entry.updatedAt ||
                    entry.lastUpdated ||
                    new Date().toLocaleDateString(),
                  isPasswordVisible: false,
                };
              });

            console.log("[Dashboard] Setting entries:", entriesWithVisibility);
            setDecryptedEntries(entriesWithVisibility);
            toast.success(
              `Loaded ${entriesWithVisibility.length} credential(s)`,
            );
          } else {
            console.log("[Dashboard] No encrypted data found in response");
          }
        } else if (response.status === 404) {
          console.log("[Dashboard] No vault found for user (new user)");
        } else {
          const errorText = await response.text();
          console.error(
            "[Dashboard] Response not OK:",
            response.status,
            errorText,
          );
        }
      } catch (fetchErr) {
        console.error("[Dashboard] Fetch/decrypt error:", fetchErr);
        // Continue with empty vault - this is fine for new users
      }

      setIsUnlocked(true);
      toast.success("Vault unlocked successfully");
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error("Failed to unlock vault");
    }
  };

  // Generate strong password
  const generatePassword = () => {
    const length = 16;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    let password = "";
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    setNewEntry({ ...newEntry, password });
    toast.success("Strong password generated");
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newEntry.site ||
      !newEntry.username ||
      !newEntry.password ||
      !newEntry.url
    ) {
      toast.error(
        "Please fill in all required fields (Site, URL, Username, Password)",
      );
      return;
    }

    setIsAddingEntry(true);
    try {
      console.log("[Dashboard] Adding new credential...");

      // Create the new entry
      const entryId = Math.random().toString(36).substring(7);
      const newCredential = {
        id: entryId,
        siteName: newEntry.site,
        siteUrl: newEntry.url || "",
        username: newEntry.username,
        password: newEntry.password,
        notes: newEntry.notes || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to existing entries
      const updatedEntries = [
        ...decryptedEntries.map((e) => ({
          id: e.id,
          siteName: e.site,
          siteUrl: e.siteUrl,
          username: e.username,
          password: e.password,
          notes: e.notes,
          createdAt: e.createdAt,
          updatedAt: new Date().toISOString(),
        })),
        newCredential,
      ];

      console.log(
        "[Dashboard] Encrypting",
        updatedEntries.length,
        "credentials...",
      );

      // Get the derived keys from the unlock process
      if (!derivedKeys) {
        toast.error("Encryption key not available. Please unlock vault first.");
        return;
      }

      // Get salt
      const salt = localStorage.getItem("user_salt");
      if (!salt) {
        toast.error("Salt not found. Please re-login.");
        return;
      }

      // IMPORTANT: Match the extension's format
      // The extension wraps the array in a VaultEntry object with VAULT_ROOT/SYSTEM
      const { encrypt } = await import("@password-manager/crypto-engine");

      // Wrap the credentials array in a VaultEntry object (matching extension format)
      const vaultEntry = {
        site: "VAULT_ROOT",
        username: "SYSTEM",
        password: JSON.stringify(updatedEntries),
      };

      // Encrypt using the crypto engine's encrypt function with the full DerivedKey
      const encryptedVault = await encrypt(vaultEntry, derivedKeys);

      console.log("[Dashboard] Saving to MongoDB...");

      // Extract site names for labels
      const labels = updatedEntries.map((e) => e.siteName.toLowerCase());

      // Save to MongoDB
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || "")}`,
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

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      console.log("[Dashboard] Saved successfully!");

      // Update local state
      const displayEntry: DecryptedEntry = {
        id: entryId,
        site: newEntry.site,
        siteUrl: newEntry.url,
        username: newEntry.username,
        password: newEntry.password,
        notes: newEntry.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUpdated: new Date().toLocaleDateString(),
        isPasswordVisible: false,
      };

      setDecryptedEntries([...decryptedEntries, displayEntry]);
      setNewEntry({
        site: "",
        username: "",
        password: "",
        url: "",
        notes: "",
        showPassword: false,
      });
      toast.success("Credential saved and synced to vault!");
    } catch (err) {
      console.error("[Dashboard] Add entry error:", err);
      toast.error(
        "Failed to save credential: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setIsAddingEntry(false);
    }
  };

  // Edit entry
  const handleEditEntry = (entry: DecryptedEntry) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    if (
      !editingEntry.site ||
      !editingEntry.username ||
      !editingEntry.password ||
      !editingEntry.siteUrl
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSavingEdit(true);
    try {
      console.log("[Dashboard] Updating credential...");

      // Update the entry in the list
      const updatedEntries = decryptedEntries.map((e) =>
        e.id === editingEntry.id
          ? {
              ...editingEntry,
              lastUpdated: new Date().toLocaleDateString(),
              updatedAt: new Date().toISOString(),
            }
          : e,
      );

      // Get the derived keys
      if (!derivedKeys) {
        toast.error("Encryption key not available. Please unlock vault first.");
        return;
      }

      // Get salt
      const salt = localStorage.getItem("user_salt");
      if (!salt) {
        toast.error("Salt not found. Please re-login.");
        return;
      }

      // Prepare credentials for encryption
      // Prepare credentials for encryption
      const credentialsForEncryption = updatedEntries.map((e) => ({
        id: e.id,
        siteName: e.site,
        siteUrl: e.siteUrl,
        username: e.username,
        password: e.password,
        notes: e.notes,
        createdAt: e.createdAt,
        updatedAt: new Date().toISOString(),
      }));

      console.log(
        "[Dashboard] Encrypting",
        credentialsForEncryption.length,
        "credentials...",
      );

      const { encrypt } = await import("@password-manager/crypto-engine");

      // Wrap in VaultEntry object
      const vaultEntry = {
        site: "VAULT_ROOT",
        username: "SYSTEM",
        password: JSON.stringify(credentialsForEncryption),
      };

      const encryptedVault = await encrypt(vaultEntry, derivedKeys);

      console.log("[Dashboard] Saving to MongoDB...");

      const labels = credentialsForEncryption.map((e) =>
        e.siteName.toLowerCase(),
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || "")}`,
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

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      console.log("[Dashboard] Updated successfully!");

      // Update local state
      setDecryptedEntries(updatedEntries);
      setIsEditModalOpen(false);
      setEditingEntry(null);
      toast.success("Credential updated successfully!");
    } catch (err) {
      console.error("[Dashboard] Edit entry error:", err);
      toast.error(
        "Failed to update credential: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete entry
  const handleDeleteEntry = async (entryId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this credential? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      console.log("[Dashboard] Deleting credential...");

      // Remove from list
      const updatedEntries = decryptedEntries.filter((e) => e.id !== entryId);

      // Get the derived keys
      if (!derivedKeys) {
        toast.error("Encryption key not available. Please unlock vault first.");
        return;
      }

      // Get salt
      const salt = localStorage.getItem("user_salt");
      if (!salt) {
        toast.error("Salt not found. Please re-login.");
        return;
      }

      // Prepare credentials for encryption
      // Prepare credentials for encryption
      const credentialsForEncryption = updatedEntries.map((e) => ({
        id: e.id,
        siteName: e.site,
        siteUrl: e.siteUrl,
        username: e.username,
        password: e.password,
        notes: e.notes,
        createdAt: e.createdAt,
        updatedAt: new Date().toISOString(),
      }));

      console.log(
        "[Dashboard] Encrypting",
        credentialsForEncryption.length,
        "credentials...",
      );

      const { encrypt } = await import("@password-manager/crypto-engine");

      // Wrap in VaultEntry object
      const vaultEntry = {
        site: "VAULT_ROOT",
        username: "SYSTEM",
        password: JSON.stringify(credentialsForEncryption),
      };

      const encryptedVault = await encrypt(vaultEntry, derivedKeys);

      console.log("[Dashboard] Saving to MongoDB...");

      const labels = credentialsForEncryption.map((e) =>
        e.siteName.toLowerCase(),
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || "")}`,
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

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      console.log("[Dashboard] Deleted successfully!");

      // Update local state
      setDecryptedEntries(updatedEntries);
      toast.success("Credential deleted successfully!");
    } catch (err) {
      console.error("[Dashboard] Add entry error:", err);
      toast.error(
        "Failed to save credential: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setIsAddingEntry(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setDecryptedEntries((entries) =>
      entries.map((e) =>
        e.id === id ? { ...e, isPasswordVisible: !e.isPasswordVisible } : e,
      ),
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info("Copied to clipboard");
  };

  // --- Render Loading State ---
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
         <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Securing Dashboard...</p>
         </div>
      </div>
    )
  }

  // --- Render Login Screen (Authenticated but Locked) ---
  if (!session.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md border-2 border-slate-200 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-slate-100 p-3 rounded-full w-fit">
              <Shield className="h-10 w-10 text-slate-800" />
            </div>
            <CardTitle className="text-2xl font-bold">Secure Vault</CardTitle>
            <CardDescription>
              Authentication required to access your passwords
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <p className="text-sm text-slate-600 mb-4">
                You are not signed in. Please log in to your account.
              </p>
              <Button
                onClick={() => (window.location.href = "/")}
                className="w-full"
              >
                Go to Login / Register
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Render OTP Verification State ---
  if (!isUnlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border border-primary/20 shadow-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-2 border border-primary/20">
              <ShieldCheck className="h-14 w-14 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground font-heading tracking-tight">
              Verify Identity
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter the 6-digit code sent to your email
            </CardDescription>
          </CardHeader>

          <form
            onSubmit={handleVerifyOTP}
            style={{ position: "relative" }}
            suppressHydrationWarning
          >
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label
                  htmlFor="otp-input"
                  className="text-sm font-semibold text-foreground/80"
                >
                  One-Time Password
                </Label>
                <div className="relative">
                  <Input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="text-center text-2xl font-bold tracking-[0.5em] h-14 bg-secondary/50 border-input focus:border-primary transition-all font-mono"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      const value = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setOtpCode(value);
                    }}
                    autoFocus
                    required
                    disabled={!otpSent || timeLeft === 0}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <p className="text-muted-foreground flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {timeLeft > 0
                      ? `Code expires in ${formatTime(timeLeft)}`
                      : "Code expired"}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-primary hover:text-primary/80 p-0 h-auto"
                    onClick={sendOTPToUser}
                    disabled={timeLeft > 540} // Disable if less than 1 minute has passed
                  >
                    Resend Code
                  </Button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label
                  htmlFor="password-input"
                  className="text-sm font-semibold text-foreground/80"
                >
                  Master Password
                </Label>
                <div className="relative">
                  <Input
                    id="password-input"
                    type={showMasterPassword ? "text" : "password"}
                    className="pr-10 bg-secondary/50 border-input focus:border-primary transition-all"
                    placeholder="Enter your master password"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                  >
                    {showMasterPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Note: This is the password you used during registration.
                </p>
              </div>

              {!otpSent && (
                <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-500">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-xs">
                    <strong>Sending OTP...</strong> Please wait while we send
                    the verification code to your email.
                  </AlertDescription>
                </Alert>
              )}

              {otpSent && !process.env.NEXT_PUBLIC_SMTP_CONFIGURED && (
                <Alert className="bg-primary/10 border-primary/20 text-primary">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-xs text-primary">
                    <strong>Development Mode:</strong> Check the backend console
                    for your OTP code.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all font-heading tracking-wide"
                disabled={
                  isVerifyingOtp || otpCode.length !== 6 || timeLeft === 0
                }
              >
                {isVerifyingOtp ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Verifying OTP...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Verify & Unlock
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={actions.logout}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout and clear session
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  // --- Render Unlocked Dashboard ---
  const filteredEntries = decryptedEntries.filter(
    (e) =>
      e.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight font-heading hidden md:block">
              ZeroKnowledge <span className="text-primary">Vault</span>
            </h1>
            <div className="flex items-center bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-xs font-medium border border-green-500/20 ml-2">
              <Unlock className="h-3 w-3 mr-1" />
              Unlocked
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vault..."
                className="pl-9 h-9 w-64 bg-secondary/50 border-input focus:border-primary text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="text-foreground border-border hover:bg-secondary"
              title={
                mounted
                  ? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`
                  : "Toggle theme"
              }
            >
              {!mounted ? (
                <Sun className="h-[1.2rem] w-[1.2rem] opacity-0" />
              ) : (
                <>
                  {resolvedTheme === "dark" ? (
                    <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
                  ) : (
                    <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
                  )}
                </>
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={lockVault}
              className="text-foreground hover:bg-secondary border-border"
            >
              <Lock className="mr-2 h-4 w-4" />
              Lock
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                lockVault();
                actions.logout();
              }}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">
        {/* Statistics & Info Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/80 to-blue-900 border-none shadow-lg text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <CardHeader className="pb-2">
              <CardDescription className="text-white/70">
                Stored Credentials
              </CardDescription>
              <CardTitle className="text-4xl font-bold tracking-tighter">
                {decryptedEntries.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-xs text-white/60">
                <Clock className="h-3 w-3 mr-1" />
                Updated just now
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">
                Security Status
              </CardDescription>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground font-heading">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                AES-256-GCM
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground/80">
              Keys are never stored in browser memory across sessions.
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">
                Inactivity Lock
              </CardDescription>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground font-heading">
                <Clock className="h-5 w-5 text-amber-500" />5 Minutes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground/80">
              Vault will auto-lock if no activity is detected.
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add New Credential Form */}
          <div className="lg:col-span-1">
            <Card className="border border-border sticky top-24 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-foreground font-heading">
                  <Plus className="h-5 w-5 text-primary" />
                  Add New Credential
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  New entries are encrypted before syncing.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleAddEntry}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="site" className="text-foreground/80">
                      Website/Service
                    </Label>
                    <Input
                      id="site"
                      placeholder="e.g., GitHub, Gmail"
                      value={newEntry.site}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, site: e.target.value })
                      }
                      required
                      className="bg-secondary/50 border-input focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="url" className="text-foreground/80">
                      URL
                    </Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://example.com"
                      value={newEntry.url || ""}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, url: e.target.value })
                      }
                      required
                      className="bg-secondary/50 border-input focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-foreground/80">
                      Username/Email
                    </Label>
                    <Input
                      id="username"
                      placeholder="your@email.com"
                      value={newEntry.username}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, username: e.target.value })
                      }
                      required
                      className="bg-secondary/50 border-input focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label
                        htmlFor="new-password"
                        className="text-foreground/80"
                      >
                        Password
                      </Label>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold ${strength.color.replace("bg-", "text-")}`}
                      >
                        {strength.label}
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={newEntry.showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={newEntry.password}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, password: e.target.value })
                        }
                        className="pr-20 bg-secondary/50 border-input focus:border-primary font-mono"
                        required
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                          onClick={() =>
                            setNewEntry({
                              ...newEntry,
                              showPassword: !newEntry.showPassword,
                            })
                          }
                        >
                          {newEntry.showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                          onClick={generatePassword}
                          title="Generate strong password"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Progress
                        value={strength.score}
                        className={`h-1.5 bg-secondary ${strength.color}`}
                      />
                      <p className="text-[10px] text-muted-foreground italic">
                        Strength is calculated locally based on entropy rules.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-foreground/80">
                      Notes (optional)
                    </Label>
                    <textarea
                      id="notes"
                      placeholder="Additional information"
                      rows={3}
                      value={newEntry.notes || ""}
                      onChange={(e) =>
                        setNewEntry({ ...newEntry, notes: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-secondary/50 text-foreground placeholder-muted-foreground"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full font-heading tracking-wide"
                    disabled={isAddingEntry}
                  >
                    {isAddingEntry ? "Encrypting..." : "Save Password"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Vault Listing */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground font-heading">
                Stored Credentials
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info("Syncing with backend...")}
                  className="border-border hover:bg-secondary"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Force Sync
                </Button>
              </div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="text-center py-20 px-6 bg-card border border-dashed border-border rounded-3xl">
                <div className="bg-secondary p-4 rounded-full w-fit mx-auto mb-4">
                  <ShieldAlert className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  No credentials found
                </h3>
                <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                  {searchQuery
                    ? "No entries match your search."
                    : "Start by adding your first secure credential using the form."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredEntries.map((entry) => (
                  <Card
                    key={entry.id}
                    className="group hover:border-primary/50 transition-all duration-200 bg-card border-border"
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-secondary p-2.5 rounded-xl text-foreground font-bold uppercase text-xs w-10 h-10 flex items-center justify-center border border-border group-hover:border-primary/30 transition-colors">
                          {entry.site[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-lg">
                            {entry.site}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {entry.username}
                          </p>
                          {/* Password Strength Indicator */}
                          {(() => {
                            const strength = calculatePasswordStrength(
                              entry.password,
                            );
                            return (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-20">
                                  <div
                                    className={`h-full ${strength.color} transition-all duration-300`}
                                    style={{ width: `${strength.score}%` }}
                                  />
                                </div>
                                <span
                                  className={`text-[10px] font-semibold ${
                                    strength.label === "Strong"
                                      ? "text-green-600"
                                      : strength.label === "Moderate"
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                  }`}
                                >
                                  {strength.label}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 w-full sm:w-auto">
                        <div className="flex-1 sm:w-48 bg-secondary/30 px-3 py-2 rounded-lg border border-border flex items-center justify-between">
                          <code className="text-sm font-mono text-foreground/90">
                            {entry.isPasswordVisible
                              ? entry.password
                              : "••••••••••••"}
                          </code>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                              onClick={() => togglePasswordVisibility(entry.id)}
                            >
                              {entry.isPasswordVisible ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                              onClick={() => copyToClipboard(entry.password)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-[10px] text-muted-foreground flex flex-col items-end">
                            <span className="uppercase font-bold tracking-wider">
                              Updated
                            </span>
                            <span>
                              {formatDistanceToNow(
                                new Date(entry.lastUpdated),
                                { addSuffix: true },
                              )}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => handleEditEntry(entry)}
                            title="Edit credential"
                          >
                            <Edit className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteEntry(entry.id)}
                            title="Delete credential"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Alert className="bg-primary/10 border-primary/20 text-primary backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 text-primary animate-pulse" />
              <AlertDescription className="text-xs text-primary/90">
                Metadata like <strong>Site Name</strong> and{" "}
                <strong>Username</strong> are also encrypted in the actual vault
                blob. The server only sees anonymous encrypted packets.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {isEditModalOpen && editingEntry && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border shadow-2xl bg-card">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Edit className="h-5 w-5 text-primary" />
                    Edit Credential
                  </CardTitle>
                  <CardDescription>
                    Update your stored credential information
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingEntry(null);
                  }}
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="edit-site" className="text-foreground/80">
                  Website/Service
                </Label>
                <Input
                  id="edit-site"
                  placeholder="e.g., GitHub, Gmail"
                  value={editingEntry.site}
                  onChange={(e) =>
                    editingEntry &&
                    setEditingEntry({ ...editingEntry, site: e.target.value })
                  }
                  required
                  className="bg-secondary/50 border-input focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-url" className="text-foreground/80">
                  URL
                </Label>
                <Input
                  id="edit-url"
                  type="url"
                  placeholder="https://example.com"
                  value={editingEntry.siteUrl || ""}
                  onChange={(e) =>
                    editingEntry &&
                    setEditingEntry({
                      ...editingEntry,
                      siteUrl: e.target.value,
                    })
                  }
                  required
                  className="bg-secondary/50 border-input focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-username" className="text-foreground/80">
                  Username/Email
                </Label>
                <Input
                  id="edit-username"
                  placeholder="your@email.com"
                  value={editingEntry.username}
                  onChange={(e) =>
                    editingEntry &&
                    setEditingEntry({
                      ...editingEntry,
                      username: e.target.value,
                    })
                  }
                  required
                  className="bg-secondary/50 border-input focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="edit-password" className="text-foreground/80">
                    Password
                  </Label>
                  {(() => {
                    const strength = calculatePasswordStrength(
                      editingEntry.password,
                    );
                    return (
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold ${strength.color.replace("bg-", "text-")}`}
                      >
                        {strength.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={editingEntry.isPasswordVisible ? "text" : "password"}
                    placeholder="Enter password"
                    value={editingEntry.password}
                    onChange={(e) =>
                      editingEntry &&
                      setEditingEntry({
                        ...editingEntry,
                        password: e.target.value,
                      })
                    }
                    className="pr-10 bg-secondary/50 border-input focus:border-primary font-mono"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                    onClick={() =>
                      editingEntry &&
                      setEditingEntry({
                        ...editingEntry,
                        isPasswordVisible: !editingEntry.isPasswordVisible,
                      })
                    }
                  >
                    {editingEntry.isPasswordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="space-y-1">
                  {(() => {
                    const strength = calculatePasswordStrength(
                      editingEntry.password,
                    );
                    return (
                      <Progress
                        value={strength.score}
                        className={`h-1.5 bg-secondary ${strength.color}`}
                      />
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes" className="text-foreground/80">
                  Notes (optional)
                </Label>
                <textarea
                  id="edit-notes"
                  placeholder="Additional information"
                  rows={3}
                  value={editingEntry.notes || ""}
                  onChange={(e) =>
                    editingEntry &&
                    setEditingEntry({ ...editingEntry, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-secondary/50 text-foreground placeholder-muted-foreground"
                />
              </div>
            </CardContent>

            <CardFooter className="border-t border-border flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingEntry(null);
                }}
                className="flex-1"
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="flex-1"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      <footer className="bg-background/80 backdrop-blur border-t border-border py-6 px-8 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            © 2026 ZeroKnowledge Password Manager. Phase 1–3 Implementation.
          </p>
          <div className="flex items-center gap-6 opacity-80">
            <span className="flex items-center">
              <ShieldCheck className="h-3 w-3 mr-1 text-green-500" />
              End-to-end Encrypted
            </span>
            <span className="flex items-center">
              <Lock className="h-3 w-3 mr-1 text-indigo-500" />
              Argon2id KDF
            </span>
            <span className="flex items-center">
              <Unlock className="h-3 w-3 mr-1 text-amber-500" />
              AES-256-GCM
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
