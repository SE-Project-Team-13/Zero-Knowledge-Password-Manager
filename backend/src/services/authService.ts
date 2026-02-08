import crypto from "crypto"
import { User, Session } from "../database/models.js"
import type { User as UserType } from "../types/index.js"

/**
 * Verifies the client's cryptographic proof against the server's verifier.
 * Uses SHA-256 for proof generation and timing-safe comparison.
 * @param verifier - The stored verifier for the user.
 * @param clientChallenge - The challenge sent by the server for this attempt.
 * @param clientProof - The proof provided by the client.
 * @returns boolean indicating if the proof is valid.
 */
function verifyClientProof(verifier: string, clientChallenge: string, clientProof: string): boolean {
  const expectedProof = crypto
    .createHash("sha256")
    .update(verifier + clientChallenge)
    .digest("hex")

  return crypto.timingSafeEqual(Buffer.from(clientProof), Buffer.from(expectedProof))
}

/**
 * Registers a new user with their email, salt, and verifier.
 * @param email - User's email address.
 * @param salt - Cryptographic salt for key derivation.
 * @param verifier - The verifier for ZKP authentication.
 * @returns The newly created user object.
 */
export async function registerUser(email: string, salt: string, verifier: string): Promise<UserType> {
  const user = new User({
    email,
    salt,
    verifier,
  })

  await user.save()

  return {
    id: user._id.toString(),
    email: user.email,
    salt: user.salt,
    verifier: user.verifier,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

/**
 * Authenticates a user using the ZKP proof provided.
 * @param email - User's email.
 * @param clientChallenge - The challenge for this authentication session.
 * @param clientProof - The proof derived by the client.
 * @returns Success status and user object or error message.
 */
export async function authenticateUser(
  email: string,
  clientChallenge: string,
  clientProof: string,
): Promise<{ success: boolean; user?: UserType; error?: string }> {
  const user = await User.findOne({ email })

  if (!user) {
    return { success: false, error: "User not found" }
  }

  try {
    const isValid = verifyClientProof(user.verifier, clientChallenge, clientProof)
    if (!isValid) {
      return { success: false, error: "Authentication failed" }
    }
  } catch (error) {
    return { success: false, error: "Authentication verification failed" }
  }

  return {
    success: true,
    user: {
      id: user._id.toString(),
      email: user.email,
      salt: user.salt,
      verifier: user.verifier,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isBreached: user.isBreached,
      lastBreachCheck: user.lastBreachCheck,
    },
  }
}

/**
 * Generates a random session token for an authenticated user.
 * @param userId - The ID of the user.
 * @param expirationMinutes - Token validity duration (default: 24h).
 * @returns The generated session token.
 */
export async function generateSessionToken(
  userId: string,
  expirationMinutes: number = 24 * 60,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000)

  const session = new Session({
    userId,
    token,
    expiresAt,
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
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const session = await Session.findOne({ token, expiresAt: { $gt: new Date() } })

  if (!session) {
    return { valid: false, error: "Invalid or expired token" }
  }

  return { valid: true, userId: session.userId.toString() }
}

/**
 * Invalidates (deletes) a session token, effectively logging the user out.
 * @param token - The token to invalidate.
 */
export async function invalidateSessionToken(token: string): Promise<void> {
  await Session.deleteOne({ token })
}

/**
 * Retrieves the salt associated with a user email.
 * Used during the first phase of authentication to let the client derive keys.
 * @param email - User's email.
 * @returns The user's salt or null if not found.
 */
export async function getUserSalt(email: string): Promise<string | null> {
  const user = await User.findOne({ email })
  return user ? user.salt : null
}
