"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useRouter } from "next/navigation";
import { usePasswordAging } from "@/hooks/usePasswordAging";
import { DecryptedEntry } from "@/context/VaultContext";
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
import { Progress } from "@/components/ui/progress";
import {
    Plus,
    Eye,
    EyeOff,
    Sparkles,
} from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { toast } from "sonner";

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

export default function AddCredentialPage() {
    const [session] = useVaultSync();
    const { addEntry } = useVault();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

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

    // Wait for component to mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Check authentication happens in Layout

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
            
            // Redirect to password manager
            router.push("/password-manager");
        } catch (err) {
            console.error("[AddCredential] Add entry error:", err);
            // Context handles the error toast
        } finally {
            setIsAddingEntry(false);
        }
    };

    return (
        <div className="flex-1 p-4 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
                    <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground font-heading">Add New Credential</h1>
                    <p className="text-sm text-muted-foreground">Securely store a new password in your vault</p>
                </div>
            </div>

            <Card className="border border-border bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-foreground font-heading">
                        <Plus className="h-5 w-5 text-primary" />
                        Credential Details
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        All data is encrypted before syncing.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAddEntry}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="site" className="text-foreground/80">
                                Website/Service
                            </Label>
                            <Input
                                id="site"
                                placeholder="e.g., GitHub, Gmail"
                                value={newEntry.site}
                                onChange={(e) =>
                                    setNewEntry({ ...newEntry, site: e.target.value })
                                }
                                required
                                className="bg-secondary/50 border-input focus:border-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="url" className="text-foreground/80">
                                URL
                            </Label>
                            <Input
                                id="url"
                                type="url"
                                placeholder="https://example.com"
                                value={newEntry.url || ""}
                                onChange={(e) =>
                                    setNewEntry({ ...newEntry, url: e.target.value })
                                }
                                required
                                className="bg-secondary/50 border-input focus:border-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-foreground/80">
                                Username/Email
                            </Label>
                            <Input
                                id="username"
                                placeholder="your@email.com"
                                value={newEntry.username}
                                onChange={(e) =>
                                    setNewEntry({ ...newEntry, username: e.target.value })
                                }
                                required
                                className="bg-secondary/50 border-input focus:border-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label
                                    htmlFor="new-password"
                                    className="text-foreground/80"
                                >
                                    Password
                                </Label>
                                <span
                                    className={`text-[10px] uppercase tracking-wider font-bold ${strength.color.replace("bg-", "text-")}`}
                                >
                                    {strength.label}
                                </span>
                            </div>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={newEntry.showPassword ? "text" : "password"}
                                    placeholder="Enter password"
                                    value={newEntry.password}
                                    onChange={(e) =>
                                        setNewEntry({ ...newEntry, password: e.target.value })
                                    }
                                    className="pr-20 bg-secondary/50 border-input focus:border-primary font-mono"
                                    required
                                />
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                                        onClick={() =>
                                            setNewEntry({
                                                ...newEntry,
                                                showPassword: !newEntry.showPassword,
                                            })
                                        }
                                    >
                                        {newEntry.showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-transparent"
                                        onClick={generatePassword}
                                        title="Generate strong password"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Progress
                                    value={strength.score}
                                    className={`h-1.5 bg-secondary ${strength.color}`}
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    Strength is calculated locally based on entropy rules.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes" className="text-foreground/80">
                                Notes (optional)
                            </Label>
                            <textarea
                                id="notes"
                                placeholder="Additional information"
                                rows={3}
                                value={newEntry.notes || ""}
                                onChange={(e) =>
                                    setNewEntry({ ...newEntry, notes: e.target.value })
                                }
                                className="w-full px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none bg-secondary/50 text-foreground placeholder-muted-foreground"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => router.push("/password-manager")}
                            disabled={isAddingEntry}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 font-heading tracking-wide"
                            disabled={isAddingEntry}
                        >
                            {isAddingEntry ? "Encrypting..." : "Save Password"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
