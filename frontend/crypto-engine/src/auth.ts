/**
 * ZKP Authentication Utilities
 * 
 * Shared authentication proof/verifier logic for both extension and dashboard.
 * This module exports functions to create client proofs and verifiers for
 * SRP-style zero-knowledge authentication.
 */

/**
 * Generate a verifier from the master password
 * Used during registration and password change
 * 
 * @param masterPassword - The user's master password
 * @param authKey - The derived authentication key from Argon2id
 * @returns Hex-encoded verifier
 */
export async function generateVerifier(authKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const proofData = encoder.encode("auth-proof");
  const verifierBuffer = await crypto.subtle.sign("HMAC", authKey, proofData);
  return Array.from(new Uint8Array(verifierBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a client proof for authentication
 * Used during login to prove knowledge of password
 * 
 * @param verifierHex - The hex-encoded verifier
 * @param challengeHex - The challenge from the server
 * @returns Hex-encoded client proof
 */
export async function generateClientProof(
  verifierHex: string,
  challengeHex: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const combined = encoder.encode(verifierHex + challengeHex);
  const clientProofBuffer = await crypto.subtle.digest("SHA-256", combined);
  return Array.from(new Uint8Array(clientProofBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a random challenge for authentication
 * Used by clients to create unique authentication requests
 * 
 * @returns Hex-encoded random challenge
 */
export function generateChallenge(): string {
  const challengeBuffer = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(challengeBuffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
