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
import { deriveKey, generateVerifier } from "@password-manager/crypto-engine"
import { buildApiUrl, getApiBaseUrl } from "@/lib/api-base-url"
import { PasswordStrength } from "@/components/PasswordStrength"
import { generateAndDownloadRecoveryKey } from "@/lib/recovery"

export default function ResetPasswordPage() {
    const router = useRouter()
    
    // State
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [isPasswordValid, setIsPasswordValid] = useState(false)
    const [autoGenerateKit, setAutoGenerateKit] = useState(true)

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

        if (!isPasswordValid) {
            setError("Please satisfy all password requirements for better security")
            return
        }

        setIsLoading(true)

        try {
            // 0. Check for Old Master Password (from Recovery Login or active session)
            const oldMasterPassword = sessionStorage.getItem("old_master_password") || sessionStorage.getItem("session_master_password")
            let newVaultBlob = null

            // Generate the NEW salt once — used for both vault encryption AND auth verifier.
            // CRITICAL: If these differ, unlockVault will derive a key from user_salt (auth salt)
            // which won't match the vault (encrypted with a different salt).
            const newArgon2Params = { memorySize: 128, iterations: 1 }
            const newSaltBytes = crypto.getRandomValues(new Uint8Array(16))
            const newSaltHex = Array.from(newSaltBytes)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")

            // Derive new key once, reuse for both vault encryption and auth verifier
            const newKeys = await deriveKey(password, newSaltBytes, newArgon2Params)

            if (oldMasterPassword) {
                // RE-ENCRYPTION FLOW:
                // We have access to the old password, so we can preserve the vault data.
                // CRITICAL: We must use the SAME key derivation path as VaultContext.unlockVault():
                //   1. Read the user's hex salt from localStorage (NOT the base64 salt in the vault blob)
                //   2. Parse hex → bytes
                //   3. Call deriveKey(password, saltBytes, argon2Params) → DerivedKey
                //   4. Call decrypt(vaultData, derivedKey) directly
                // Using decryptVault() would fail because it internally calls
                // base64ToBuffer(encrypted.salt) — but the vault blob's salt field is a
                // DIFFERENT salt (from AES encryption), not the user's registration salt.
                try {
                    // A. Fetch the current encrypted vault
                    const token = localStorage.getItem("auth_token")
                    let deviceId = localStorage.getItem("device_id")
                    if (!deviceId) deviceId = "recovery-device"

                    const userId = localStorage.getItem("user_id")
                    
                    let vaultData = null
                    
                    // 1. Try Blob Sync API first
                    console.log("[ResetPassword] Trying Blob Sync API for vault data...")
                    const blobPullResponse = await fetch(
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

                    if (blobPullResponse.ok) {
                        const responseData = await blobPullResponse.json()
                        if (responseData?.blob?.ciphertext) {
                            vaultData = responseData.blob
                            console.log("[ResetPassword] Found vault in Blob Sync API")
                        }
                    }

                    // 2. Fallback to legacy Sync API
                    if (!vaultData && userId) {
                        console.log("[ResetPassword] Blob Sync API empty, trying legacy Sync API...")
                        const pullResponse = await fetch(
                            buildApiUrl("/sync/pull"), 
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
                                console.log("[ResetPassword] Found vault in legacy Sync API")
                            }
                        }
                    }
                    
                    // 3. Fallback to Compatibility API (SimpleVault)
                    if (!vaultData && userId) {
                        console.log("[ResetPassword] Sync APIs empty, trying Compatibility API...")
                        const compatResponse = await fetch(
                            buildApiUrl(`/api/vault/${encodeURIComponent(userId)}`),
                            {
                                method: "GET",
                                headers: {
                                    "Authorization": `Bearer ${token}`
                                }
                            }
                        )
                        
                        if (compatResponse.ok) {
                            const compatData = await compatResponse.json()
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
                        // B. Decrypt with OLD password using the SAME approach as VaultContext.unlockVault()
                        console.log("[ResetPassword] Decrypting vault with old password...")
                        const { decrypt, encrypt } = await import("@password-manager/crypto-engine")
                        
                        const oldSaltHex = localStorage.getItem("user_salt")
                        if (!oldSaltHex) {
                            throw new Error("Old user salt not found in localStorage")
                        }
                        const oldSaltChunks = oldSaltHex.match(/.{1,2}/g)
                        if (!oldSaltChunks) {
                            throw new Error("Invalid old salt format")
                        }
                        const oldSaltBytes = new Uint8Array(oldSaltChunks.map(byte => parseInt(byte, 16)))

                        const oldArgon2Memory = Number(localStorage.getItem("argon2_memory")) || 128
                        const oldArgon2Iterations = Number(localStorage.getItem("argon2_iterations")) || 1

                        console.log(`[ResetPassword] Deriving OLD key (m=${oldArgon2Memory}, t=${oldArgon2Iterations})...`)
                        const oldKeys = await deriveKey(oldMasterPassword, oldSaltBytes, {
                            memorySize: oldArgon2Memory,
                            iterations: oldArgon2Iterations,
                        })

                        const decryptedEntry = await decrypt(
                            {
                                ciphertext: vaultData.ciphertext,
                                iv: vaultData.iv,
                                salt: vaultData.salt,
                                tag: vaultData.tag || vaultData.authTag,
                                algorithm: "AES-256-GCM" as const,
                                derivationAlgorithm: "Argon2id" as const,
                            },
                            oldKeys
                        )
                        
                        // C. Encrypt with NEW password using the unified new key
                        console.log("[ResetPassword] Re-encrypting vault with new password...")
                        const encryptionResult = await encrypt(
                            typeof decryptedEntry === 'object' && decryptedEntry !== null
                                ? decryptedEntry as any
                                : { url: "VAULT_ROOT", username: "SYSTEM", password: JSON.stringify(decryptedEntry) },
                            newKeys
                        )
                        
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
                        console.log("[ResetPassword] No vault data found to re-encrypt")
                    }
                } catch (reEncryptError) {
                    console.error("[ResetPassword] Re-encryption failed:", reEncryptError)
                    toast.warning("Could not re-encrypt existing vault. Your old credentials may be lost.")
                }
            }

            // Generate auth verifier using the SAME key derived above
            const verifier = await generateVerifier(newKeys.authKey)

            // Send to backend (with optional new vault)
            console.log("[ResetPassword] Sending to backend:", { 
                hasNewVaultBlob: !!newVaultBlob,
                vaultBlobKeys: newVaultBlob ? Object.keys(newVaultBlob) : []
            })
            
            const token = localStorage.getItem("auth_token")
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
                        encryptedVault: newVaultBlob,
                        confirmVaultDeletion: !newVaultBlob, // If we couldn't re-encrypt, allow vault deletion
                    })
                }
            )

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to reset password")
            }

            // A. If requested, auto-generate new recovery kit
            if (autoGenerateKit) {
                try {
                    console.log("[ResetPassword] Auto-generating new recovery kit...")
                    const email = localStorage.getItem("user_email") || ""
                    if (email && token) {
                        await generateAndDownloadRecoveryKey(email, password, token, getApiBaseUrl())
                        toast.success("New Emergency Kit generated and downloaded!")
                    }
                } catch (kitErr) {
                    console.error("[ResetPassword] Kit generation failed:", kitErr)
                    toast.warning("Password reset, but failed to generate new kit. Please generate it manually later.")
                }
            }

            // Success!
            // Update local storage credentials
            localStorage.setItem("user_salt", newSaltHex)
            localStorage.setItem("argon2_memory", String(newArgon2Params.memorySize))
            localStorage.setItem("argon2_iterations", String(newArgon2Params.iterations))
            
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
                                    placeholder="Enter your new password"
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

                        <div className="space-y-4">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirm-password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your new password again"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 bg-secondary/50 font-mono"
                                    required
                                    disabled={isLoading}
                                />
                            </div>

                            <PasswordStrength 
                                password={password} 
                                onStrengthChange={setIsPasswordValid} 
                            />
                        </div>

                        <div className="flex items-center space-x-3 py-3 px-3 bg-primary/5 rounded-xl border border-primary/10">
                             <input 
                                type="checkbox" 
                                id="auto-generate-kit"
                                checked={autoGenerateKit}
                                onChange={(e) => setAutoGenerateKit(e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                disabled={isLoading}
                             />
                             <Label htmlFor="auto-generate-kit" className="text-sm font-medium cursor-pointer flex-1 leading-tight">
                                Auto-generate new Emergency Kit
                                <p className="text-[10px] text-muted-foreground mt-0.5">Recommended to maintain backup access if your password changes.</p>
                             </Label>
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 pt-6">
                        <Button
                            type="submit"
                            className="w-full h-12 font-semibold shadow-lg shadow-primary/20"
                            disabled={isLoading || !isPasswordValid}
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
