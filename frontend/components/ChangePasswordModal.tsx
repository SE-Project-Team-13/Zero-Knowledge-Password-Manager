"use client"

import type React from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Key, Loader2, AlertCircle, Eye, EyeOff, Lock, Check } from "lucide-react"
import { toast } from "sonner"
import { deriveKey } from "@password-manager/crypto-engine"

interface ChangePasswordModalProps {
    isOpen: boolean
    onClose: () => void
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    // State
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPasswords, setShowPasswords] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    const handleClose = () => {
        if (!isLoading) {
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setError("")
            setSuccess(false)
            onClose()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        // 1. Validations
        const sessionPassword = sessionStorage.getItem("session_master_password")
        if (sessionPassword && currentPassword !== sessionPassword) {
            setError("Current password is incorrect")
            return
        }

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match")
            return
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long")
            return
        }

        if (newPassword === currentPassword) {
            setError("New password must be different from the current one")
            return
        }

        setIsLoading(true)

        try {
            const token = localStorage.getItem("auth_token")
            const email = localStorage.getItem("user_email") || ""
            const userId = localStorage.getItem("user_id")
            let deviceId = localStorage.getItem("device_id") || "default-device"

            let newVaultBlob = null

            // RE-ENCRYPTION FLOW:
            // Since we are changing password, we MUST re-encrypt the vault data.
            console.log("[ChangePassword] Fetching current vault for re-encryption...")
            
            // 1. Fetch current vault data
            const pullResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/sync/pull`, 
                { 
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        userId,
                        deviceId,
                        lastVersion: 0
                    })
                }
            )

            let vaultData = null
            if (pullResponse.ok) {
                const responseData = await pullResponse.json()
                if (responseData.vaults && responseData.vaults.length > 0) {
                    vaultData = responseData.vaults[0]
                }
            }

            // Fallback to SimpleVault if Sync API is empty
            if (!vaultData && email) {
                const compatResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(email)}`,
                    {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${token}` }
                    }
                )
                if (compatResponse.ok) {
                    const compatData = await compatResponse.json()
                    vaultData = compatData.ciphertext ? compatData : (compatData.data?.ciphertext ? compatData.data : null)
                }
            }

            if (vaultData && vaultData.ciphertext) {
                // 2. Decrypt with OLD password
                const { decryptVault, encryptVault } = await import("@password-manager/crypto-engine")
                
                const decryptionResult = await decryptVault(currentPassword, {
                    ciphertext: vaultData.ciphertext,
                    iv: vaultData.iv,
                    salt: vaultData.salt,
                    tag: vaultData.tag || vaultData.authTag,
                    algorithm: "AES-256-GCM",
                    derivationAlgorithm: "Argon2id"
                })
                
                if (decryptionResult.success && decryptionResult.data) {
                    // 3. Encrypt with NEW password
                    const encryptionResult = await encryptVault(newPassword, decryptionResult.data)
                    
                    newVaultBlob = {
                        ciphertext: encryptionResult.ciphertext,
                        iv: encryptionResult.iv,
                        salt: encryptionResult.salt,
                        authTag: encryptionResult.tag || "",
                        version: (vaultData.version || 0) + 1,
                        deviceId: deviceId
                    }
                } else {
                    throw new Error("Failed to decrypt your vault with the current password. Please try again.")
                }
            }

            // 4. Generate new security parameters
            const saltBuffer = crypto.getRandomValues(new Uint8Array(16))
            const salt = Array.from(saltBuffer).map((b) => b.toString(16).padStart(2, "0")).join("")
            const { authKey } = await deriveKey(newPassword, saltBuffer)
            
            const encoder = new TextEncoder()
            const proofData = encoder.encode("auth-proof")
            const verifierBuffer = await crypto.subtle.sign("HMAC", authKey, proofData)
            const verifier = Array.from(new Uint8Array(verifierBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("")

            // 5. Update server
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/auth/reset-password`, 
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        salt,
                        verifier,
                        encryptedVault: newVaultBlob
                    })
                }
            )

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to update password on server")
            }

            // 6. Success! Update local state
            localStorage.setItem("user_salt", salt)
            sessionStorage.setItem("session_master_password", newPassword)
            
            setSuccess(true)
            toast.success("Password changed successfully!")

            // Close after delay
            setTimeout(() => {
                handleClose()
            }, 2000)

        } catch (err) {
            console.error("Change password error:", err)
            setError(err instanceof Error ? err.message : "An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-xl font-bold">
                        Change Master Password
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Your vault will be re-encrypted with your new password.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="py-6 text-center space-y-4">
                        <div className="mx-auto bg-green-500/20 p-3 rounded-full w-fit">
                            <Check className="h-8 w-8 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            Password updated successfully!
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        {error && (
                            <Alert variant="destructive" className="py-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <div className="relative">
                                <Input
                                    id="current-password"
                                    type={showPasswords ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    className="pr-10"
                                    required
                                    disabled={isLoading}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                >
                                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2 border-t pt-4">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type={showPasswords ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 8 characters"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                            <Input
                                id="confirm-new-password"
                                type={showPasswords ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat new password"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                disabled={isLoading}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    "Save Password"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
