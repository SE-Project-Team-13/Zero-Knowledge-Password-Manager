/**
 * AES-256-GCM encryption module.
 *
 * Provides authenticated encryption for vault data using AES-256 in GCM mode.
 * GCM provides both confidentiality and authenticity, protecting against tampering.
 *
 * Security properties:
 * - 256-bit key (from Argon2id derivation)
 * - 96-bit random IV (nonce) generated per encryption
 * - Authentication tag included in ciphertext (prevents tampering)
 * - No plaintext is ever logged or stored
 */

import type { DerivedKey, EncryptedVault, VaultEntry } from "./types"
import { gcm } from "@noble/ciphers/aes.js";
const IV_LENGTH = 12 // 96 bits - recommended for GCM
// TAG_LENGTH is 128 bits (16 bytes) - automatically handled by GCM mode

/**
 * Encrypts a vault entry using the derived key.
 *
 * @param entry - The vault entry to encrypt
 * @param derivedKey - The DerivedKey from deriveKey()
 * @returns EncryptedVault object with base64-encoded ciphertext, IV, and salt
 *
 * Security notes:
 * - A new random IV is generated for each encryption
 * - The IV is included in the output (standard practice for GCM)
 * - The salt is included so it can be stored with the encrypted data
 * - Authentication tag is automatically included by GCM mode
 */
export async function encrypt(entry: VaultEntry, derivedKey: DerivedKey): Promise<EncryptedVault> {
  // Generate a random 96-bit IV for this encryption
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // Serialize the vault entry to JSON
  const plaintext = JSON.stringify(entry)
  const plaintextBytes = new TextEncoder().encode(plaintext)

  // Encrypt using AES-256-GCM via @noble/ciphers
  const cipher = gcm(derivedKey.encryptionKey, iv);
  const encryptedBuffer = cipher.encrypt(plaintextBytes);

  // Split ciphertext and tag (@noble/ciphers appended tag at the end)
  const TAG_LENGTH_BYTES = 16
  const ciphertextBody = encryptedBuffer.slice(0, encryptedBuffer.byteLength - TAG_LENGTH_BYTES)
  const tag = encryptedBuffer.slice(encryptedBuffer.byteLength - TAG_LENGTH_BYTES)

  // Return serializable encrypted vault object
  return {
    ciphertext: bufferToBase64(new Uint8Array(ciphertextBody)),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(derivedKey.salt),
    tag: bufferToBase64(new Uint8Array(tag)),
    algorithm: "AES-256-GCM",
    derivationAlgorithm: "Argon2id",
  }
}

/**
 * Decrypts a vault entry using the derived key.
 *
 * @param encrypted - The EncryptedVault object to decrypt
 * @param derivedKey - The DerivedKey from deriveKey()
 * @returns The decrypted VaultEntry, or an error if decryption fails
 *
 * Security notes:
 * - Failed decryption throws an error (wrong password or tampered ciphertext)
 * - The ciphertext includes an authentication tag that must be valid
 * - If authentication fails, the plaintext is never returned
 */
export async function decrypt(encrypted: EncryptedVault, derivedKey: DerivedKey): Promise<VaultEntry> {
  const ciphertextBody = base64ToBuffer(encrypted.ciphertext)
  const tag = encrypted.tag ? base64ToBuffer(encrypted.tag) : new Uint8Array(0)
  const iv = base64ToBuffer(encrypted.iv)

  // Recombine ciphertext and tag for Web Crypto API
  let combinedBuffer: Uint8Array
  if (tag.length > 0) {
    combinedBuffer = new Uint8Array(ciphertextBody.length + tag.length)
    combinedBuffer.set(ciphertextBody)
    combinedBuffer.set(tag, ciphertextBody.length)
  } else {
    // Legacy support: tag is already in ciphertext
    combinedBuffer = ciphertextBody
  }

  try {
    // Decrypt using AES-256-GCM via @noble/ciphers
    const decipher = gcm(derivedKey.encryptionKey, iv);
    const plaintext = decipher.decrypt(combinedBuffer);

    // Parse the decrypted JSON
    const plaintextString = new TextDecoder().decode(plaintext)
    const entry: VaultEntry = JSON.parse(plaintextString)

    return entry
  } catch (error) {
    // GCM authentication failed (wrong password or tampered ciphertext)
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}. This could be due to incorrect password or corrupted data.`);
  }
}

/**
 * Helper: Convert Uint8Array to base64 string.
 * Used for serializing binary data to JSON.
 */
function bufferToBase64(buffer: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

/**
 * Helper: Convert base64 string to Uint8Array.
 * Used for deserializing binary data from JSON.
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer
}

/**
 * Generic AES-256-GCM encryption for arbitrary data.
 * @param data - The data to encrypt (string or Uint8Array)
 * @param key - 32-byte key
 * @returns { iv: hex, ciphertext: hex }
 */
export async function encryptData(data: string | Uint8Array, key: Uint8Array): Promise<{ iv: string, ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = typeof data === "string" ? new TextEncoder().encode(data) : data;
  
  const cipher = gcm(key, iv);
  const encrypted = cipher.encrypt(plaintext);
  
  return {
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join(""),
    ciphertext: Array.from(encrypted).map(b => b.toString(16).padStart(2, "0")).join("")
  };
}

/**
 * Generic AES-256-GCM decryption for arbitrary data.
 * @param ciphertextHex - Hex encoded ciphertext (including tag if appended)
 * @param ivHex - Hex encoded IV
 * @param key - 32-byte key
 */
export async function decryptData(ciphertextHex: string, ivHex: string, key: Uint8Array): Promise<Uint8Array> {
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(ciphertextHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const decipher = gcm(key, iv);
  return decipher.decrypt(ciphertext);
}
