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
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/recovery/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email,
                        recoveryKey: recoveryKey.replace(/-/g, "").trim(),
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
            localStorage.setItem("user_email", email);
            if (data.salt) {
                localStorage.setItem("user_salt", data.salt);
            }

            toast.success("Recovery successful! Please set a new password.");

            // Redirect to password reset
            if (data.requiresPasswordReset) {
                router.push("/reset-password");
            } else {
                router.push("/dashboard");
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
                                <strong>Note:</strong> After recovery, you will need to set a new master password.
                                Your existing vault data will be preserved.
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
