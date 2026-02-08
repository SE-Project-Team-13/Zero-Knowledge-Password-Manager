"use client";

import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sidebar } from "@/components/Sidebar";
import { EmergencyKitModal } from "@/components/EmergencyKitModal";
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
  Loader2
} from "lucide-react";
import { toast } from "sonner";

// --- Types ---
import { useVault, type DecryptedEntry } from "@/context/VaultContext";

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

/**
 * DashboardPage: The main authenticated view for managing vault entries.
 * Responsibilities:
 * - Session and idle timeout management.
 * - OTP-based vault unlocking.
 * - Local encryption/decryption of vault items.
 * - CRUD operations for vault entries with live synchronization.
 */
export default function DashboardPage() {
  const [session, actions] = useVaultSync();
  const {
    decryptedEntries,
    setDecryptedEntries,
    derivedKeys,
    isUnlocked: isVaultUnlocked,
    unlockVault: contextUnlockVault,
    isLoadingVault,
    addEntry,
    updateEntry,
    deleteEntry
  } = useVault();

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
  const [isEmergencyKitOpen, setIsEmergencyKitOpen] = useState(false);

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

  // Auto-logout after inactivity
  const lastActivityRef = useRef<number>(Date.now());
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

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

    // 3. Check if there's a temp password from login (first-time login flow)
    const tempPassword = sessionStorage.getItem("temp_master_password")
    if (tempPassword && !masterPassword) {
      setMasterPassword(tempPassword)
    }

    // 4. User is authenticated. Check OTP status.
    if (!otpSent) {
      // Only run if we haven't processed OTP yet in this component lifecycle
      const isVerified = sessionStorage.getItem("otp_verified") === "true"
      if (isVerified) {
        setOtpVerified(true)
        setOtpSent(true)

        // Check if we have master password in session
        const sessionPassword = sessionStorage.getItem("session_master_password")
        if (sessionPassword) {
          // Have password - fetch and decrypt vault (works for both first login and refresh)
          setMasterPassword(sessionPassword)
          unlockVault().finally(() => {
            setIsInitializing(false)
          })
        } else {
          // No password - show empty dashboard
          console.log('[Dashboard] No session password - showing empty dashboard')
          setIsUnlocked(true)
          setIsInitializing(false)
        }
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

  // Auto-logout on inactivity
  useEffect(() => {
    if (!isUnlocked) return;

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
  }, [isUnlocked, actions]);

  /**
   * Performs the multi-step vault unlocking process:
   * 1. Derives the Master Key from user input.
   * 2. Fetches encrypted vault blobs from the server.
   * 3. Decrypts blobs locally using the derived key.
   * 4. Populates the application state with decrypted entries.
   */
  /**
   * Performs the multi-step vault unlocking process:
   * Delegates to VaultContext
   */
  const unlockVault = async () => {
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

      // Context unlock reads from session storage, so ensure it's set
      sessionStorage.setItem("session_master_password", passwordToUse);

      await contextUnlockVault();

      setIsUnlocked(true);
      toast.success("Vault unlocked successfully");
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error("Failed to unlock vault");
    } finally {
      setIsVerifyingOtp(false);
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

  /**
   * Handles the addition of a new vault entry.
   * Delegates to VaultContext.
   */
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
      // Context shows error toast usually, but duplicate here just in case? 
      // Context handles toast.error
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
      await updateEntry(editingEntry);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info("Copied to clipboard");
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
  if (!isUnlocked) {
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

              {!otpVerified && otpSent && !process.env.NEXT_PUBLIC_SMTP_CONFIGURED && (
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
    <div className="min-h-screen bg-background flex font-sans">
      <Sidebar
        onLogout={() => {
          setIsLoggingOut(true);
          actions.logout();
          window.location.href = "/";
        }}
        userEmail={session.email || ""}
        onForceSync={() => {
          // Trigger pull from hook
          toast.info("Syncing with backend...");
          // We can call unlockVault again to refresh content
          unlockVault();
        }}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activeView="home"
        onEmergencyKit={() => setIsEmergencyKitOpen(true)}
      />

      {/* Emergency Kit Modal */}
      <EmergencyKitModal
        isOpen={isEmergencyKitOpen}
        onClose={() => setIsEmergencyKitOpen(false)}
        email={session.email || ""}
      />

      <div className={cn("flex-1 transition-all duration-300 flex flex-col min-w-0 lg:pl-20")}>
        {/* Top bar for mobile only / breadcrumbs? */}
        <header className="lg:hidden bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-30 p-4 pl-16">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground font-heading">
              Vault
            </h1>
            <div className="flex items-center bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-medium border border-green-500/20">
              <Unlock className="h-3 w-3 mr-1" />
              Unlocked
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 space-y-8 max-w-7xl mx-auto w-full">
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
                  Auto-Logout
                </CardDescription>
                <CardTitle className="text-lg flex items-center gap-2 text-foreground font-heading">
                  <Clock className="h-5 w-5 text-amber-500" />5 Minutes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground/80">
                You will be logged out automatically if no activity is detected.
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Vault Listing - Full Width */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground font-heading">
                  Stored Credentials
                </h2>
                <div className="flex-1 max-w-sm relative ml-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search credentials..."
                    className="pl-9 h-10 bg-card border-border focus:border-primary transition-all rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
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
                                    className={`text-[10px] font-semibold ${strength.label === "Strong"
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
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              © 2026 ZeroKnowledge Password Manager.
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
    </div>
  );
}
