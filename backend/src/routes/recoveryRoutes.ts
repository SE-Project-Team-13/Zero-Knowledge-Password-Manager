/**
 * Recovery Routes: API endpoints for recovery key management.
 */

import { Router, type Request, type Response } from "express"
import {
    generateRecoveryKey,
    formatRecoveryKey,
    hashRecoveryKey,
    storeRecoveryKeyHash,
    verifyRecoveryKey,
    hasActiveRecoveryKey,
} from "../services/recoveryService.js"
import { User } from "../database/models.js"
import { generateSessionToken } from "../services/authService.js"

export function createRecoveryRouter(): Router {
    const router = Router()

    /**
     * POST /recovery/generate
     * Generate a new recovery key for the authenticated user.
     * Returns the raw key (only time it's shown) and stores the hash.
     */
    router.post("/generate", async (req: Request, res: Response) => {
        try {
            let { email } = req.body

            if (!email) {
                return res.status(400).json({
                    error: "Missing email",
                    code: "INVALID_REQUEST",
                })
            }
            
            email = email.trim().toLowerCase()

            // Find the user
            const user = await User.findOne({ email })
            if (!user) {
                return res.status(404).json({
                    error: "User not found",
                    code: "USER_NOT_FOUND",
                })
            }

            // Generate new recovery key
            const rawKey = generateRecoveryKey()
            
            // We DO NOT store it yet. The client must encrypt their master password 
            // with this key and call /activate to store the hash + encrypted blob.

            return res.status(200).json({
                recoveryKey: rawKey,
                formattedKey: formatRecoveryKey(rawKey),
                message: "Recovery key generated. You must activate it to enable recovery.",
            })
        } catch (error) {
            console.error("[Recovery] Generate error:", error)
            return res.status(500).json({
                error: "Failed to generate recovery key",
                code: "INTERNAL_ERROR",
            })
        }
    })

    /**
     * POST /recovery/activate
     * Stored the hashed recovery key and the encrypted master password blob.
     * This must be called after /generate to actually enable recovery.
     */
    router.post("/activate", async (req: Request, res: Response) => {
        try {
            let { email, keyHash, encryptedVaultKey } = req.body

            if (!email || !keyHash || !encryptedVaultKey) {
                return res.status(400).json({
                    error: "Missing required fields",
                    code: "INVALID_REQUEST",
                })
            }
            
            email = email.trim().toLowerCase()

            const user = await User.findOne({ email })
            if (!user) {
                return res.status(404).json({
                    error: "User not found",
                    code: "USER_NOT_FOUND",
                })
            }

            await storeRecoveryKeyHash(user._id.toString(), keyHash, encryptedVaultKey)

            return res.status(200).json({
                success: true,
                message: "Recovery key activated successfully",
            })
        } catch (error) {
            console.error("[Recovery] Activate error:", error)
            return res.status(500).json({
                error: "Failed to activate recovery key",
                code: "INTERNAL_ERROR",
            })
        }
    })

    /**
     * POST /recovery/verify
     * Verify a recovery key (for checking purposes, doesn't consume it).
     */
    router.post("/verify", async (req: Request, res: Response) => {
        try {
            let { email, recoveryKey } = req.body

            if (!email || !recoveryKey) {
                return res.status(400).json({
                    error: "Missing email or recovery key",
                    code: "INVALID_REQUEST",
                })
            }
            
            email = email.trim().toLowerCase()

            // Clean up the recovery key (remove dashes if formatted)
            const cleanKey = recoveryKey.replace(/-/g, "")

            const result = await verifyRecoveryKey(email, cleanKey)

            if (!result.success) {
                return res.status(401).json({
                    error: result.error,
                    code: "INVALID_KEY",
                })
            }

            return res.status(200).json({
                valid: true,
                message: "Recovery key is valid",
            })
        } catch (error) {
            console.error("[Recovery] Verify error:", error)
            return res.status(500).json({
                error: "Verification failed",
                code: "INTERNAL_ERROR",
            })
        }
    })

    /**
     * POST /recovery/login
     * Login using a recovery key instead of password.
     * Consumes the recovery key (marks it as used).
     */
    router.post("/login", async (req: Request, res: Response) => {
        try {
            let { email, recoveryKey } = req.body

            if (!email || !recoveryKey) {
                return res.status(400).json({
                    error: "Missing email or recovery key",
                    code: "INVALID_REQUEST",
                })
            }
            
            email = email.trim().toLowerCase()

            // Clean up the recovery key (remove dashes if formatted)
            const cleanKey = recoveryKey.replace(/-/g, "")

            const result = await verifyRecoveryKey(email, cleanKey)

            if (!result.success) {
                return res.status(401).json({
                    error: result.error || "Invalid recovery key",
                    code: "INVALID_KEY",
                })
            }

            // Generate a session token for the user
            const sessionToken = await generateSessionToken(result.userId!)

            // Get user details
            const user = await User.findById(result.userId)

            return res.status(200).json({
                success: true,
                sessionToken,
                userId: result.userId,
                salt: user?.salt,
                encryptedVaultKey: result.encryptedVaultKey, // Return the encrypted blob
                message: "Recovery login successful.",
                requiresPasswordReset: false, // No longer forced since we recovered the key!
            })
        } catch (error) {
            console.error("[Recovery] Login error:", error)
            return res.status(500).json({
                error: "Recovery login failed",
                code: "INTERNAL_ERROR",
            })
        }
    })

    /**
     * GET /recovery/status/:email
     * Check if user has an active recovery key.
     */
    router.get("/status/:email", async (req: Request, res: Response) => {
        try {
            let { email } = req.params
            
            if (email) {
                email = email.trim().toLowerCase()
            }

            const user = await User.findOne({ email })
            if (!user) {
                return res.status(404).json({
                    error: "User not found",
                    code: "USER_NOT_FOUND",
                })
            }

            const hasKey = await hasActiveRecoveryKey(user._id.toString())

            return res.status(200).json({
                hasRecoveryKey: hasKey,
            })
        } catch (error) {
            console.error("[Recovery] Status error:", error)
            return res.status(500).json({
                error: "Failed to check recovery key status",
                code: "INTERNAL_ERROR",
            })
        }
    })

    return router
}
