"use client";

import type React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useVault, type DecryptedEntry } from "@/context/VaultContext";
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
  Inbox,
  ChevronDown,
  ChevronUp
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
import { maskPassword } from "@/lib/password-utils";
// --- Helpers ---

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

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Vault Data (Managed by Context)
  const [masterPassword, setMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);

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
  const [expandedUrls, setExpandedUrls] = useState<Record<string, boolean>>({});

  const toggleUrlExpansion = (url: string) => {
    setExpandedUrls(prev => ({ ...prev, [url]: !prev[url] }));
  };

  // Auto-logout after inactivity
  const lastActivityRef = useRef<number>(Date.now());



  const unlockVault = useCallback(async () => {
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
          return;
        }
      }

      sessionStorage.setItem("session_master_password", passwordToUse);

      await contextUnlockVault();

      // Removed setIsUnlocked(true) as we rely on context now
      toast.success("Vault unlocked successfully");
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error("Unlock failed. Please ensure your master password is correct.");
    }
  }, [masterPassword, contextUnlockVault]);

  // Send OTP on component mount and handle initialization
  useEffect(() => {
    // 1. Check if user is theoretically logged in (has token)
    const hasToken = typeof window !== 'undefined' && localStorage.getItem("auth_token")

    if (!hasToken) {
      return
    }

    // 2. If has token, wait for useVaultSync to verify it and set isAuthenticated
    if (!session.isAuthenticated) {
      return
    }

    // NEW: Check if vault is already unlocked to prevent re-initialization loops
    if (isVaultUnlocked) {
      return;
    }

    // 3. Check if there's a temp password from login (first-time login flow)
    const tempPassword = sessionStorage.getItem("temp_master_password")
    if (tempPassword && !masterPassword) {
      setMasterPassword(tempPassword)
    }

    // 4. User is authenticated. Check OTP status.
    const isVerified = sessionStorage.getItem("otp_verified") === "true"
    if (isVerified) {
      // Check if we have master password in session
      const sessionPassword = sessionStorage.getItem("session_master_password")
      if (sessionPassword) {
        setMasterPassword(sessionPassword)
        unlockVault()
      } else {
        console.log('[Dashboard] No session password - showing empty dashboard')
      }
    } else {
      // Not verified - redirect to OTP
      router.push("/otp")
    }
  }, [session.isAuthenticated, session.email, isVaultUnlocked, masterPassword, unlockVault, router]);

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
        toast.info("Session expired due to inactivity");
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

  const togglePasswordVisibility = (id: string) => {
    setDecryptedEntries((entries) =>
      entries.map((e) =>
        e.id === id ? { ...e, isPasswordVisible: !e.isPasswordVisible } : e,
      ),
    );
  };

  const copyToClipboard = (text: string) => {
    void copyWithAutoClear(text);
  };

  const formatLastSynced = (ts: number | null) => formatTimestampIST(ts);

  const handleResolveConflict = async (choice: "local" | "server") => {
    setIsResolvingConflict(true);
    try {
      const ok = await resolveSyncConflict(choice);
      if (ok) {
        toast.success(choice === "local" ? "Kept local changes and overwrote server copy" : "Kept server version");
      } else {
        toast.error("Unable to resolve conflict. Please refresh and try again.");
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
          url: sharingEntry.url,
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
        username: decrypted.username || "",
        password: decrypted.password || "",
        url: decrypted.url || decrypted.siteUrl || decrypted.site || "Shared Credential",
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

  // ---  // 5) Filter & Group entries
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return decryptedEntries;
    
    const searchLower = searchQuery.toLowerCase();
    return decryptedEntries.filter((entry) => {
      const urlMatch = entry.url?.toLowerCase().includes(searchLower) ?? false;
      const usernameMatch = entry.username?.toLowerCase().includes(searchLower) ?? false;
      const notesMatch = entry.notes?.toLowerCase().includes(searchLower) ?? false;

      return urlMatch || usernameMatch || notesMatch;
    });
  }, [decryptedEntries, searchQuery]);

  const groupedEntries = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      const urlKey = entry.url || "No URL";
      if (!acc[urlKey]) acc[urlKey] = [];
      acc[urlKey].push(entry);
      return acc;
    }, {} as Record<string, DecryptedEntry[]>);
  }, [filteredEntries]);

  const sortedUrls = useMemo(() => {
    return Object.keys(groupedEntries).sort((a, b) => {
      if (a === "No URL") return 1;
      if (b === "No URL") return -1;
      return a.localeCompare(b);
    });
  }, [groupedEntries]);

  // --- Render Loading State ---
  if (isLoggingOut || !mounted) {
    return null;
  }

  // --- Render Login Screen (Authenticated but Locked) ---
  if (!session.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md border-2 border-slate-200 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Zenith Vault</CardTitle>
            <CardDescription>
              Authentication required to access your passwords
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-6 bg-secondary/50 rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted-foreground mb-4">
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

  // --- Render Lock State ---
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
              Unlock Vault
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your master password to decrypt your vault
            </CardDescription>
          </CardHeader>

          <form
            onSubmit={(e) => { e.preventDefault(); unlockVault(); }}
            style={{ position: "relative" }}
            suppressHydrationWarning
          >
            <CardContent className="space-y-6">
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
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all font-heading tracking-wide"
              >
                <ShieldCheck className="mr-2 h-5 w-5" />
                Unlock Vault
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

  return (
    <div className="p-4 sm:p-8 pt-24 sm:pt-20 max-w-7xl mx-auto space-y-8 w-full">
      {/* Breach Alert Banner */}
      {session.isBreached && (
        <Alert variant="destructive" className="m-4 sm:m-6 mb-0 border-destructive/20 bg-destructive/10 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-destructive/10 to-transparent pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start gap-4 relative z-10">
            <div className="p-3 bg-destructive/20 rounded-xl shadow-inner">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-destructive text-lg font-heading tracking-tight">Security Alert: Data Breach Detected</h3>
              <p className="text-sm text-destructive-foreground/90 max-w-3xl leading-relaxed">
                Your email address (<span className="font-semibold">{session.email}</span>) was found in a data breach. 
                We recommend changing your master password immediately to ensure your vault remains secure.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full sm:w-auto font-semibold shadow-lg shadow-destructive/20"
                  onClick={() => {
                    toast.info("Password change feature coming soon. Please update your master password soon.");
                  }}
                >
                  Change Master Password
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={async () => {
                    try {
                      await actions.resolveBreach();
                      toast.success("Breach alert dismissed.");
                    } catch (err) {
                      toast.error("Failed to dismiss breach alert.");
                    }
                  }}
                >
                  Dismiss Alert
                </Button>
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Header and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck className="w-32 h-32 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground font-heading">
              Zenith Vault
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
            <Button variant="outline" size="sm" onClick={() => setIncomingOpen(true)}>
              <Inbox className="mr-2 h-4 w-4" />
              Incoming ({incomingShares.length})
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* Main Content Area: Search & List */}
        <Card className="border border-primary/50 bg-card/50 backdrop-blur-xl shadow-2xl shadow-primary/5">
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
              <div className="grid grid-cols-1 gap-4">
                {sortedUrls.map((url) => {
                  const entries = groupedEntries[url];
                  // Default to collapsed for all items
                  const isExpanded = expandedUrls[url] || false;
                  const hasMultiple = entries.length > 1;
                  const isRealUrl = url !== "No URL";
                  const faviconUrl = isRealUrl ? `https://www.google.com/s2/favicons?domain=${url}&sz=64` : "";

                  return (
                    <div key={url} className="space-y-2">
                       {/* Group Header for ALL sites */}
                       <div 
                         className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50 cursor-pointer hover:bg-secondary/50 transition-colors group/header"
                         onClick={() => toggleUrlExpansion(url)}
                       >
                         <div className="flex items-center gap-3 min-w-0 flex-1">
                           <div className="bg-primary/10 p-2 rounded-lg shrink-0 flex items-center justify-center h-8 w-8">
                             {isRealUrl ? (
                               <img 
                                 src={faviconUrl} 
                                 alt="" 
                                 className="h-5 w-5 rounded-sm object-contain"
                                 onError={(e) => {
                                   (e.target as HTMLImageElement).style.display = 'none';
                                   (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                 }}
                               />
                             ) : null}
                             <Shield className={`h-4 w-4 text-primary ${isRealUrl ? "hidden" : ""}`} />
                           </div>
                           <div className="min-w-0">
                             <p className="text-sm font-semibold truncate text-foreground">{url}</p>
                             <p className="text-xs text-muted-foreground">{entries.length} credential{entries.length !== 1 ? 's' : ''} stored</p>
                           </div>
                         </div>
                         
                         <div className="flex items-center pl-3">
                           {isExpanded ? (
                             <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover/header:text-primary" />
                           ) : (
                             <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-hover/header:text-primary" />
                           )}
                         </div>
                       </div>

                       {/* Expanded Entries */}
                       {isExpanded && (
                         <div className={`grid grid-cols-1 gap-3 ml-2 pl-4 border-l-2 border-primary/20 mt-2`}>
                           {entries.map((entry) => (
                             <div
                               key={entry.id}
                               className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border border-border/80 bg-card hover:border-primary transition-all hover:shadow-md gap-4"
                             >
                               <div className="flex items-center gap-4 min-w-0 flex-1">
                                 <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary">
                                   {entry.url.substring(0, 2).toUpperCase()}
                                 </div>
                                 <div className="min-w-0">
                               <h4 className="font-semibold truncate">{entry.url}</h4>
                               {/* Show URL only once - site/siteUrl are merged into url */}
                               <p className="text-sm font-mono mt-0.5 text-foreground">
                                 <span className="text-muted-foreground mr-1 font-sans">Username:</span>
                                     {entry.username}
                                   </p>
                                 </div>
                               </div>

                               <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                 <div className="relative group/pass">
                                   <div className="h-9 px-3 min-w-[120px] bg-secondary/50 rounded-md flex items-center font-mono text-sm">
                                     {entry.isPasswordVisible
                                       ? entry.password
                                       : maskPassword(entry.password.length)}
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
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {syncConflict && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <Card className="w-full max-w-6xl border-primary/30">
            <CardHeader>
              <CardTitle>Sync Conflict Detected</CardTitle>
              <CardDescription>
                Two devices changed vault data at nearly the same time. Choose which version to keep as the new master copy.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-semibold mb-2">Your Local Version ({syncConflict.localEntries.length})</h4>
                <div className="max-h-64 overflow-auto space-y-2 text-sm">
                  {syncConflict.localEntries.slice(0, 8).map((entry) => (
                    <div key={`local-${entry.id}`} className="rounded border border-border/60 p-2">
                      <div className="font-medium">{entry.url}</div>
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
                      <div className="font-medium">{entry.url}</div>
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
                Share "{sharingEntry.url}" with a colleague using end-to-end encryption.
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
