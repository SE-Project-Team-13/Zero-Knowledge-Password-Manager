"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { usePasswordAging } from "@/hooks/usePasswordAging";
import { useVault, type DecryptedEntry } from "@/context/VaultContext";
import { EditCredentialModal } from "@/components/EditCredentialModal";
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
import {
  Shield,
  Lock,
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
  Loader2,
  Edit,
  FileKey,
  Share2,
  Inbox
} from "lucide-react";
import { toast } from "sonner";
import { copyWithAutoClear } from "@/lib/clipboard";
import { useRouter } from "next/navigation";
import { buildApiUrl } from "@/lib/api-base-url";
import { formatTimestampIST, formatDateTimeIST } from "@/lib/formatIST";
import {
  createShareEnvelope,
  decryptShareEnvelope,
  ensureShareKeyPair,
  verifyShareEnvelopeSignature,
} from "@/lib/shareCrypto";
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

import { useCallback } from "react";

// --- Constants ---
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * DashboardPage: The main authenticated view for managing vault entries.
 */
export default function DashboardPage() {
  const [session, actions] = useVaultSync();
  const router = useRouter();
  const {
    decryptedEntries,
    setDecryptedEntries,
    isUnlocked: isVaultUnlocked,
    unlockVault: contextUnlockVault,
    addEntry,
    updateEntry,
    deleteEntry,
    snoozeEntry,
    syncNow,
    isSyncing,
    lastSyncedAt,
    syncError,
    pendingSyncCount,
    syncConflict,
    resolveSyncConflict,
  } = useVault();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // UI State
  const [isInitializing, setIsInitializing] = useState(!isVaultUnlocked);
  /* Local state removed - using isVaultUnlocked from context */

  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Vault Data (Managed by Context)
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
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [sharingEntry, setSharingEntry] = useState<DecryptedEntry | null>(null);
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [isSendingShare, setIsSendingShare] = useState(false);
  const [incomingShares, setIncomingShares] = useState<Array<{
    id: string;
    encryptedSessionKey: string;
    ciphertext: string;
    iv: string;
    signature: string;
    senderSigningPublicKey: string;
    recipientEmail: string;
    sender: { email: string; fullName: string };
    createdAt: string;
  }>>([]);
  const [incomingOpen, setIncomingOpen] = useState(false);
  const [trustWarning, setTrustWarning] = useState<string | null>(null);

  // Auto-logout after inactivity
  const lastActivityRef = useRef<number>(Date.now());

  // Send OTP to user's email
  const sendOTPToUser = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const token = typeof window !== 'undefined' && localStorage.getItem("auth_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        buildApiUrl("/otp/send"),
        {
          method: "POST",
          headers,
          body: JSON.stringify({ email: session.email }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setOtpSent(true);
        setTimeLeft(600); // Reset timer to 10 minutes
        toast.success(data.message || "OTP sent to your email");
      } else {
        const error = await response.json();
        console.error("[OTP] Send failed with details:", error);
        toast.error(error.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      toast.error("Failed to send OTP. Please try again.");
    }
  }, [session.email]);

  const unlockVault = useCallback(async () => {
    setIsVerifyingOtp(true);
    try {
      // 1. Ensure we have the master password
      let passwordToUse = masterPassword.trim();

      if (!passwordToUse) {
        const sessionPassword = sessionStorage.getItem("session_master_password");
        if (sessionPassword) {
          passwordToUse = sessionPassword;
          setMasterPassword(sessionPassword);
        } else {
          console.log("[Dashboard] Master password not in storage, manual entry required.");
          setIsVerifyingOtp(false);
          return;
        }
      }

      sessionStorage.setItem("session_master_password", passwordToUse);

      await contextUnlockVault();

      // Removed setIsUnlocked(true) as we rely on context now
      toast.success("Vault unlocked successfully");
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error("Failed to unlock vault");
    } finally {
      setIsVerifyingOtp(false);
    }
  }, [masterPassword, contextUnlockVault]);

  // Send OTP on component mount and handle initialization
  useEffect(() => {
    // 1. Check if user is theoretically logged in (has token)
    const hasToken = typeof window !== 'undefined' && localStorage.getItem("auth_token")

    if (!hasToken) {
      setIsInitializing(false)
      return
    }

    // 2. If has token, wait for useVaultSync to verify it and set isAuthenticated
    if (!session.isAuthenticated) {
      return
    }

    // NEW: Check if vault is already unlocked to prevent re-initialization loops
    if (isVaultUnlocked) {
      setOtpVerified(true);
      setOtpSent(true);
      setIsInitializing(false);
      return;
    }

    // 3. Check if there's a temp password from login (first-time login flow)
    const tempPassword = sessionStorage.getItem("temp_master_password")
    if (tempPassword && !masterPassword) {
      setMasterPassword(tempPassword)
    }

    // 4. User is authenticated. Check OTP status.
    if (!otpSent) {
      const isVerified = sessionStorage.getItem("otp_verified") === "true"
      if (isVerified) {
        setOtpVerified(true)
        setOtpSent(true)

        // Check if we have master password in session
        const sessionPassword = sessionStorage.getItem("session_master_password")
        if (sessionPassword) {
          setMasterPassword(sessionPassword)
          unlockVault().finally(() => {
            setIsInitializing(false)
          })
        } else {
          console.log('[Dashboard] No session password - showing empty dashboard')
          setIsInitializing(false)
        }
      } else {
        // Not verified
        sendOTPToUser()
        setIsInitializing(false)
      }
    } else {
      setIsInitializing(false)
    }
  }, [session.isAuthenticated, session.email, otpSent, isVaultUnlocked, masterPassword, sendOTPToUser, unlockVault]);

  const ensureSharingKeysAndSync = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token || !session.isAuthenticated) return;
    try {
      const { publicKey, signingPublicKey } = await ensureShareKeyPair();
      await fetch(buildApiUrl("/share/public-key"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ publicKey, signingPublicKey }),
      });
      const incomingRes = await fetch(buildApiUrl("/share/incoming"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (incomingRes.ok) {
        const payload = await incomingRes.json();
        setIncomingShares(payload.shares || []);
      }
    } catch (error) {
      console.warn("[Share] setup failed", error);
    }
  }, [session.isAuthenticated]);

  useEffect(() => {
    if (session.isAuthenticated && isVaultUnlocked) {
      void ensureSharingKeysAndSync();
    }
  }, [session.isAuthenticated, isVaultUnlocked, ensureSharingKeysAndSync]);

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


  // Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return;

    setIsVerifyingOtp(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const token = typeof window !== 'undefined' && localStorage.getItem("auth_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        buildApiUrl("/otp/verify"),
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: session.email,
            code: otpCode,
          }),
        },
      );

      if (response.ok) {
        setOtpVerified(true);
        sessionStorage.setItem("otp_verified", "true"); // Persist verification

        // Dispatch custom event to notify layout about OTP verification
        window.dispatchEvent(new Event("otpVerified"));

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

  // Auto-logout on inactivity
  useEffect(() => {
    if (!isVaultUnlocked) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_TIMEOUT) {
        toast.info("Logged out due to inactivity");
        actions.logout();
        window.location.href = "/";
      }
    }, 60000); // Check every minute

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      clearInterval(checkInactivity);
    };
  }, [isVaultUnlocked, actions]);

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
      await addEntry({
        site: newEntry.site,
        username: newEntry.username,
        password: newEntry.password,
        url: newEntry.url,
        notes: newEntry.notes,
      });

      setNewEntry({
        site: "",
        username: "",
        password: "",
        url: "",
        notes: "",
        showPassword: false,
      });
      // Context shows success toast
    } catch (err) {
      console.error("[Dashboard] Add entry error:", err);
    } finally {
      setIsAddingEntry(false);
    }
  };

  // Edit entry
  const handleEditEntry = (entry: DecryptedEntry) => {
    setEditingEntry(entry);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (updatedEntry: DecryptedEntry) => {
    setIsSavingEdit(true);
    try {
      await updateEntry(updatedEntry);
      setIsEditModalOpen(false);
      setEditingEntry(null);
    } catch (err) {
      console.error("[Dashboard] Edit entry error:", err);
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
      await deleteEntry(entryId);
    } catch (err) {
      console.error("[Dashboard] Delete entry error:", err);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setDecryptedEntries((entries) =>
      entries.map((e) =>
        e.id === id ? { ...e, isPasswordVisible: !e.isPasswordVisible } : e,
      ),
    );
  };

  // Helper functions moved to usePasswordAging hook
  const { isPasswordOld, isSnoozed } = usePasswordAging();

  const copyToClipboard = (text: string) => {
    void copyWithAutoClear(text);
  };

  const handleManualSync = async () => {
    const updated = await syncNow();
    if (updated) {
      toast.success("Vault synced with latest changes");
      return;
    }
    if (syncError) {
      toast.error(syncError);
      return;
    }
    toast.info("Already up to date");
  };

  const formatLastSynced = (ts: number | null) => formatTimestampIST(ts);

  const handleResolveConflict = async (choice: "local" | "server") => {
    setIsResolvingConflict(true);
    try {
      const ok = await resolveSyncConflict(choice);
      if (ok) {
        toast.success(choice === "local" ? "Kept local changes and overwrote server copy" : "Kept server version");
      } else {
        toast.error("Failed to resolve conflict. Please try again.");
      }
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleSendShare = async () => {
    if (!sharingEntry || !shareRecipientEmail.trim()) return;
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    setIsSendingShare(true);
    try {
      const publicKeyRes = await fetch(buildApiUrl(`/share/public-key/${encodeURIComponent(shareRecipientEmail.trim().toLowerCase())}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!publicKeyRes.ok) {
        const err = await publicKeyRes.json().catch(() => ({}));
        throw new Error(err.error || "Recipient public key not available");
      }
      const recipient = await publicKeyRes.json();
      const envelope = await createShareEnvelope(
        {
          site: sharingEntry.site,
          siteUrl: sharingEntry.siteUrl,
          username: sharingEntry.username,
          password: sharingEntry.password,
          notes: sharingEntry.notes || "",
        },
        recipient.publicKey,
        shareRecipientEmail.trim().toLowerCase(),
      );
      const sendRes = await fetch(buildApiUrl("/share/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recipientEmail: shareRecipientEmail.trim().toLowerCase(),
          encryptedSessionKey: envelope.encryptedSessionKey,
          ciphertext: envelope.ciphertext,
          iv: envelope.iv,
          signature: envelope.signature,
          senderSigningPublicKey: envelope.senderSigningPublicKey,
        }),
      });
      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send share");
      }
      toast.success("Password shared securely");
      setSharingEntry(null);
      setShareRecipientEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Share failed");
    } finally {
      setIsSendingShare(false);
    }
  };

  const handleAcceptShare = async (shareId: string) => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    const share = incomingShares.find((s) => s.id === shareId);
    if (!share) return;
    try {
      const signatureOk = await verifyShareEnvelopeSignature(
        {
          encryptedSessionKey: share.encryptedSessionKey,
          ciphertext: share.ciphertext,
          iv: share.iv,
          signature: share.signature,
        },
        share.senderSigningPublicKey,
        share.recipientEmail || session.email || "",
      );
      if (!signatureOk) {
        const warning = `Signature verification failed for share from ${share.sender.email}. Message may be tampered.`;
        setTrustWarning(warning);
        toast.error("Security warning: shared item failed signature verification");
        return;
      }
      const decrypted = await decryptShareEnvelope({
        encryptedSessionKey: share.encryptedSessionKey,
        ciphertext: share.ciphertext,
        iv: share.iv,
      });
      await addEntry({
        site: decrypted.site || "Shared Credential",
        username: decrypted.username || "",
        password: decrypted.password || "",
        url: decrypted.siteUrl || "",
        notes: decrypted.notes || `Shared by ${share.sender.email}`,
      });
      await fetch(buildApiUrl(`/share/${encodeURIComponent(shareId)}/accept`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setIncomingShares((prev) => prev.filter((s) => s.id !== shareId));
      toast.success("Share accepted and added to vault");
    } catch {
      toast.error("Failed to accept share");
    }
  };

  const handleRejectShare = async (shareId: string) => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    await fetch(buildApiUrl(`/share/${encodeURIComponent(shareId)}/reject`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setIncomingShares((prev) => prev.filter((s) => s.id !== shareId));
  };

  // --- Render Loading State ---
  if (isLoggingOut || !mounted || isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }
  // Show loading screen during initialization OR during automatic unlock
  if (isInitializing || (isVerifyingOtp && otpVerified)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background relative">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">
            {isVerifyingOtp ? "Unlocking your vault..." : "Securing Dashboard..."}
          </p>
        </div>
      </div>
    )
  }

  // --- Render Login Screen (Authenticated but Locked) ---
  if (!session.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 relative">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
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

  // --- Render OTP Verification & Lock State ---
  if (!isVaultUnlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md border border-primary/20 shadow-2xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-2 border border-primary/20">
              <ShieldCheck className="h-14 w-14 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground font-heading tracking-tight">
              {otpVerified ? "Unlock Vault" : "Verify Identity"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {otpVerified
                ? "Enter your master password to decrypt your vault"
                : "Enter the 6-digit code sent to your email"}
            </CardDescription>
          </CardHeader>

          <form
            onSubmit={otpVerified ? (e) => { e.preventDefault(); unlockVault(); } : handleVerifyOTP}
            style={{ position: "relative" }}
            suppressHydrationWarning
          >
            <CardContent className="space-y-6">
              {!otpVerified && (
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
              )}

              {otpVerified && (
                <div className="space-y-3">
                  <Label htmlFor="master-password-input" className="text-sm font-semibold text-foreground/80">
                    Master Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="master-password-input"
                      type={showMasterPassword ? "text" : "password"}
                      className="pl-10 pr-10 bg-secondary/50 border-input focus:border-primary transition-all font-mono"
                      placeholder="••••••••••••••••"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      required
                      disabled={isVerifyingOtp}
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
                      onClick={() => setShowMasterPassword(!showMasterPassword)}
                    >
                      {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Your master password is required to decrypt your vault locally.
                  </p>
                </div>
              )}



              {!otpVerified && !otpSent && (
                <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-500">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-xs">
                    <strong>Sending OTP...</strong> Please wait while we send
                    the verification code to your email.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all font-heading tracking-wide"
                disabled={
                  isVerifyingOtp || (!otpVerified && (otpCode.length !== 6 || timeLeft === 0))
                }
              >
                {isVerifyingOtp ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    {otpVerified ? "Unlocking Vault..." : "Verifying OTP..."}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    {otpVerified ? "Unlock Vault" : "Verify & Unlock"}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsLoggingOut(true);
                  actions.logout();
                  window.location.href = "/";
                }}
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
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
      {/* Breach Alert Banner */}
      {session.isBreached && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4 m-6 mb-0 rounded-r flex items-start gap-4">
          <div className="p-2 bg-destructive/20 rounded-full">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-destructive text-lg">Data Breach Detected</h3>
            <p className="text-sm text-destructive-foreground/90 mt-1 max-w-3xl">
              Your email address ({session.email}) was found in a data breach.
              This means your email and potentially other data (on other sites) were exposed.
              We recommend changing your Master Password immediately to ensure your vault remains secure.
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  // Ideally redirect to change password
                  toast.info("Password change feature coming soon. Please ensure your new password is strong.");
                }}
              >
                Change Master Password
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  try {
                    await actions.resolveBreach();
                    toast.success("Breach alert dismissed.");
                  } catch (err) {
                    toast.error("Failed to dismiss breach alert.");
                  }
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck className="w-32 h-32 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground font-heading">
              Secure Vault
            </CardTitle>
            <CardDescription className="text-muted-foreground flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Encrypted & Synced
            </CardDescription>
            <CardDescription className="text-xs mt-1">
              {isSyncing
                ? "Sync in progress..."
                : pendingSyncCount > 0
                  ? `${pendingSyncCount} change(s) queued offline`
                : syncError
                  ? `Sync issue: ${syncError}`
                  : `Last synced at ${formatLastSynced(lastSyncedAt)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Credentials</p>
                <p className="text-2xl font-bold font-mono">
                  {decryptedEntries.length}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIncomingOpen(true)}>
              <Inbox className="mr-2 h-4 w-4" />
              Incoming ({incomingShares.length})
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* Main Content Area: Search & List */}
      <Card className="border-border bg-card/50 backdrop-blur-sm min-h-[500px]">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">My Passwords</CardTitle>
              <CardDescription>
                Manage your encrypted credentials
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-background/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileKey className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No credentials</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all hover:shadow-sm gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary">
                        {entry.site.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold truncate">{entry.site}</h4>
                        {/* Show siteUrl if it exists */}
                        <div className="text-xs text-blue-500 hover:text-blue-600 truncate mt-0.5">
                          <span className="text-muted-foreground mr-1">URL:</span>
                          {entry.siteUrl}
                        </div>
                        <p className="text-sm font-mono mt-0.5 text-foreground">
                          <span className="text-muted-foreground mr-1 font-sans">Username:</span>
                          {entry.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <div className="relative group/pass">
                        <div className="h-9 px-3 min-w-[120px] bg-secondary/50 rounded-md flex items-center font-mono text-sm">
                          {entry.isPasswordVisible
                            ? entry.password
                            : "••••••••••••"}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePasswordVisibility(entry.id)}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
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
                        onClick={() => copyToClipboard(entry.password)}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>

                      <div className="h-4 w-px bg-border mx-1" />

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSharingEntry(entry)}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        title="Share"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/password-manager?edit=${entry.id}`)}
                        className="h-9 w-9 text-muted-foreground hover:text-primary"
                        title="Edit in Password Manager"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password Modal - still useful if we want to trigger it from dashboard alerts */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Edit Credential Modal */}
      <EditCredentialModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        entry={editingEntry}
        onSave={handleSaveEdit}
      />

      {syncConflict && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-6xl border-primary/30">
            <CardHeader>
              <CardTitle>Sync Conflict Detected</CardTitle>
              <CardDescription>
                Two devices changed vault data at nearly the same time. Choose which version to keep as the new master copy.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-semibold mb-2">Your Local Version ({syncConflict.localEntries.length})</h4>
                <div className="max-h-64 overflow-auto space-y-2 text-sm">
                  {syncConflict.localEntries.slice(0, 8).map((entry) => (
                    <div key={`local-${entry.id}`} className="rounded border border-border/60 p-2">
                      <div className="font-medium">{entry.site}</div>
                      <div className="text-muted-foreground">{entry.username}</div>
                      <div className="text-xs text-muted-foreground">{entry.updatedAt}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-semibold mb-2">Server Version ({syncConflict.serverEntries.length})</h4>
                <div className="max-h-64 overflow-auto space-y-2 text-sm">
                  {syncConflict.serverEntries.slice(0, 8).map((entry) => (
                    <div key={`server-${entry.id}`} className="rounded border border-border/60 p-2">
                      <div className="font-medium">{entry.site}</div>
                      <div className="text-muted-foreground">{entry.username}</div>
                      <div className="text-xs text-muted-foreground">{entry.updatedAt}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button variant="outline" disabled={isResolvingConflict} onClick={() => handleResolveConflict("server")}>
                Keep Server Version
              </Button>
              <Button disabled={isResolvingConflict} onClick={() => handleResolveConflict("local")}>
                Keep My Version
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {sharingEntry && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Secure Share</CardTitle>
              <CardDescription>
                Share "{sharingEntry.site}" with a colleague using end-to-end encryption.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Recipient email"
                value={shareRecipientEmail}
                onChange={(e) => setShareRecipientEmail(e.target.value)}
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSharingEntry(null)} disabled={isSendingShare}>Cancel</Button>
              <Button onClick={handleSendShare} disabled={isSendingShare || !shareRecipientEmail.trim()}>
                {isSendingShare ? "Sharing..." : "Share Securely"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {incomingOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Incoming Shares</CardTitle>
              <CardDescription>Accept to decrypt and add credential to your vault.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-auto">
              {trustWarning && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{trustWarning}</AlertDescription>
                </Alert>
              )}
              {incomingShares.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending shares.</p>
              ) : incomingShares.map((share) => (
                <div key={share.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{share.sender.fullName || share.sender.email}</p>
                    <p className="text-xs text-muted-foreground">{share.sender.email}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTimeIST(share.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleRejectShare(share.id)}>Reject</Button>
                    <Button size="sm" onClick={() => handleAcceptShare(share.id)}>Accept</Button>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button variant="outline" onClick={() => setIncomingOpen(false)}>Close</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
