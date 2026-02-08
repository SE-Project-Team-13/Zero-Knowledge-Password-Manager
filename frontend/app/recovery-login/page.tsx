"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Key, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function RecoveryLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [recoveryKey, setRecoveryKey] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleRecoveryLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email || !recoveryKey) {
            setError("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/recovery/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: normalizedEmail,
                        recoveryKey: recoveryKey.replace(/[\s-]/g, "").trim(),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Recovery login failed");
                return;
            }

            // Store session info
            localStorage.setItem("auth_token", data.sessionToken);
            localStorage.setItem("user_email", email.trim().toLowerCase());
            if (data.userId) {
                localStorage.setItem("user_id", data.userId);
            }
            if (data.salt) {
                localStorage.setItem("user_salt", data.salt);
            }
            if (data.fullName) {
                localStorage.setItem("user_fullname", data.fullName);
            }
            // Bypass OTP check since recovery key proves identity
            sessionStorage.setItem("otp_verified", "true");

            if (data.encryptedVaultKey) {
                try {
                    // Decrypt the master password using the recovery key
                    const encryptedObj = JSON.parse(data.encryptedVaultKey)
                    const iv = new Uint8Array(encryptedObj.iv.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)))
                    const ciphertext = new Uint8Array(encryptedObj.ciphertext.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)))
                    
                    const cleanRecoveryKey = recoveryKey.replace(/[\s-]/g, "").trim();
                    const binaryKeyString = atob(cleanRecoveryKey)
                    const keyBytes = new Uint8Array(binaryKeyString.length)
                    for (let i = 0; i < binaryKeyString.length; i++) {
                        keyBytes[i] = binaryKeyString.charCodeAt(i)
                    }

                    const wrappingKey = await window.crypto.subtle.importKey(
                        "raw",
                        keyBytes,
                        { name: "AES-GCM" },
                        false,
                        ["decrypt"]
                    )

                    const decryptedBuffer = await window.crypto.subtle.decrypt(
                        { name: "AES-GCM", iv },
                        wrappingKey,
                        ciphertext
                    )

                    const masterPassword = new TextDecoder().decode(decryptedBuffer)
                    sessionStorage.setItem("session_master_password", masterPassword)
                    // Store as old password for re-encryption
                    sessionStorage.setItem("old_master_password", masterPassword)
                    toast.success("Account recovered! Please set a new password.")
                    router.push("/reset-password")
                    return
                } catch (decryptError) {
                    console.error("Failed to decrypt master password:", decryptError)
                    toast.warning("Login successful but failed to decrypt vault. Please reset your password.")
                    router.push("/reset-password")
                    return
                }
            } else {
                // No vault key to recover (legacy account or first key)
                // Force a password reset to ensure they can set a new one
                toast.info("Recovery successful. Please set a new master password.")
                router.push("/reset-password")
                return
            }
        } catch (err) {
            console.error("Recovery login error:", err);
            setError("Failed to connect to server");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <Card className="w-full max-w-md border border-primary/20 shadow-2xl bg-card/50 backdrop-blur-sm">
                <CardHeader className="text-center space-y-3">
                    <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-2 border border-primary/20">
                        <Key className="h-14 w-14 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-foreground font-heading tracking-tight">
                        Recovery Login
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Use your Emergency Kit recovery key to regain access to your account
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleRecoveryLogin}>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert className="bg-destructive/10 border-destructive/20">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <AlertDescription className="text-destructive text-sm">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground/80">
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-secondary/50 border-input focus:border-primary"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="recovery-key" className="text-foreground/80">
                                Recovery Key
                            </Label>
                            <textarea
                                id="recovery-key"
                                placeholder="Paste your recovery key from the Emergency Kit PDF"
                                value={recoveryKey}
                                onChange={(e) => setRecoveryKey(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-secondary/50 text-foreground placeholder-muted-foreground font-mono"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                The recovery key can be found in your Emergency Kit PDF.
                                It can be entered with or without dashes.
                            </p>
                        </div>

                        <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                                <strong>Warning:</strong> Recovery allows you to access your account, but you must set a new master password.
                                Since your vault is encrypted with your old password, existing data will be unreadable unless you have a backup.
                            </AlertDescription>
                        </Alert>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            className="w-full h-12 font-semibold shadow-lg shadow-primary/20 transition-all font-heading tracking-wide"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <Shield className="mr-2 h-5 w-5" />
                                    Recover Account
                                </>
                            )}
                        </Button>

                        <Link href="/" className="w-full">
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Login
                            </Button>
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
