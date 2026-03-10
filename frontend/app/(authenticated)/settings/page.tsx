"use client";

import React, { useState } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { buildApiUrl } from "@/lib/api-base-url";
import { generateAndDownloadRecoveryKey } from "@/lib/recovery";
import { Key } from "lucide-react";

export default function SettingsPage() {
    const [session, { logout, refreshProfile }] = useVaultSync();
    const router = useRouter(); 
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isGeneratingKit, setIsGeneratingKit] = useState(false);

    // Handle Delete Account
    const handleDeleteAccount = async () => {
        // Double confirmation for safety
        if (!confirm("WARNING: This will PERMANENTLY DELETE your account and ALL stored passwords. This action cannot be undone. Are you sure?")) {
            return;
        }
        
        // Final sanity check
        const finalConfirmation = prompt("Type 'DELETE' to confirm account deletion:");
        if (finalConfirmation !== "DELETE") {
            toast.info("Account deletion cancelled.");
            return;
        }

        setIsDeleting(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(buildApiUrl("/auth/account"), {
                method: "DELETE",
                headers: { 
                    "Authorization": `Bearer ${token}` 
                }
            });

            if (response.ok) {
                toast.success("Account deleted successfully.");
                // Clear local storage completely
                localStorage.clear();
                sessionStorage.clear();
                // Redirect home
                window.location.href = "/";
            } else {
                const data = await response.json();
                toast.error(data.message || "Failed to delete account");
            }
        } catch (error) {
            console.error("Delete account error:", error);
            toast.error("An unexpected error occurred.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle Recovery Kit Generation
    const handleGenerateRecoveryKit = async () => {
        const password = sessionStorage.getItem("session_master_password");
        const token = localStorage.getItem("auth_token");
        const email = session.email || localStorage.getItem("user_email");

        if (!password || !token || !email) {
            toast.error("Session expired. Please log in again to generate a recovery kit.");
            return;
        }

        setIsGeneratingKit(true);
        toast.info("Generating your Emergency Kit...");

        try {
            await generateAndDownloadRecoveryKey(email, password, token);
            toast.success("Emergency Kit downloaded! Keep it safe.");
        } catch (error) {
            console.error("Recovery kit generation error:", error);
            const message = error instanceof Error ? error.message : "Failed to generate kit";
            toast.error(message);
        } finally {
            setIsGeneratingKit(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pt-24 sm:pt-20 p-4">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">Manage your account settings and preferences.</p>
            </header>

            {/* Account Security Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-primary" />
                        Account Security
                    </CardTitle>
                    <CardDescription>
                        Manage your master password and login credentials.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="space-y-1">
                            <h3 className="font-medium">Master Password</h3>
                            <p className="text-sm text-muted-foreground">
                                Change your master password regularly to keep your vault secure.
                                This will re-encrypt your entire vault.
                            </p>
                            <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                                <ShieldAlert className="w-3 h-3" />
                                Note: This will invalidate your existing Emergency Recovery Kit.
                            </p>
                        </div>
                        <Button onClick={() => setIsChangePasswordOpen(true)} variant="outline">
                            Change Password
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="space-y-1">
                            <h3 className="font-medium">Emergency Recovery Kit</h3>
                            <p className="text-sm text-muted-foreground">
                                Download a new recovery kit if you lost your old one. 
                                Stored as a secure PDF with your unique recovery key.
                            </p>
                        </div>
                        <Button 
                            onClick={handleGenerateRecoveryKit} 
                            disabled={isGeneratingKit}
                            variant="secondary"
                            className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                        >
                            {isGeneratingKit ? "Generating..." : "Download Kit"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone Section */}
            <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="w-5 h-5" />
                        Danger Zone
                    </CardTitle>
                    <CardDescription className="text-destructive/80">
                        Irreversible actions regarding your account data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-background/50">
                        <div className="space-y-1">
                            <h3 className="font-medium text-destructive">Delete Account</h3>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete your account and all stored credentials.
                                <br />
                                <span className="font-bold text-destructive/80">
                                    This action cannot be undone.
                                </span>
                            </p>
                        </div>
                        <Button 
                            variant="destructive" 
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete Account"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Change Password Modal */}
            <ChangePasswordModal 
                isOpen={isChangePasswordOpen} 
                onClose={() => setIsChangePasswordOpen(false)} 
            />
        </div>
    );
}
