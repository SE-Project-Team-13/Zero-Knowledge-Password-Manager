import mongoose, { Schema, Document } from "mongoose"

/**
 * User Schema: Stores core user identity and ZKP verifier.
 * Salt and verifier are used for the Zero-Knowledge Proof authentication flow.
 */
export interface IUser extends Document {
  email: string
  fullName: string
  salt: string
  verifier: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  salt: { type: String, required: true },
  verifier: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

/**
 * Session Schema: Manages active authenticated sessions.
 * Tokens are used for authorizing vault sync operations.
 */
export interface ISession extends Document {
  userId: mongoose.Types.ObjectId
  token: string
  expiresAt: Date
  createdAt: Date
}

const SessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
})

/**
 * Vault Blob Schema: Stores the encrypted vault payload for a specific device.
 * Uses a versioning system and nonces to manage synchronization state.
 */
export interface IVaultBlob extends Document {
  userId: mongoose.Types.ObjectId
  deviceId: string
  ciphertext: string
  salt: string
  iv: string
  authTag: string
  version: number
  timestamp: number
  nonce: string
  createdAt: Date
  updatedAt: Date
}

const VaultBlobSchema = new Schema<IVaultBlob>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  deviceId: { type: String, required: true },
  ciphertext: { type: String, required: true },
  salt: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  version: { type: Number, required: true },
  timestamp: { type: Number, required: true },
  nonce: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

/**
 * Sync Metadata Schema: Tracks the current state of a user's vault across devices.
 * Helps detect conflicts and determine if a sync is necessary.
 */
export interface ISyncMetadata extends Document {
  userId: mongoose.Types.ObjectId
  deviceId: string
  lastUpdated: number
  vaultVersion: number
  nonce: string
  createdAt: Date
  updatedAt: Date
}

const SyncMetadataSchema = new Schema<ISyncMetadata>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  deviceId: { type: String, required: true },
  lastUpdated: { type: Number, required: true },
  vaultVersion: { type: Number, required: true },
  nonce: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})
// Compound index ensures only one sync record exists per user/device pair.
SyncMetadataSchema.index({ userId: 1, deviceId: 1 }, { unique: true })

/**
 * Simple Vault Schema: Used for compatibility with simpler extension storage models.
 * Stores arbitrary encrypted data and optional plaintext labels.
 */
export interface ISimpleVault extends Document {
  userId: string
  data: any
  labels: string[]
  updatedAt: Date
}

const SimpleVaultSchema = new Schema<ISimpleVault>({
  userId: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, required: true },
  labels: { type: [String], default: [] }, // Plaintext labels for identification
  updatedAt: { type: Date, default: Date.now },
})

/**
 * OTP Schema: Manages One-Time Passwords for email-based secondary verification.
 * Includes automatic expiration logic via TTL index.
 */
export interface IOTP extends Document {
  email: string
  code: string
  expiresAt: Date
  verified: boolean
  createdAt: Date
}

const OTPSchema = new Schema<IOTP>({
  email: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
})

// Index for automatic deletion of expired OTPs (TTL Index)
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

/**
 * RecoveryKey Schema: Stores hashed recovery keys for emergency access.
 * Only the SHA-256 hash is stored - the raw key is never saved.
 * Users can use this key to regain access if they forget their password.
 */
export interface IRecoveryKey extends Document {
  userId: mongoose.Types.ObjectId
  keyHash: string
  encryptedVaultKey: string // Encrypted master password/key
  createdAt: Date
  usedAt?: Date
  isRevoked: boolean
}

const RecoveryKeySchema = new Schema<IRecoveryKey>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  keyHash: { type: String, required: true },
  encryptedVaultKey: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  usedAt: { type: Date },
  isRevoked: { type: Boolean, default: false },
})

// Index for fast lookup by userId
RecoveryKeySchema.index({ userId: 1 })

// Export Mongoose Models
export const User = mongoose.model<IUser>("User", UserSchema)
export const Session = mongoose.model<ISession>("Session", SessionSchema)
export const VaultBlob = mongoose.model<IVaultBlob>("VaultBlob", VaultBlobSchema)
export const SyncMetadata = mongoose.model<ISyncMetadata>("SyncMetadata", SyncMetadataSchema)
export const SimpleVault = mongoose.model<ISimpleVault>("SimpleVault", SimpleVaultSchema)
export const OTP = mongoose.model<IOTP>("OTP", OTPSchema)
export const RecoveryKey = mongoose.model<IRecoveryKey>("RecoveryKey", RecoveryKeySchema)

