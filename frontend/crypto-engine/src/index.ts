/**
 * crypto-engine: Zero-Knowledge Cryptographic Core for Password Managers
 *
 * Main entry point exporting all public APIs.
 */

export {
  deriveKey,
  verifyPassword,
} from "./argon2"

export {
  encrypt,
  decrypt,
} from "./aes"

export {
  encryptVault,
  decryptVault,
  validateVaultEntry,
  createVaultEntry,
} from "./vault"

export {
  generateVerifier,
  generateClientProof,
  generateChallenge,
} from "./auth"

export type {
  DerivedKey,
  VaultEntry,
  EncryptedVault,
  Argon2idOptions,
  DecryptResult,
} from "./types"
