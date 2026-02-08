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
  
  // Show loading screen during initialization  
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <CardTitle>Initializing Secure Vault</CardTitle>
            <CardDescription>Setting up your encrypted workspace...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show OTP verification form if OTP sent but not verified
  if (otpSent && !otpVerified) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Verify Your Identity</CardTitle>
            <CardDescription>
              Enter the 6-digit code sent to {session.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              
              {timeLeft > 0 ? (
                <div className="text-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Code expires in {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Verification code expired. Please request a new one.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex flex-col gap-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={otpCode.length !== 6 || isVerifyingOtp || timeLeft === 0}
                >
                  {isVerifyingOtp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={sendOTPToUser}
                  disabled={timeLeft > 540} // Allow resend after 1 minute
                  className="w-full"
                >
                  Resend Code
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show main dashboard when authenticated and OTP verified
  if (otpVerified && session.isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <Sidebar 
            isCollapsed={isCollapsed} 
            setIsCollapsed={setIsCollapsed}
            onLogout={() => actions.logout()}
            userEmail={session.email}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
          
          <main className={cn("flex-1 transition-all duration-300", isCollapsed ? "ml-20" : "ml-72")}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Password Vault</h1>
                  <p className="text-muted-foreground">
                    Manage your encrypted passwords securely
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Button
                    variant="outline"
                    onClick={() => actions.logout()}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Logging out...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Add Entry Button - moved here since search is now in sidebar */}
              <div className="flex gap-4 mb-6 justify-end">
                <Button onClick={() => setIsAddingEntry(!isAddingEntry)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Password
                </Button>
              </div>

              {/* Vault Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Passwords</p>
                        <p className="text-3xl font-bold">{decryptedEntries.length}</p>
                      </div>
                      <Key className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Vault Status</p>
                        <p className="text-lg font-semibold text-green-600">
                          <ShieldCheck className="h-4 w-4 inline mr-1" />
                          Encrypted
                        </p>
                      </div>
                      <Lock className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Last Sync</p>
                        <p className="text-sm">Just now</p>
                      </div>
                      <RefreshCw className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Password Entries */}
              <div className="space-y-4">
                {decryptedEntries.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No passwords yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Start by adding your first password to the vault
                      </p>
                      <Button onClick={() => setIsAddingEntry(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Password
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  decryptedEntries
                    .filter(entry => 
                      entry.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      entry.username.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((entry) => (
                      <Card key={entry.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <Shield className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <h3 className="font-semibold">{entry.site}</h3>
                                  <p className="text-sm text-muted-foreground">{entry.username}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  type={entry.isPasswordVisible ? "text" : "password"}
                                  value={entry.password}
                                  readOnly
                                  className="font-mono text-sm"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const updated = decryptedEntries.map(e => 
                                      e.id === entry.id 
                                        ? { ...e, isPasswordVisible: !e.isPasswordVisible }
                                        : e
                                    );
                                    setDecryptedEntries(updated);
                                  }}
                                >
                                  {entry.isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(entry.password);
                                    toast.success("Password copied to clipboard");
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Fallback - redirect to login if not authenticated
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Please log in to access your vault</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full"
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}