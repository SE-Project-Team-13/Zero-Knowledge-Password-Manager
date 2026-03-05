"use client";

import type React from "react";
import { useState, useEffect, Suspense } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { EditCredentialModal } from "@/components/EditCredentialModal";
import { usePasswordAging } from "@/hooks/usePasswordAging";
import { DecryptedEntry } from "@/context/VaultContext";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Eye,
    EyeOff,
    Search,
    Copy,
    AlertCircle,
    ShieldAlert,
    Plus,
    Key,
    Edit,
    Trash2
} from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { toast } from "sonner";
import { copyWithAutoClear } from "@/lib/clipboard";
import { maskPassword } from "@/lib/password-utils";

function PasswordManagerContent() {
    const [session] = useVaultSync();
    const { decryptedEntries, setDecryptedEntries, isLoadingVault, snoozeEntry, updateEntry, deleteEntry } = useVault();
    const { isPasswordOld, isSnoozed } = usePasswordAging();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<DecryptedEntry | null>(null);

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
        }
    };

    // Delete entry
    const handleDeleteEntry = async (entryId: string) => {
        if (!confirm("Are you sure you want to delete this credential? This action cannot be undone.")) {
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

    // Check for edit query param
    useEffect(() => {
        const editId = searchParams.get("edit");
        if (editId && decryptedEntries.length > 0) {
             const entry = decryptedEntries.find(e => e.id === editId);
             if (entry) {
                 // Open edit modal
                 setEditingEntry(entry);
                 setIsEditModalOpen(true);
                 // Clean URL
                 router.replace("/password-manager");
             }
        }
    }, [searchParams, decryptedEntries, router]);

    // Wait for component to mount
    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="flex-1 p-4 lg:p-8 pt-20 lg:pt-20 space-y-8 max-w-5xl mx-auto w-full">
            {/* Header with Search and Add Button */}
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
                    <Key className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground font-heading">Password Manager</h1>
                    <p className="text-sm text-muted-foreground">Manage your secure credentials</p>
                </div>
            </div>

            {/* Search Bar and Add Button */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search credentials..."
                        className="pl-9 h-12 bg-card border-border focus:border-primary transition-all rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Link href="/add-credential">
                    <Button className="h-12 px-6 font-heading tracking-wide">
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Credential
                    </Button>
                </Link>
            </div>

            {/* Credentials List */}
            <div className="space-y-4">
                {isLoadingVault ? (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="border border-border bg-card/50 backdrop-blur-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="h-7 w-1/3 bg-muted rounded-md animate-pulse mb-4" />
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
                                                    <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
                                                    <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
                                                    <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : decryptedEntries.filter((entry) =>
                    entry.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    entry.username.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 ? (
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
                                : "Start by adding your first secure credential."}
                        </p>
                        {!searchQuery && (
                            <Link href="/add-credential">
                                <Button className="mt-4">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Your First Credential
                                </Button>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {decryptedEntries
                            .filter((entry) =>
                                entry.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                entry.username.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map((entry) => (
                                <Card key={entry.id} className="border border-border bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-lg font-semibold text-foreground">
                                                        {entry.site}
                                                    </h3>
                                                </div>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground w-20">URL:</span>
                                                        <a
                                                            href={entry.siteUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:underline truncate"
                                                        >
                                                            {entry.siteUrl}
                                                        </a>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground w-20">Username:</span>
                                                        <span className="text-foreground">{entry.username}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => {
                                                                void copyWithAutoClear(entry.username);
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground w-20">Password:</span>
                                                        <span className="text-foreground font-mono">
                                                            {entry.isPasswordVisible ? entry.password : maskPassword(entry.password.length)}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => togglePasswordVisibility(entry.id)}
                                                        >
                                                            {entry.isPasswordVisible ? (
                                                                <EyeOff className="h-3 w-3" />
                                                            ) : (
                                                                <Eye className="h-3 w-3" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => {
                                                                void copyWithAutoClear(entry.password);
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                        
                                                    </div>
                                                    {isPasswordOld(entry) && !isSnoozed(entry) && (
                                                        <div className="flex items-center gap-2 text-xs text-amber-600 mt-2">
                                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                                            <span>Password is over 365 days old</span>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 px-2 text-[10px]"
                                                                onClick={() => snoozeEntry(entry.id)}
                                                            >
                                                                Snooze 7 days
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {entry.notes && (
                                                        <div className="flex items-start gap-2 mt-2">
                                                            <span className="text-muted-foreground w-20">Notes:</span>
                                                            <span className="text-foreground text-xs">{entry.notes}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Action Buttons */}
                                                    <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border/50">
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleEditEntry(entry)}
                                                            className="h-8 hover:bg-primary/10 hover:text-primary transition-colors"
                                                        >
                                                            <Edit className="h-3 w-3 mr-2" />
                                                            Edit
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => handleDeleteEntry(entry.id)}
                                                            className="h-8 text-destructive hover:text-muted-foreground hover:text-primary transition-colors"
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-2" />
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                )}
            </div>

            {/* Change Password Modal */}
            <ChangePasswordModal 
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />

            <EditCredentialModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                entry={editingEntry}
                onSave={handleSaveEdit}
            />
        </div>
    );
}

export default function PasswordManagerPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>}>
            <PasswordManagerContent />
        </Suspense>
    );
}
