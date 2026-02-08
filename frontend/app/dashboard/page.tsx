"use client";

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sidebar } from "@/components/Sidebar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
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
  Loader2,
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Vault Data (In-Memory Only)
  const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>([]);
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

  // Auto-logout after inactivity
  const lastActivityRef = useRef<number>(Date.now());
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  // Initialization Logic
  useEffect(() => {
    const hasToken = typeof window !== "undefined" && localStorage.getItem("auth_token");

    if (!hasToken) {
      setIsInitializing(false);
      return;
    }

    if (!session.isAuthenticated) {
      return;
    }

    const tempPassword = sessionStorage.getItem("temp_master_password");
    if (tempPassword && !masterPassword) {
      setMasterPassword(tempPassword);
    }

    if (!otpSent) {
      const isVerified = sessionStorage.getItem("otp_verified") === "true";
      if (isVerified) {
        setOtpVerified(true);
        setOtpSent(true);

        const sessionPassword = sessionStorage.getItem("session_master_password");
        if (sessionPassword) {
          setMasterPassword(sessionPassword);
          unlockVault().finally(() => {
            setIsInitializing(false);
          });
        } else {
          console.log("[Dashboard] No session password - showing empty dashboard");
          setIsUnlocked(true);
          setIsInitializing(false);
        }
      } else {
        sendOTPToUser();
        setIsInitializing(false);
      }
    } else {
      setIsInitializing(false);
    }
  }, [session.isAuthenticated, session.email, otpSent]);

  // OTP Timer
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

  const sendOTPToUser = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/otp/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: session.email }),
        }
      );

      if (response.ok) {
        setOtpSent(true);
        setTimeLeft(600);
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

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return;

    setIsVerifyingOtp(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/otp/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: session.email,
            code: otpCode,
          }),
        }
      );

      if (response.ok) {
        setOtpVerified(true);
        sessionStorage.setItem("otp_verified", "true");
        toast.success("OTP verified successfully!");
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

  const unlockVault = async () => {
    setIsVerifyingOtp(true);
    try {
      let passwordToUse = masterPassword.trim();

      if (!passwordToUse) {
        const sessionPassword = sessionStorage.getItem("session_master_password");
        if (sessionPassword) {
          passwordToUse = sessionPassword;
          setMasterPassword(sessionPassword);
        } else {
          throw new Error("Master password not found. Please log in again.");
        }
      }

      if (!session.salt) {
        throw new Error("No salt found for user. Please re-login.");
      }

      const saltBuffer = new Uint8Array(
        session.salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      console.log("[Dashboard] Starting parallel unlock operations...");

      const keyDerivationPromise = deriveKey(passwordToUse, saltBuffer);
      const vaultFetchPromise = (async () => {
        return fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email || "")}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            },
          }
        );
      })();

      const [keys, response] = await Promise.all([keyDerivationPromise, vaultFetchPromise]);
      setDerivedKeys(keys);

      if (response.ok) {
        const data = await response.json();
        if (data && data.ciphertext && data.iv && data.salt) {
          const { decrypt } = await import("@password-manager/crypto-engine");
          const encryptedVault = {
            ciphertext: data.ciphertext,
            iv: data.iv,
            salt: data.salt,
            algorithm: "AES-256-GCM" as const,
            derivationAlgorithm: "Argon2id" as const,
          };

          let decryptedEntry: any;
          try {
            decryptedEntry = await decrypt(encryptedVault, keys);
          } catch (decryptErr) {
            const fallbackKeys = await deriveKey(session.email || "", saltBuffer);
            decryptedEntry = await decrypt(encryptedVault, fallbackKeys);
            setDerivedKeys(fallbackKeys);
          }

          let entries: any[] = [];
          if (Array.isArray(decryptedEntry)) {
            entries = decryptedEntry;
          } else if (decryptedEntry && typeof decryptedEntry === "object") {
            const possibleArrays = Object.values(decryptedEntry).filter((val) => Array.isArray(val));
            if (possibleArrays.length > 0) {
              entries = possibleArrays[0] as any[];
            } else {
              entries = [decryptedEntry];
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
              notes: entry.notes || "",
              createdAt: entry.createdAt || new Date().toISOString(),
              updatedAt: entry.updatedAt || entry.lastUpdated || new Date().toISOString(),
              lastUpdated: entry.updatedAt || entry.lastUpdated || new Date().toISOString(),
              isPasswordVisible: false,
            }));

          setDecryptedEntries(entriesWithVisibility);
        }
      }
      setIsUnlocked(true);
      sessionStorage.removeItem("temp_master_password");
      toast.success("Vault unlocked successfully");
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error("Failed to unlock vault");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ... rest of your component logic (handleAddEntry, handleEditEntry, etc)
  return (
    <div>
       {/* UI implementation continues here */}
    </div>
  );
}