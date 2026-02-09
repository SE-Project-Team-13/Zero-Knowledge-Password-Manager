"use client";

import React, { useState, useEffect } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { Sidebar } from "@/components/Sidebar";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Lock, ShieldAlert, Settings, UserX } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { EmergencyKitModal } from "@/components/EmergencyKitModal";
import { PasswordWarningsModal } from "@/components/PasswordWarningsModal";
import { usePasswordAging } from "@/hooks/usePasswordAging";
import { EditCredentialModal } from "@/components/EditCredentialModal";
import { useVault } from "@/context/VaultContext";
import type { DecryptedEntry } from "@/context/VaultContext";

export default function SettingsPage() {
    const [session, actions] = useVaultSync();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sidebar Action States
    const [isEmergencyKitOpen, setIsEmergencyKitOpen] = useState(false);
    const [isAgingModalOpen, setIsAgingModalOpen] = useState(false);
    const { agingEntries } = usePasswordAging();

    // Edit Modal State (needed for PasswordWarningsModal onEdit)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<DecryptedEntry | null>(null);
    const { updateEntry } = useVault();

    // Initial auth check to prevent flash of content
    useEffect(() => {
        // Simple client-side check
        const hasToken = typeof window !== 'undefined' && localStorage.getItem("auth_token");
        if (!hasToken) {
            router.push("/");
        }
    }, [router]);

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
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/auth/account`, {
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

    // Handle Edits (for Password Warnings)
    const handleEditEntry = (entry: DecryptedEntry) => {
        setEditingEntry(entry);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (updatedEntry: DecryptedEntry) => {
        try {
            await updateEntry(updatedEntry);
            setIsEditModalOpen(false);
            setEditingEntry(null);
        } catch (error) {
            console.error("Failed to update entry:", error);
            // Toast handled in context or modal
        }
    };


    // If not authenticated (and sync finished), showing loading or redirect happens in hook/effect
    if (!session.isAuthenticated) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="flex min-h-screen bg-background text-foreground font-sans">
            <Sidebar
                activeView="settings"
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                onLogout={() => {
                    actions.logout();
                    window.location.href = "/";
                }}
                userEmail={session.email || undefined}
                fullName={session.fullName}
                // Sidebar Actions
                onEmergencyKit={() => setIsEmergencyKitOpen(true)}
                onChangePassword={() => setIsChangePasswordOpen(true)}
                onPasswordAging={() => setIsAgingModalOpen(true)}
                passwordAgingCount={agingEntries.length}
            />

            <main className={`flex-1 p-8 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-72"}`}>
                <div className="max-w-4xl mx-auto space-y-8">
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
                                </div>
                                <Button onClick={() => setIsChangePasswordOpen(true)} variant="outline">
                                    Change Password
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
                </div>
            </main>

            {/* Change Password Modal */}
            <ChangePasswordModal 
                isOpen={isChangePasswordOpen} 
                onClose={() => setIsChangePasswordOpen(false)} 
            />

            {/* Emergency Kit Modal */}
            <EmergencyKitModal
                isOpen={isEmergencyKitOpen}
                onClose={() => setIsEmergencyKitOpen(false)}
                email={session.email || ""}
            />

            {/* Password Warnings Modal */}
            <PasswordWarningsModal
                isOpen={isAgingModalOpen}
                onClose={() => setIsAgingModalOpen(false)}
                onEdit={(entry) => {
                    setIsAgingModalOpen(false);
                    handleEditEntry(entry);
                }}
            />

            {/* Edit Credential Modal (for handling edits from warnings) */}
            <EditCredentialModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                entry={editingEntry}
                onSave={handleSaveEdit}
            />
        </div>
    );
}
