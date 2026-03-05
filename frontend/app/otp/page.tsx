"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useVault } from "@/context/VaultContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Clock, RefreshCw, LogOut, Shield, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api-base-url";

export default function OTPPage() {
  const router = useRouter();
  const [session, actions] = useVaultSync();
  const { unlockVault: contextUnlockVault, isUnlocked: isVaultUnlocked } = useVault();

  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        setOtpSent(true);
        setTimeLeft(600);
        toast.success("OTP sent to your email");
      } else {
        const error = await response.json();
        toast.error(error.message || "Unable to send OTP.");
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      toast.error("Failed to send verification code.");
    }
  }, [session.email]);

  useEffect(() => {
    if (mounted && session.isAuthenticated && !otpSent && !isVaultUnlocked) {
      sendOTPToUser();
    }
  }, [mounted, session.isAuthenticated, otpSent, isVaultUnlocked, sendOTPToUser]);

  useEffect(() => {
    if (!otpSent || otpVerified) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.error("Verification code expired.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [otpSent, otpVerified]);

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
        sessionStorage.setItem("otp_verified", "true");
        window.dispatchEvent(new Event("otpVerified"));
        toast.success("OTP verified successfully!");
        
        // Try to unlock automatically if password is in session
        const sessionPassword = sessionStorage.getItem("session_master_password");
        if (sessionPassword) {
            try {
                await contextUnlockVault();
                router.push("/dashboard");
            } catch (err) {
                console.error("Auto-unlock failed:", err);
                router.push("/dashboard"); // Let dashboard handle manual unlock if auto fails
            }
        } else {
            router.push("/dashboard");
        }
      } else {
        const error = await response.json();
        toast.error(error.message || "Invalid verification code");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      toast.error("Verification failed.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!mounted) return null;

  // Redirect if not authenticated
  if (!session.isLoading && !session.isAuthenticated) {
    router.push("/login");
    return null;
  }

  // Redirect if already unlocked
  if (isVaultUnlocked) {
      router.push("/dashboard");
      return null;
  }

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
            Verify Identity
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter the 6-digit code sent to your email
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleVerifyOTP} style={{ position: "relative" }}>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="otp-input" className="text-sm font-semibold text-foreground/80">
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
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
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
                  {timeLeft > 0 ? `Code expires in ${formatTime(timeLeft)}` : "Code expired"}
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-primary hover:text-primary/80 p-0 h-auto"
                  onClick={sendOTPToUser}
                  disabled={timeLeft > 540}
                >
                  Resend Code
                </Button>
              </div>
            </div>

            {!otpSent && (
              <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-500">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-xs">
                  <strong>Sending OTP...</strong> Please wait.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all font-heading tracking-wide"
              disabled={isVerifyingOtp || !otpSent || otpCode.length !== 6 || timeLeft === 0}
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
              onClick={() => {
                actions.logout();
                router.push("/login");
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
