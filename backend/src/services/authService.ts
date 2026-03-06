import crypto from "crypto"
import { User, Session, VaultBlob, SyncMetadata, SimpleVault, OTP, RecoveryKey, LoginChallenge } from "../database/models.js"
import { revokeAllRecoveryKeys } from "./recoveryService.js"
import type { User as UserType } from "../types/index.js"

const isProduction = process.env.NODE_ENV === "production"
const isDebug = process.env.DEBUG === "true"

/**
 * Verifies the client's cryptographic proof against the server's verifier.
 * Uses SHA-256 for proof generation and timing-safe comparison.
 * @param verifier - The stored verifier for the user.
 * @param clientChallenge - The challenge sent by the server for this attempt.
 * @param clientProof - The proof provided by the client.
 * @returns boolean indicating if the proof is valid.
 */
export function verifyClientProof(verifier: string, clientChallenge: string, clientProof: string): boolean {
  const expectedProof = crypto
    .createHash("sha256")
    .update(verifier + clientChallenge)
    .digest("hex")

  const bufferA = Buffer.from(clientProof)
  const bufferB = Buffer.from(expectedProof)

  if (bufferA.length !== bufferB.length) return false

  return crypto.timingSafeEqual(bufferA, bufferB)
}
 
/**
 * Hashes a session token for secure storage.
 * @param token - The raw session token.
 * @returns Hashed token.
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/**
 * Registers a new user with their email, full name, salt, and verifier.
 * @param email - User's email address.
 * @param fullName - User's full display name.
 * @param salt - Cryptographic salt for key derivation.
 * @param verifier - The verifier for ZKP authentication.
 * @returns The newly created user object.
 */
export async function registerUser(email: string, fullName: string, salt: string, verifier: string, argon2Memory: number = 8192, argon2Iterations: number = 1): Promise<UserType> {
  const user = new User({
    email: email.trim().toLowerCase(),
    fullName: fullName.trim(),
    salt,
    verifier,
    argon2Memory,
    argon2Iterations,
  })

  await user.save()

  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    salt: user.salt,
    verifier: user.verifier,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    is2faEnabled: user.is2faEnabled,
  }
}

/**
 * Authenticates a user using the ZKP proof provided.
 * Verifies that the challenge provided by the client matches the fresh server-generated challenge.
 * 
 * @param email - User's email.
 * @param clientChallenge - The challenge provided by the client (must match server's stored challenge).
 * @param clientProof - The proof derived by the client.
 * @returns Success status and user object or error message.
 */
export async function authenticateUser(
  email: string,
  clientChallenge: string,
  clientProof: string,
): Promise<{ success: boolean; user?: UserType; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await User.findOne({ email: normalizedEmail })

  if (!user) {
    return { success: false, error: "User not found" }
  }

  // 1. Verify Challenge Freshness (Replay Protection)
  const storedChallenge = await LoginChallenge.findOne({ email: normalizedEmail })
  if (!storedChallenge) {
    return { success: false, error: "Authentication challenge expired or not found. Please request a new salt/challenge." }
  }

  // Check TTL (Date comparison)
  if (storedChallenge.expiresAt < new Date()) {
    await LoginChallenge.deleteOne({ _id: storedChallenge._id })
    return { success: false, error: "Authentication challenge expired. Please try again." }
  }

  if (storedChallenge.challenge !== clientChallenge) {
    return { success: false, error: "Invalid authentication challenge." }
  }

  // 2. Clear challenge once used (single-use)
  await LoginChallenge.deleteOne({ _id: storedChallenge._id })

  // 3. Verify Proof
  try {
    const isValid = verifyClientProof(user.verifier, clientChallenge, clientProof)
    if (!isValid) {
      return { success: false, error: "Wrong password" }
    }
  } catch (error: unknown) {
    if (!isProduction || isDebug) {
      console.error("[VaultSync:Auth] Authentication verification failed:", error)
    }
    return { success: false, error: "Authentication verification failed" }
  }

  return {
    success: true,
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      salt: user.salt,
      verifier: user.verifier,
      createdAt: user.createdAt,
       updatedAt: user.updatedAt,
       isBreached: user.isBreached,
       lastBreachCheck: user.lastBreachCheck,
       is2faEnabled: user.is2faEnabled,
     },
   }
}

