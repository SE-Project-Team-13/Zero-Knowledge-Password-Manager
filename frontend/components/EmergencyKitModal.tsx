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
import { copyWithAutoClear } from "@/lib/clipboard"

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
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || "Failed to generate recovery key")
            }

            const data = await response.json()
            setRecoveryKey(data.recoveryKey)
            setFormattedKey(data.formattedKey)
            toast.success("Recovery key generated!")
        } catch (error) {
            console.error("Error generating recovery key:", error)
            const message = error instanceof Error ? error.message : "Failed to generate recovery key"
            toast.error(message)
        } finally {
            setIsGenerating(false)
        }
    }

    const copyToClipboard = async () => {
        if (!recoveryKey) return

        const ok = await copyWithAutoClear(recoveryKey)
        if (ok) {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
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
