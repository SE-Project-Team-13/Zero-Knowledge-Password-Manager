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
import { deriveKey, generateVerifier } from "@password-manager/crypto-engine"
import { PasswordStrength } from "./PasswordStrength"
import { generateAndDownloadRecoveryKey } from "@/lib/recovery"
import { buildApiUrl, getApiBaseUrl } from "@/lib/api-base-url"
import { useVault } from "@/context/VaultContext"

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
    const [isPasswordValid, setIsPasswordValid] = useState(false)
    const [autoGenerateKit, setAutoGenerateKit] = useState(true)
    const { decryptedEntries, isLoadingVault: isVaultSyncing } = useVault();

    const handleClose = () => {
        if (!isLoading) {
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setError("")
            setSuccess(false)
            setIsPasswordValid(false)
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

        if (!isPasswordValid) {
            setError("Please satisfy all password requirements for better security")
            return
        }

        if (newPassword === currentPassword) {
            setError("New password must be different from the current one")
            return
        }

        setIsLoading(true)

        try {
            const token = localStorage.getItem("auth_token")
            const userId = localStorage.getItem("user_id")
            let deviceId = localStorage.getItem("device_id") || "default-device"

            let newVaultBlob = null

            // RE-ENCRYPTION FLOW:
            // Since we are changing password, we MUST re-encrypt the vault data.
            // CRITICAL: We must use the SAME key derivation path as VaultContext.unlockVault():
            //   1. Read the user's hex salt from localStorage (NOT the base64 salt in the vault blob)
            //   2. Parse hex → bytes
            //   3. Call deriveKey(password, saltBytes, argon2Params) → DerivedKey
            //   4. Call decrypt(vaultData, derivedKey) directly
            // Using decryptVault() would fail because it internally calls
            // base64ToBuffer(encrypted.salt) — but the vault blob's salt field is a
            // DIFFERENT salt (from AES encryption), not the user's registration salt.
            console.log("[ChangePassword] Fetching current vault for re-encryption...")
            
            // 1. Fetch current vault data
            // 1. Fetch current vault data
            const pullResponse = await fetch(
                buildApiUrl("/sync/blob/pull"), 
                { 
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                        userId,
                        lastKnownTimestamp: 0,
                    })
                }
            )

            let vaultData = null
            if (pullResponse.ok) {
                const responseData = await pullResponse.json()
                if (responseData?.blob?.ciphertext) {
                    vaultData = responseData.blob
                }
            }

            // CHECK RECOVERY STATUS: 
            // We should check if the user has an active recovery key to show a warning.
            // But for now, we'll just add the warning to the UI since revoking is mandatory.
            console.log("[ChangePassword] Note: This will invalidate all existing recovery keys.");


            // Fallback to legacy sync API
            if (!vaultData && userId) {
                const syncResponse = await fetch(
                    buildApiUrl("/sync/pull"),
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ userId, deviceId, lastVersion: 0 })
                    }
                )
                if (syncResponse.ok) {
                    const syncData = await syncResponse.json()
                    if (syncData?.vaults?.length > 0 && syncData.vaults[0]?.ciphertext) {
                        vaultData = syncData.vaults[0]
                    }
                }
            }

            // Fallback to SimpleVault if Sync APIs are empty
            if (!vaultData && userId) {
                const compatResponse = await fetch(
                    buildApiUrl(`/api/vault/${encodeURIComponent(userId)}`),
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

            // CRITICAL SAFETY CHECK: If we have entries in memory but couldn't fetch them from server,
            // DO NOT proceed. This prevents overwriting a populated vault with an empty one.
            if (!vaultData && decryptedEntries.length > 0) {
                throw new Error("Could not sync with the latest vault version. To prevent data loss, password change is blocked. Please check your connection and try again.")
            }

            if (vaultData && vaultData.ciphertext) {
                const { decrypt, encrypt } = await import("@password-manager/crypto-engine")

                // 2. Decrypt with OLD password using the SAME approach as VaultContext.unlockVault()
                const userSaltHex = localStorage.getItem("user_salt")
                if (!userSaltHex) {
                    throw new Error("User salt not found. Please log out and log back in.")
                }
                const saltChunks = userSaltHex.match(/.{1,2}/g)
                if (!saltChunks) {
                    throw new Error("Invalid salt format")
                }
                const oldSaltBytes = new Uint8Array(saltChunks.map(byte => parseInt(byte, 16)))

                const currentArgon2Memory = Number(localStorage.getItem("argon2_memory")) || 128
                const currentArgon2Iterations = Number(localStorage.getItem("argon2_iterations")) || 1

                console.log(`[ChangePassword] Deriving OLD key (m=${currentArgon2Memory}, t=${currentArgon2Iterations})...`)
                const oldKeys = await deriveKey(currentPassword, oldSaltBytes, {
                    memorySize: currentArgon2Memory,
                    iterations: currentArgon2Iterations
                })

                let decryptedEntry: unknown
                try {
                    decryptedEntry = await decrypt(
                        {
                            ciphertext: vaultData.ciphertext,
                            iv: vaultData.iv,
                            salt: vaultData.salt,
                            tag: vaultData.tag || vaultData.authTag,
                            algorithm: "AES-256-GCM" as const,
                            derivationAlgorithm: "Argon2id" as const
                        },
                        oldKeys
                    )
                    console.log("[ChangePassword] Decryption with old password succeeded")
                } catch (decryptErr) {
                    console.error("[ChangePassword] Decryption failed:", decryptErr)
                    throw new Error("Failed to decrypt your vault with the current password. Please try again.")
                }

                // 3. Encrypt with NEW password
                // CRITICAL: Use the SAME salt for both vault encryption AND auth verifier.
                // If they differ, unlockVault will derive a key from user_salt (auth salt)
                // which won't match the vault (encrypted with a different salt).
                const newArgon2Params = { memorySize: 128, iterations: 1 }
                const newSaltBytes = crypto.getRandomValues(new Uint8Array(16))
                const newSaltHex = Array.from(newSaltBytes).map((b) => b.toString(16).padStart(2, "0")).join("")
                console.log(`[ChangePassword] Deriving NEW key (m=${newArgon2Params.memorySize}, t=${newArgon2Params.iterations})...`)
                const newKeys = await deriveKey(newPassword, newSaltBytes, newArgon2Params)

                const encryptionResult = await encrypt(
                    typeof decryptedEntry === 'object' && decryptedEntry !== null
                        ? decryptedEntry as any
                        : { url: "VAULT_ROOT", username: "SYSTEM", password: JSON.stringify(decryptedEntry) },
                    newKeys
                )
                    
                newVaultBlob = {
                    ciphertext: encryptionResult.ciphertext,
                    iv: encryptionResult.iv,
                    salt: encryptionResult.salt,
                    authTag: encryptionResult.tag || "",
                    version: (vaultData.version || 0) + 1,
                    deviceId: deviceId
                }

                // 4. Generate new auth verifier using the SAME salt
                const verifier = await generateVerifier(newKeys.authKey)

                // 5. Update server
                const response = await fetch(
                    buildApiUrl("/auth/reset-password"), 
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            salt: newSaltHex,
                            verifier,
                            argon2Memory: newArgon2Params.memorySize,
                            argon2Iterations: newArgon2Params.iterations,
                            encryptedVault: newVaultBlob
                        })
                    }
                )

                if (!response.ok) {
                    const data = await response.json()
                    throw new Error(data.message || "Failed to update password on server")
                }

                // 6. Success! Update local state
                localStorage.setItem("user_salt", newSaltHex)
                localStorage.setItem("argon2_memory", String(newArgon2Params.memorySize))
                localStorage.setItem("argon2_iterations", String(newArgon2Params.iterations))
                sessionStorage.setItem("session_master_password", newPassword)

                // 7. Auto-generate new recovery kit if requested
                if (autoGenerateKit) {
                    try {
                        console.log("[ChangePassword] Auto-generating new recovery kit...")
                        const email = localStorage.getItem("user_email") || ""
                        if (email && token) {
                            await generateAndDownloadRecoveryKey(email, newPassword, token, getApiBaseUrl())
                            toast.success("New Emergency Kit generated and downloaded!")
                        }
                    } catch (kitErr) {
                        console.error("[ChangePassword] Kit generation failed:", kitErr)
                        toast.error("Password updated, but failed to generate new recovery kit. Please generate it manually in Settings.")
                    }
                }
            } else {
                // No vault data — just update the auth credentials
                const saltBuffer = crypto.getRandomValues(new Uint8Array(16))
                const salt = Array.from(saltBuffer).map((b) => b.toString(16).padStart(2, "0")).join("")
                const argon2Params = { memorySize: 128, iterations: 1 }
                const { authKey } = await deriveKey(newPassword, saltBuffer, argon2Params)
                const verifier = await generateVerifier(authKey)

                const response = await fetch(
                    buildApiUrl("/auth/reset-password"), 
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            salt,
                            verifier,
                            argon2Memory: argon2Params.memorySize,
                            argon2Iterations: argon2Params.iterations,
                        })
                    }
                )

                if (!response.ok) {
                    const data = await response.json()
                    throw new Error(data.message || "Failed to update password on server")
                }

                localStorage.setItem("user_salt", salt)
                localStorage.setItem("argon2_memory", String(argon2Params.memorySize))
                localStorage.setItem("argon2_iterations", String(argon2Params.iterations))
                sessionStorage.setItem("session_master_password", newPassword)

                // Auto-generate kit for empty vault case too
                if (autoGenerateKit) {
                    try {
                        const email = localStorage.getItem("user_email") || ""
                        if (email && token) {
                            await generateAndDownloadRecoveryKey(email, newPassword, token, getApiBaseUrl())
                            toast.success("New Emergency Kit generated!")
                        }
                    } catch (kitErr) {
                        console.error("[ChangePassword] Kit generation failed:", kitErr)
                    }
                }
            }
            
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
            <DialogContent className="sm:max-w-md max-h-[95vh] overflow-y-auto scrollbar-hide">
                <DialogHeader className="pb-2">
                    <DialogTitle className="text-center text-xl font-bold">
                        Change Master Password
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs">
                        Vault will be re-encrypted. <span className="text-amber-600 font-semibold underline decoration-amber-600/30">Existing recovery keys will be revoked.</span>
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
                    <form onSubmit={handleSubmit} className="space-y-3 py-1">
                        {error ? (
                            <Alert variant="destructive" className="py-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert className="bg-amber-500/10 border-amber-500/20 py-2">
                                <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                                <AlertDescription className="text-[11px] text-amber-600 leading-tight">
                                    This will revoke your current Emergency Kit. A new one will be generated automatically.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="current-password">Current Password</Label>
                            <div className="relative">
                                <Input
                                    id="current-password"
                                    type={showPasswords ? "text" : "password"}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    className="pr-10 h-9"
                                    required
                                    disabled={isLoading}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                >
                                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5 border-t pt-3">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type={showPasswords ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min 8 characters"
                                className="h-9"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="confirm-new-password">Confirm Password</Label>
                            <Input
                                id="confirm-new-password"
                                type={showPasswords ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat new password"
                                className="h-9"
                                required
                                disabled={isLoading}
                            />
                            <div className="scale-90 origin-top -mt-1">
                                <PasswordStrength 
                                    password={newPassword} 
                                    onStrengthChange={setIsPasswordValid} 
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 py-2 px-3 bg-primary/5 rounded-xl border border-primary/10">
                             <input 
                                type="checkbox" 
                                id="auto-generate-kit"
                                checked={autoGenerateKit}
                                onChange={(e) => setAutoGenerateKit(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                disabled={isLoading}
                             />
                             <Label htmlFor="auto-generate-kit" className="text-[11px] font-medium cursor-pointer flex-1 leading-tight">
                                Auto-generate new Emergency Kit
                                <p className="text-[9px] text-muted-foreground mt-0.5">Recommended to maintain recovery access.</p>
                             </Label>
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
                                disabled={isLoading || !isPasswordValid}
                                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-11 shadow-lg shadow-yellow-500/20 transition-all active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Shield className="h-4 w-4" />
                                        Save Password
                                    </div>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
