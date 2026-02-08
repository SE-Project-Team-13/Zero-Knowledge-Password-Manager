"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useVaultSync } from "@/hooks/useVaultSync";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { cn } from "@/lib/utils";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Shield,
    Eye,
    EyeOff,
    Search,
    Copy,
    ShieldAlert,
    Plus,
    Key,
} from "lucide-react";
import {
    deriveKey,
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

export default function PasswordManagerPage() {
    const [session, actions] = useVaultSync();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [derivedKeys, setDerivedKeys] = useState<DerivedKey | null>(null);
    const [decryptedEntries, setDecryptedEntries] = useState<DecryptedEntry[]>([]);
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoadingVault, setIsLoadingVault] = useState(false);

    // Wait for component to mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Check authentication only after mounted and session is loaded
    useEffect(() => {
        if (mounted && !session.isLoading) {
            const hasToken = typeof window !== 'undefined' && localStorage.getItem("auth_token");
            if (!session.isAuthenticated && !hasToken) {
                router.push("/");
            }
        }
    }, [mounted, session.isAuthenticated, session.isLoading, router]);

    // Load vault entries on mount
    const loadVault = async () => {
        if (!session.isAuthenticated || !session.email) return;

        setIsLoadingVault(true);
        try {
            // Get master password from sessionStorage
            const sessionPassword = sessionStorage.getItem("session_master_password");
            const salt = localStorage.getItem("user_salt");

            if (!sessionPassword || !salt) {
                console.log("[PasswordManager] No session password or salt found");
                setIsLoadingVault(false);
                return;
            }

            // Derive keys
            const saltBuffer = new Uint8Array(
                salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
            );
            const keys = await deriveKey(sessionPassword, saltBuffer);
            setDerivedKeys(keys);

            // Fetch vault
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(session.email)}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data && data.ciphertext) {
                    const cryptoEngine = await import("@password-manager/crypto-engine");
                    const decryptedEntry = await cryptoEngine.decrypt(data, keys);

                    let entries: any[] = [];
                    if (Array.isArray(decryptedEntry)) {
                        entries = decryptedEntry;
                    } else if (decryptedEntry && typeof decryptedEntry === "object") {
                        if (decryptedEntry.password) {
                            try {
                                const parsed = JSON.parse(decryptedEntry.password);
                                if (Array.isArray(parsed)) {
                                    entries = parsed;
                                }
                            } catch { }
                        }

                        if (entries.length === 0) {
                            const possibleArrays = Object.values(decryptedEntry).filter(
                                (val) => Array.isArray(val),
                            );
                            if (possibleArrays.length > 0) {
                                entries = possibleArrays[0] as any[];
                            }
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
                            siteName: entry.siteName || entry.site || "Unknown",
                            notes: entry.notes || "",
                            createdAt: entry.createdAt || new Date().toISOString(),
                            updatedAt: entry.updatedAt || entry.lastUpdated || new Date().toISOString(),
                            lastUpdated: entry.updatedAt || entry.lastUpdated || new Date().toISOString(),
                            isPasswordVisible: false,
                        }));

                    setDecryptedEntries(entriesWithVisibility);
                    toast.success(`Loaded ${entriesWithVisibility.length} credential(s)`);
                }
            }
        } catch (err) {
            console.error("[PasswordManager] Load vault error:", err);
            toast.error("Failed to load credentials");
        } finally {
            setIsLoadingVault(false);
        }
    };

    // Load vault on mount
    useEffect(() => {
        if (mounted && session.isAuthenticated) {
            loadVault();
        }
    }, [mounted, session.isAuthenticated]);

    return (
        <div className="min-h-screen bg-background flex font-sans">
            <Sidebar
                onLogout={() => {
                    actions.logout();
                    window.location.href = "/";
                }}
                userEmail={session.email || ""}
                onForceSync={() => {
                    toast.info("Syncing with backend...");
                }}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                activeView="password-manager"
                setActiveView={() => { }}
            />

            <div className={cn("flex-1 transition-all duration-300 flex flex-col min-w-0 lg:pl-20")}>
                <main className="flex-1 p-4 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
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
                            <div className="text-center py-20 px-6 bg-card border border-dashed border-border rounded-3xl">
                                <div className="bg-secondary p-4 rounded-full w-fit mx-auto mb-4 animate-pulse">
                                    <Shield className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    Loading credentials...
                                </h3>
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
                                                                        navigator.clipboard.writeText(entry.username);
                                                                        toast.success("Username copied!");
                                                                    }}
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-muted-foreground w-20">Password:</span>
                                                                <span className="text-foreground font-mono">
                                                                    {entry.isPasswordVisible ? entry.password : "••••••••"}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={() => {
                                                                        setDecryptedEntries(
                                                                            decryptedEntries.map((e) =>
                                                                                e.id === entry.id
                                                                                    ? { ...e, isPasswordVisible: !e.isPasswordVisible }
                                                                                    : e
                                                                            )
                                                                        );
                                                                    }}
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
                                                                        navigator.clipboard.writeText(entry.password);
                                                                        toast.success("Password copied!");
                                                                    }}
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                            {entry.notes && (
                                                                <div className="flex items-start gap-2 mt-2">
                                                                    <span className="text-muted-foreground w-20">Notes:</span>
                                                                    <span className="text-foreground text-xs">{entry.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
