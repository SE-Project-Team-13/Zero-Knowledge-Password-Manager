/**
 * Recovery Service: Handles recovery key generation, storage, and verification.
 * The recovery key allows users to regain access if they forget their master password.
 * 
 * Security: Only the SHA-256 hash of the recovery key is stored, never the raw key.
 */

import * as crypto from "crypto"
import { RecoveryKey, User, type IRecoveryKey } from "../database/models.js"
import mongoose from "mongoose"

/**
 * Generate a cryptographically secure recovery key.
 * Returns a 256-bit random key encoded as Base64 (44 characters).
 */
export function generateRecoveryKey(): string {
    const keyBytes = crypto.randomBytes(32) // 256 bits
    return keyBytes.toString("base64")
}

/**
 * Format recovery key - currently returns the raw key without dashes
 * to ensure maximum consistency across PDF and UI.
 */
export function formatRecoveryKey(key: string): string {
    return key.replace(/[\s-]/g, "")
}

/**
 * Hash a recovery key using SHA-256 for secure storage.
 * We never store the raw key, only its hash.
 */
export function hashRecoveryKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex")
}

/**
 * Store a hashed recovery key for a user with the encrypted master key.
 * Revokes any existing recovery keys for the user.
 */
export async function storeRecoveryKeyHash(
    userId: string,
    keyHash: string,
    encryptedVaultKey: string
): Promise<IRecoveryKey> {
    // Revoke any existing recovery keys for this user
    await RecoveryKey.updateMany(
        { userId: new mongoose.Types.ObjectId(userId), isRevoked: false },
        { isRevoked: true }
    )

    // Create new recovery key record
    const recoveryKey = new RecoveryKey({
        userId: new mongoose.Types.ObjectId(userId),
        keyHash,
        encryptedVaultKey,
        createdAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        isRevoked: false,
    })

    return recoveryKey.save()
}

/**
 * Verify a recovery key for a given email.
 * Returns the user if verification succeeds, null otherwise.
 */
export async function verifyRecoveryKey(
    email: string,
    recoveryKey: string
): Promise<{ success: boolean; userId?: string; encryptedVaultKey?: string; error?: string }> {
    try {
        // Find the user by email
        const user = await User.findOne({ email: email.trim().toLowerCase() })
        if (!user) {
            return { success: false, error: "User not found" }
        }

        // Hash the provided recovery key
        const keyHash = hashRecoveryKey(recoveryKey)

        // Find a valid (non-revoked, unused) recovery key for this user
        const storedKey = await RecoveryKey.findOne({
            userId: user._id,
            keyHash,
            isRevoked: false,
        })

        if (!storedKey) {
            return { success: false, error: "Invalid recovery key" }
        }

        // Mark the recovery key as used
        storedKey.usedAt = new Date().toISOString().replace("T", " ").substring(0, 19)
        await storedKey.save()

        return { 
            success: true, 
            userId: user._id.toString(), 
            encryptedVaultKey: storedKey.encryptedVaultKey 
        }
    } catch (error) {
        console.error("[Recovery] Verification error:", error)
        return { success: false, error: "Verification failed" }
    }
}

/**
 * Check if a user has an active recovery key.
 */
export async function hasActiveRecoveryKey(userId: string): Promise<boolean> {
    const count = await RecoveryKey.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        isRevoked: false,
        usedAt: { $exists: false },
    })
    return count > 0
}

/**
 * Revoke all recovery keys for a user.
 * Should be called when user changes their password.
 */
export async function revokeAllRecoveryKeys(userId: string): Promise<void> {
    await RecoveryKey.updateMany(
        { userId: new mongoose.Types.ObjectId(userId) },
        { isRevoked: true }
    )
}
