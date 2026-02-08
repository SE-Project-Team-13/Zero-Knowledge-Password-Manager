"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Key, Loader2, AlertCircle, Eye, EyeOff, Lock, Check } from "lucide-react"
import { toast } from "sonner"
import { ThemeToggle } from "@/components/ThemeToggle"
import { deriveKey } from "@password-manager/crypto-engine"

export default function ResetPasswordPage() {
    const router = useRouter()
    
    // State
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    // Verify authentication on mount
    useEffect(() => {
        const token = localStorage.getItem("auth_token")
        if (!token) {
            router.push("/")
        }
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long")
            return
        }

        setIsLoading(true)

        try {
            // 0. Check for Old Master Password (from Recovery Login or active session)
            const oldMasterPassword = sessionStorage.getItem("old_master_password") || sessionStorage.getItem("session_master_password")
            let newVaultBlob = null

            if (oldMasterPassword) {
                // RE-ENCRYPTION FLOW:
                // We have access to the old password, so we can preserve the vault data.
                try {
                    // A. Fetch the current encrypted vault
                    const token = localStorage.getItem("auth_token")
                    const email = localStorage.getItem("user_email") || ""
                    let deviceId = localStorage.getItem("device_id")
                    if (!deviceId) deviceId = "recovery-device"

                    const userId = localStorage.getItem("user_id")
                    
                    let vaultData = null
                    
                    // 1. Try Sync API first
                    console.log("[ResetPassword] Trying Sync API for vault data...")
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

                    if (pullResponse.ok) {
                        const responseData = await pullResponse.json()
                        if (responseData.vaults && responseData.vaults.length > 0) {
                            vaultData = responseData.vaults[0]
                            console.log("[ResetPassword] Found vault in Sync API")
                        }
                    }
                    
                    // 2. Fallback to Compatibility API (SimpleVault) if Sync API is empty
                    if (!vaultData && email) {
                        console.log("[ResetPassword] Sync API empty, trying Compatibility API...")
                        const compatResponse = await fetch(
                            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/vault/${encodeURIComponent(email)}`,
                            {
                                method: "GET",
                                headers: {
                                    "Authorization": `Bearer ${token}`
                                }
                            }
                        )
                        
                        if (compatResponse.ok) {
                            const compatData = await compatResponse.json()
                            // SimpleVault stores data inside a 'data' field
                            if (compatData && compatData.ciphertext) {
                                vaultData = compatData
                                console.log("[ResetPassword] Found vault in Compatibility API")
                            } else if (compatData && compatData.data && compatData.data.ciphertext) {
                                vaultData = compatData.data
                                console.log("[ResetPassword] Found vault in Compatibility API (nested data)")
                            }
                        }
                    }
                    
                    if (vaultData && vaultData.ciphertext) {
                        // B. Decrypt with OLD password
                        console.log("[ResetPassword] Decrypting vault with old password...")
                        const { decryptVault, encryptVault } = await import("@password-manager/crypto-engine")
                        
                        const decryptionResult = await decryptVault(oldMasterPassword, {
                            ciphertext: vaultData.ciphertext,
                            iv: vaultData.iv,
                            salt: vaultData.salt,
                            tag: vaultData.tag || vaultData.authTag,
                            algorithm: "AES-256-GCM",
                            derivationAlgorithm: "Argon2id"
                        })
                        
                        if (decryptionResult.success && decryptionResult.data) {
                            // C. Encrypt with NEW password
                            console.log("[ResetPassword] Re-encrypting vault with new password...")
                            const encryptionResult = await encryptVault(password, decryptionResult.data)
                            
                            // D. Prepare new vault blob for server
                            newVaultBlob = {
                                ciphertext: encryptionResult.ciphertext,
                                iv: encryptionResult.iv,
                                salt: encryptionResult.salt,
                                authTag: encryptionResult.tag || "",
                                version: (vaultData.version || 0) + 1,
                                deviceId: deviceId
                            }
                            console.log("[ResetPassword] Vault re-encrypted successfully!")
                        } else {
                            console.warn("[ResetPassword] Decryption failed:", decryptionResult)
                        }
                    } else {
                        console.log("[ResetPassword] No vault data found to re-encrypt")
                    }
                } catch (reEncryptError) {
                    console.error("[ResetPassword] Re-encryption failed:", reEncryptError)
                    toast.warning("Could not re-encrypt existing vault. Your old credentials may be lost.")
                }
            }

            // 1. Generate new salt
            const saltBuffer = crypto.getRandomValues(new Uint8Array(16))
            const salt = Array.from(saltBuffer)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")

            // 2. Derive new keys and verifier locally
            // This is the heavy lifting part
            const { authKey } = await deriveKey(password, saltBuffer)

            // 3. Create proof/verifier
            const encoder = new TextEncoder()
            const proofData = encoder.encode("auth-proof")
            const verifierBuffer = await crypto.subtle.sign("HMAC", authKey, proofData)
            const verifier = Array.from(new Uint8Array(verifierBuffer))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")

            // 4. Send to backend (with optional new vault)
            console.log("[ResetPassword] Sending to backend:", { 
                hasNewVaultBlob: !!newVaultBlob,
                vaultBlobKeys: newVaultBlob ? Object.keys(newVaultBlob) : []
            })
            
            const token = localStorage.getItem("auth_token")
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
                        encryptedVault: newVaultBlob // Pass this if we successfully re-encrypted
                    })
                }
            )

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to reset password")
            }

            // Success!
            // Update local storage credentials
            localStorage.setItem("user_salt", salt)
            
            // Clear temporary session data to force a clean login
            sessionStorage.removeItem("session_master_password")
            sessionStorage.removeItem("old_master_password")
            sessionStorage.removeItem("temp_master_password")
            sessionStorage.removeItem("otp_verified")
            localStorage.removeItem("auth_token")

            setSuccess(true)
            toast.success("Password reset successfully! Please sign in with your new password.")

            // Redirect after a short delay to the login page
            setTimeout(() => {
                router.push("/")
            }, 2000)

        } catch (err) {
            console.error("Reset password error:", err)
            setError(err instanceof Error ? err.message : "An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
                <div className="absolute top-4 right-4 z-50">
                    <ThemeToggle />
                </div>
                <Card className="w-full max-w-md border-green-500/20 shadow-2xl bg-card/50 backdrop-blur-sm">
                    <CardHeader className="text-center space-y-3">
                        <div className="mx-auto bg-green-500/10 p-4 rounded-full w-fit mb-2">
                            <Check className="h-10 w-10 text-green-500" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-foreground">
                            Password Reset Complete
                        </CardTitle>
                        <CardDescription>
                            Your master password has been updated securely.
                            Redirecting to login page...
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

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
                        Set New Password
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Create a new master password for your vault.
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
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
                            <Label htmlFor="password">New Master Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10 bg-secondary/50 font-mono"
                                    required
                                    disabled={isLoading}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirm-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 bg-secondary/50 font-mono"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter>
                        <Button
                            type="submit"
                            className="w-full h-12 font-semibold shadow-lg shadow-primary/20"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <Shield className="mr-2 h-5 w-5" />
                                    Reset Password
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
