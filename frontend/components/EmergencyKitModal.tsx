"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Download,
    Copy,
    Check,
    AlertTriangle,
    Shield,
    Loader2
} from "lucide-react"
import { generateEmergencyKitPDF } from "@/lib/pdfService"
import { toast } from "sonner"

interface EmergencyKitModalProps {
    isOpen: boolean
    onClose: () => void
    email: string
}

export function EmergencyKitModal({ isOpen, onClose, email }: EmergencyKitModalProps) {
    const [recoveryKey, setRecoveryKey] = useState<string | null>(null)
    const [formattedKey, setFormattedKey] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [copied, setCopied] = useState(false)
    const [hasDownloaded, setHasDownloaded] = useState(false)

    const generateKey = async () => {
        setIsGenerating(true)
        try {
            // 1. Get a random key from the server
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/recovery/generate`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                    },
                    body: JSON.stringify({ email }),
                }
            )

            if (!response.ok) {
                throw new Error("Failed to generate recovery key")
            }

            const data = await response.json()
            const { recoveryKey } = data

            // 2. Encrypt the current master password with this key
            const masterPassword = sessionStorage.getItem("session_master_password")
            if (!masterPassword) {
                throw new Error("Session expired. Please log in again to generate a kit.")
            }

            // Derive wrapping key from recovery key (simple import since it's high entropy)
            const binaryKeyString = atob(recoveryKey)
            const keyBytes = new Uint8Array(binaryKeyString.length)
            for (let i = 0; i < binaryKeyString.length; i++) {
                keyBytes[i] = binaryKeyString.charCodeAt(i)
            }

            const wrappingKey = await window.crypto.subtle.importKey(
                "raw",
                keyBytes,
                { name: "AES-GCM" },
                false,
                ["encrypt"]
            )

            const iv = window.crypto.getRandomValues(new Uint8Array(12))
            const encoder = new TextEncoder()
            const encryptedBuffer = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                wrappingKey,
                encoder.encode(masterPassword)
            )

            const encryptedVaultKey = JSON.stringify({
                iv: Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join(""),
                ciphertext: Array.from(new Uint8Array(encryptedBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")
            })

            // 3. Hash the key for server authentication
            const keyData = encoder.encode(recoveryKey)
            const hashBuffer = await window.crypto.subtle.digest("SHA-256", keyData)
            const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("")

            // 4. Activate the key on the server
            const activateResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/recovery/activate`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                    },
                    body: JSON.stringify({ 
                        email, 
                        keyHash,
                        encryptedVaultKey
                    }),
                }
            )

            if (!activateResponse.ok) {
                throw new Error("Failed to activate recovery key")
            }

            setRecoveryKey(data.recoveryKey)
            setFormattedKey(data.formattedKey)
            toast.success("Recovery key generated and activated!")
        } catch (error) {
            console.error("Error generating recovery key:", error)
            toast.error(error instanceof Error ? error.message : "Failed to generate recovery key")
        } finally {
            setIsGenerating(false)
        }
    }

    const copyToClipboard = async () => {
        if (!recoveryKey) return

        try {
            await navigator.clipboard.writeText(recoveryKey)
            setCopied(true)
            toast.success("Recovery key copied!")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy")
        }
    }

    const downloadPDF = () => {
        if (!recoveryKey) return

        generateEmergencyKitPDF({
            email,
            recoveryKey,
            formattedKey: formattedKey || recoveryKey,
            generatedAt: new Date(),
        })

        setHasDownloaded(true)
        toast.success("Emergency Kit downloaded!")
    }

    const handleClose = () => {
        if (recoveryKey && !hasDownloaded) {
            const confirm = window.confirm(
                "You haven't downloaded your Emergency Kit yet. If you close this dialog, you won't be able to see your recovery key again. Are you sure?"
            )
            if (!confirm) return
        }

        // Reset state
        setRecoveryKey(null)
        setFormattedKey(null)
        setHasDownloaded(false)
        setCopied(false)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Shield className="h-5 w-5 text-primary" />
                        Emergency Kit
                    </DialogTitle>
                    <DialogDescription>
                        Generate a recovery key to regain access if you forget your master password.
                    </DialogDescription>
                </DialogHeader>

                {!recoveryKey ? (
                    <div className="py-6 space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                                <p className="font-semibold mb-1">Before you continue:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>This will revoke any existing recovery keys</li>
                                    <li>The key will only be shown once</li>
                                    <li>Store it in a secure physical location</li>
                                </ul>
                            </div>
                        </div>

                        <Button
                            onClick={generateKey}
                            disabled={isGenerating}
                            className="w-full"
                            size="lg"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Generate Recovery Key
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                            <p className="text-sm text-red-800 dark:text-red-200 font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                This is the only time you'll see this key!
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">
                                Your Recovery Key
                            </label>
                            <div className="relative">
                                <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all select-all border-2 border-primary/20">
                                    {formattedKey || recoveryKey}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2"
                                    onClick={copyToClipboard}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={copyToClipboard}
                                className="flex-1"
                            >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Key
                            </Button>
                            <Button
                                onClick={downloadPDF}
                                className="flex-1"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                            </Button>
                        </div>

                        {hasDownloaded && (
                            <p className="text-sm text-green-600 dark:text-green-400 text-center">
                                ✓ Emergency Kit downloaded successfully
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose}>
                        {recoveryKey ? "Done" : "Cancel"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
