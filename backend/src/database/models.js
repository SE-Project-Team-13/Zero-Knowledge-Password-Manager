import mongoose, { Schema } from "mongoose";
const UserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    salt: { type: String, required: true },
    verifier: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
    updatedAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
    isBreached: { type: Boolean, default: false },
    lastBreachCheck: { type: String },
    sharePublicKey: { type: String },
    shareSigningPublicKey: { type: String },
    argon2Memory: { type: Number, default: 8192 },
    argon2Iterations: { type: Number, default: 1 },
});
const SessionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: String, required: true },
    isOtpVerified: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
});
const VaultBlobSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true },
    ciphertext: { type: String, required: true },
    salt: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    version: { type: Number, required: true },
    timestamp: { type: Number, required: true },
    nonce: { type: String, required: true, unique: true },
    createdAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
    updatedAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
});
const SyncMetadataSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true },
    lastUpdated: { type: Number, required: true },
    vaultVersion: { type: Number, required: true },
    nonce: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
    updatedAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
});
// Compound index ensures only one sync record exists per user/device pair.
SyncMetadataSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
const SimpleVaultSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
    labels: { type: [String], default: [] }, // Plaintext labels for identification
    updatedAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
});
const OTPSchema = new Schema({
    email: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: String, required: true },
    verified: { type: Boolean, default: false },
    createdAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
});
const RecoveryKeySchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    keyHash: { type: String, required: true },
    encryptedVaultKey: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
    usedAt: { type: String },
    isRevoked: { type: Boolean, default: false },
});
// Index for fast lookup by userId
RecoveryKeySchema.index({ userId: 1 });
const LoginChallengeSchema = new Schema({
    email: { type: String, required: true, unique: true },
    challenge: { type: String, required: true },
    expiresAt: { type: String, required: true },
});
const SharedCredentialSchema = new Schema({
    senderUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipientEmail: { type: String, required: true },
    encryptedSessionKey: { type: String, required: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    signature: { type: String, required: true },
    senderSigningPublicKey: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending", index: true },
    createdAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
    updatedAt: { type: String, default: () => new Date().toISOString().replace("T", " ").substring(0, 19) },
    acceptedAt: { type: String },
});
SharedCredentialSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 });
// Export Mongoose Models
export const User = mongoose.model("User", UserSchema);
export const Session = mongoose.model("Session", SessionSchema);
export const VaultBlob = mongoose.model("VaultBlob", VaultBlobSchema);
export const SyncMetadata = mongoose.model("SyncMetadata", SyncMetadataSchema);
export const SimpleVault = mongoose.model("SimpleVault", SimpleVaultSchema);
export const OTP = mongoose.model("OTP", OTPSchema);
export const RecoveryKey = mongoose.model("RecoveryKey", RecoveryKeySchema);
export const LoginChallenge = mongoose.model("LoginChallenge", LoginChallengeSchema);
export const SharedCredential = mongoose.model("SharedCredential", SharedCredentialSchema);