/**
 * Generates and stores a fresh authentication challenge for a user.
 * 
 * @param email - User's email.
 * @param ttlMinutes - Challenge validity duration (e.g., 5 mins).
 * @returns Hex-encoded challenge.
 */
 export async function generateLoginChallenge(
  email: string,
  ttlMinutes: number = 5
): Promise<string> {
  const challenge = crypto.randomBytes(16).toString("hex")
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)

  await LoginChallenge.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { challenge, expiresAt },
    { upsert: true }
  )

  return challenge
}

/**
 * Generates a random session token for an authenticated user.
 * @param userId - The ID of the user.
 * @param expirationMinutes - Token validity duration (default: 24h).
 * @param isOtpVerified - Initial OTP verification status (default: false).
 * @returns The generated session token.
 */
 export async function generateSessionToken(
  userId: string,
  expirationMinutes: number = 24 * 60,
  isOtpVerified: boolean = false,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000)

  const session = new Session({
    userId,
    token: hashToken(token),
    expiresAt,
    isOtpVerified,
  })

  await session.save()
  return token
}

/**
 * Validates a session token and ensures it hasn't expired.
 * @param token - The session token to check.
 * @returns Validation status and userId if valid.
 */
 export async function validateSessionToken(
  token: string,
): Promise<{ valid: boolean; userId?: string; error?: string; isOtpVerified?: boolean; is2faEnabled?: boolean }> {
  const hashedToken = hashToken(token)
  const session = await Session.findOne({ token: hashedToken, expiresAt: { $gt: new Date() } }).populate("userId")

  if (!session) {
    if (!isProduction || isDebug) {
      console.warn("[VaultSync:Auth] Session not found or expired for token:", token.substring(0, 20) + "...")
    }
    return { valid: false, error: "Invalid or expired token" }
  }

  if (!isProduction || isDebug) {
    console.log("[VaultSync:Auth] Session validated successfully. isOtpVerified:", session.isOtpVerified)
  }
  
  const user = session.userId as any;
  return { 
    valid: true, 
    userId: session.userId._id.toString(), 
    isOtpVerified: session.isOtpVerified,
    is2faEnabled: user?.is2faEnabled || false
  }
}

/**
 * Marks a session as OTP verified.
 * @param token - The session token.
 */
export async function markSessionOtpVerified(token: string): Promise<void> {
  if (!isProduction || isDebug) {
    console.log("[VaultSync:Auth] Updating session OTP verification for token:", token.substring(0, 20) + "...")
  }
  const hashedToken = hashToken(token)
  const result = await Session.updateOne({ token: hashedToken }, { isOtpVerified: true })
  if (result.modifiedCount === 0) {
    if (!isProduction || isDebug) {
      console.warn("[VaultSync:Auth] Warning: No session found to update with token:", token.substring(0, 20) + "...")
    }
  } else if (!isProduction || isDebug) {
    console.log("[VaultSync:Auth] Session marked as OTP verified successfully")
  }
}

/**
 * Invalidates (deletes) a session token, effectively logging the user out.
 * @param token - The token to invalidate.
 */
export async function invalidateSessionToken(token: string): Promise<void> {
  const hashedToken = hashToken(token)
  await Session.deleteOne({ token: hashedToken })
}

/**
 * Checks if a user with the given email already exists.
 * @param email - User's email to check.
 * @returns boolean indicating if the user exists.
 */
export async function checkUserExists(email: string): Promise<boolean> {
  const user = await User.findOne({ email: email.trim().toLowerCase() })
  return !!user
}

/**
 * Retrieves the salt associated with a user email.
 * Used during the first phase of authentication to let the client derive keys.
 * @param email - User's email.
 * @returns The user's salt or null if not found.
 */
export async function getUserSalt(email: string): Promise<{ salt: string, argon2Memory?: number, argon2Iterations?: number } | null> {
  const user = await User.findOne({ email: email.trim().toLowerCase() })
  return user ? { salt: user.salt, argon2Memory: user.argon2Memory, argon2Iterations: user.argon2Iterations } : null
}

/**
 * Updates a user's credentials (salt and verifier).
 * Optionally updates the vault blob if provided (for re-encryption flows).
 * Used for password reset flows.
 * @param userId - The ID of the user to update.
 * @param salt - The new salt.
 * @param verifier - The new verifier.
 * @param encryptedVault - (Optional) The new encrypted vault blob.
 */
