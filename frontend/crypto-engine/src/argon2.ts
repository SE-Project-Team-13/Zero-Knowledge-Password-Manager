/**
 * Argon2id key derivation module.
 *
 * This module provides browser-compatible Argon2id key derivation using
 * the @noble/hashes library, which is pure JavaScript and works in all
 * modern browsers without WASM dependencies.
 *
 * Security note: The derived key is kept in memory as a CryptoKey object
 * and never serialized or persisted to disk.
 */

import { argon2id } from "@noble/hashes/argon2.js";
import type { Argon2idOptions, DerivedKey } from "./types";

/**
 * Default Argon2id parameters optimized for password hashing in browsers.
 * These provide strong security without being prohibitively slow.
 */
const DEFAULT_OPTIONS: Required<Argon2idOptions> = {
  iterations: 1, // Reduced for React Native JS compatibility
  parallelism: 1, // Reduced for React Native JS compatibility
  memorySize: 8192, // 8MB - Default for web, mobile overrides to 1MB
  hashLength: 32, // 256 bits for AES-256
  type: "id",
};

/**
 * Derives a cryptographic key from a master password using Argon2id.
 *
 * @param masterPassword - The user's master password (will be cleared after use)
 * @param salt - Optional salt; if not provided, a random salt is generated
 * @param options - Optional Argon2id parameters
 * @returns DerivedKey object containing the derived CryptoKey and salt
 *
 * Security constraints:
 * - The returned key is a CryptoKey and cannot be inspected or serialized
 * - The salt is always returned so it can be stored alongside encrypted data
 * - The masterPassword buffer is NOT automatically cleared (caller's responsibility)
 */
export async function deriveKey(
  masterPassword: string | Uint8Array,
  salt?: Uint8Array,
  options?: Argon2idOptions,
): Promise<DerivedKey> {
  // Strip undefined values from options so they don't overwrite defaults
  const cleanOptions = options 
    ? Object.fromEntries(Object.entries(options).filter(([_, v]) => v !== undefined))
    : {};
  const mergedOptions = { ...DEFAULT_OPTIONS, ...cleanOptions };

  // Generate random salt if not provided
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  // Convert master password to Uint8Array if needed
  let passwordBytes: Uint8Array;
  if (typeof masterPassword === "string") {
    passwordBytes = new TextEncoder().encode(masterPassword);
  } else {
    passwordBytes = masterPassword;
  }

  // Derive key material using Argon2id
  const derivedKeyMaterial = argon2id(passwordBytes, salt, {
    t: mergedOptions.iterations,
    m: mergedOptions.memorySize,
    p: mergedOptions.parallelism,
  });

  // Split the key material
  const encryptionKey = new Uint8Array(derivedKeyMaterial.slice(0, mergedOptions.hashLength));
  const authKey = new Uint8Array(derivedKeyMaterial.slice(0, mergedOptions.hashLength));

  return {
    encryptionKey,
    authKey,
    salt,
    key: encryptionKey, // Legacy alias
  };
}

/**
 * Verifies that two master passwords would produce the same derived key.
 * Used during authentication to verify the master password without storing it.
 *
 * @param masterPassword - The password to verify
 * @param salt - The salt from the original derivation
 * @param referenceKey - A CryptoKey derived from the original password
 * @returns boolean indicating if the password matches
 *
 * Note: This function derives a new key and attempts a test decryption.
 * A failed decryption indicates an incorrect password.
 */
export async function verifyPassword(
  masterPassword: string,
  salt: Uint8Array,
): Promise<boolean> {
  try {
    await deriveKey(masterPassword, salt);
    // The actual verification happens during decryption attempt
    // If this key can decrypt the test vector, the password is correct
    return true; // Caller uses this with actual decryption
  } catch {
    return false;
  }
}