export async function updateUserCredentials(
  userId: string,
  salt: string,
  verifier: string,
   encryptedVault?: {
    ciphertext: string
    iv: string
    salt: string
    authTag: string
    version: number
    deviceId: string
  },
  argon2Memory?: number,
  argon2Iterations?: number,
  confirmVaultDeletion?: boolean
): Promise<void> {
  // Update User credentials
  const updateData: any = { salt, verifier }
  if (argon2Memory !== undefined) updateData.argon2Memory = argon2Memory
  if (argon2Iterations !== undefined) updateData.argon2Iterations = argon2Iterations

  await User.findByIdAndUpdate(userId, updateData)

  // Revoke all existing recovery keys (they point to the old password)
  await revokeAllRecoveryKeys(userId)

  // 3. If new vault data is provided, update it (Re-encryption)
  console.log(`[AuthService] updateUserCredentials called for user ${userId}, hasEncryptedVault: ${!!encryptedVault}`)
  if (encryptedVault) {
    console.log(`[AuthService] Saving re-encrypted vault with deviceId: ${encryptedVault.deviceId}, ciphertext length: ${encryptedVault.ciphertext?.length}`);
    // Update Sync Vault (VaultBlob)
    await VaultBlob.findOneAndUpdate(
      { userId, deviceId: encryptedVault.deviceId },
      {
        ciphertext: encryptedVault.ciphertext,
        iv: encryptedVault.iv,
        salt: encryptedVault.salt,
        authTag: encryptedVault.authTag,
        version: encryptedVault.version,
         timestamp: Date.now(),
        nonce: crypto.randomBytes(12).toString("hex"), // New nonce
        updatedAt: new Date()
      },
      { upsert: true }
    )

    // Update Compatibility Vault (SimpleVault)
    const user = await User.findById(userId);
    if (user) {
      const normalizedEmail = user.email.trim().toLowerCase();
      console.log(`[AuthService] Updating SimpleVault for ${normalizedEmail} with re-encrypted data`);
      // Map local sync format to simple vault format for compatibility
      await SimpleVault.findOneAndUpdate(
        { $or: [{ userId: userId }, { userId: normalizedEmail }] },
        {
          data: {
            ciphertext: encryptedVault.ciphertext,
            iv: encryptedVault.iv,
            salt: encryptedVault.salt,
             tag: encryptedVault.authTag, // Compatibility layer uses 'tag'
            version: encryptedVault.version
          },
          updatedAt: new Date()
        },
        { upsert: true }
      );
    }
   } else {
    // RECOVERY FLOW WITHOUT OLD PASSWORD:
    // If no new vault is provided, it means we couldn't re-encrypt.
    // We must clear the old vault data so the user doesn't get decryption errors.
    
    if (!confirmVaultDeletion) {
      console.warn(`[AuthService] updateUserCredentials: Vault deletion aborted for user ${userId} because confirmVaultDeletion was false/missing.`);
      return;
    }

    console.log(`[AuthService] Clearing unreadable vault data for user ${userId} after password reset.`);
    
    // Clear Sync Vaults
    await VaultBlob.deleteMany({ userId });
    
    // Clear Sync Metadata
    await SyncMetadata.deleteMany({ userId });
    
    // Clear Simple Vault (compatibility layer used by dashboard)
    const user = await User.findById(userId);
    if (user) {
      const normalizedEmail = user.email.trim().toLowerCase();
      await SimpleVault.deleteMany({ $or: [{ userId: userId }, { userId: normalizedEmail }] });
    }
  }
}

/**
 * Deletes a user account and all associated data permanently.
 * @param userId - The ID of the user to delete.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await User.findById(userId)
  if (!user) return

  // 1. Delete User Record
  await User.findByIdAndDelete(userId)

  // 2. Delete Sessions
  await Session.deleteMany({ userId })

  // 3. Delete Vault Blobs (Sync)
  await VaultBlob.deleteMany({ userId })

  // 4. Delete Sync Metadata
  await SyncMetadata.deleteMany({ userId })

  // 5. Delete Recovery Keys
  await RecoveryKey.deleteMany({ userId })

  // 6. Delete Simple Vault (Compatibility) and OTPs using email
  const email = user.email.toLowerCase()
  await SimpleVault.deleteMany({ $or: [{ userId: userId }, { userId: email }] })
  await OTP.deleteMany({ email })
}

