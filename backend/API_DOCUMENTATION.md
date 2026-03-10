# 🛡️ Zenith Vault - API Documentation

## 📋 Overview
Complete backend API for Zenith Vault, a secure, zero-knowledge password management system with:
- ✅ **SRP-Style Verifier** for Authentication (No Master Password leaves the device)
- ✅ **Blind Sync Protocol** for vault synchronization
- ✅ **Secure Sharing** using public key cryptography
- ✅ **Recovery Key System** for account recovery
- ✅ **OTP Verification** for multi-factor authentication

**Base URL**: `http://localhost:3001` (Default local port) / `https://your-backend.render.com` (Production)

---

## 🔐 Authentication
Protected endpoints require a JWT Session Token in the Authorization header:

```
Authorization: Bearer <your-session-token>
```

### How to Get a Token
1. Fetch salt and challenge using `GET /auth/salt/:email`.
2. Compute client proof securely on the client side.
3. Call `POST /auth/login` with `email`, `challenge`, and `clientProof`.
4. Receive `sessionToken` in the response.
5. (Optional but enforced by some routes) Verify OTP to fully activate the session via `POST /otp/verify`.

---

## 📌 API Endpoints

### 👤 Authentication (`/auth`)
#### 1. Register User
```http
POST /auth/register
```
**Auth**: None
**Body**: `{ "email", "fullName", "salt", "verifier", "argon2Memory", "argon2Iterations" }`
**Security**: Creates initial user record. SRP verifier prevents plaintext password storage.

#### 2. Login
```http
POST /auth/login
```
**Auth**: None
**Body**: `{ "email", "challenge", "clientProof" }`
**Security**: Returns `sessionToken` to be used for authenticated endpoints.

#### 3. Current User Profile
```http
GET /auth/me
```
**Auth**: Required (Bearer Token)
**Response**: User details including `isBreached` and `lastBreachCheck`.

#### 4. Additional Auth Routes
- `GET /auth/salt/:email` - Fetch salt/challenge for login sequence.
- `GET /auth/check-email/:email` - Check if email is registered.
- `POST /auth/reset-password` - Resets verifier and salt (Requires Valid Session Token).
- `POST /auth/resolve-breach` - Clears breach flag for authenticated user.
- `POST /auth/logout` - Invalidates the active session token.
- `DELETE /auth/account` - Permanently deletes the user account.

---

### ✉️ One-Time Passwords (`/otp`)
#### 1. Send OTP
```http
POST /otp/send
```
**Auth**: Required
**Body**: `{ "email" }`

#### 2. Verify OTP
```http
POST /otp/verify
```
**Auth**: Required
**Body**: `{ "email", "code" }`
**Security**: Upgrades the current session to `OTP_VERIFIED` allowing secure actions like vault sync.

---

### 🔄 Vault Sync (`/sync`)
#### 1. Push Vault (Legacy Structure)
```http
POST /sync/push
```
**Auth**: Required
**Body**: `{ "userId", "deviceId", "vault", "baseTimestamp" }`

#### 2. Pull Vaults
```http
POST /sync/pull
```
**Auth**: Required
**Body**: `{ "userId", "deviceId", "lastVersion", "lastTimestamp" }`

#### 3. Blind Blob Sync Routes (Preferred)
- `POST /sync/blob/push` - Push an encrypted blob container. Allows blind syncing (server cannot read the vault).
- `POST /sync/blob/pull` - Pull the latest blob if it is newer than the client's version.
- `POST /sync/blob/resolve` - Resolve merge conflicts by overwriting with explicitly chosen version.

---

### 🤝 Secure Sharing (`/share`)
#### 1. Publish Public Keys
```http
POST /share/public-key
```
**Auth**: Required
**Body**: `{ "publicKey", "signingPublicKey" }`

#### 2. Share Credential
```http
POST /share/send
```
**Auth**: Required
**Body**: `{ "recipientEmail", "encryptedSessionKey", "ciphertext", "iv", "signature", "senderSigningPublicKey", "credentialLabel" }`
**Security**: E2E Encrypted sharing between users mapped by public keys.

#### 3. Other Share Routes
- `GET /share/public-key/:email` - Fetch a recipient's public key.
- `GET /share/incoming` - View pending incoming shared credentials.
- `POST /share/:shareId/accept` - Accept a shared credential.
- `POST /share/:shareId/reject` - Reject a shared credential.

---

### 🆘 Account Recovery (`/recovery`)
#### 1. Generate Recovery Key
```http
POST /recovery/generate
```
**Auth**: Required
**Returns**: `recoveryKey`
**Security**: Generates the key but does NOT activate it. Client must encrypt their master password with this key.

#### 2. Activate Recovery Key
```http
POST /recovery/activate
```
**Auth**: Required
**Body**: `{ "keyHash", "encryptedVaultKey" }`
**Security**: Activates the generated recovery key.

#### 3. Other Recovery Routes
- `POST /recovery/verify` - Check if a recovery key is structurally valid/correct.
- `POST /recovery/login` - Authenticate using an activated recovery key. Consumes the key.
- `GET /recovery/status/:email` - Check if user has an active key.

---

## 🔒 Security Features

### Authentication & Identification
- ✅ **Zero-Knowledge Auth** via SRP (Secure Remote Password equivalent).
- ✅ **Mandatory OTP Verification** for critical operations.
- ✅ **Token based Session Management** directly handled in the API layer.

### Authorization
- ✅ Users can only read/write their own vaults (verified by `userId` matching token's identity).
- ✅ Cross Account Sharing validates digital signatures to ensure the sender cannot be spoofed.

### Data Privacy
- ✅ **Blind Storage**: The server has completely no knowledge of the payload being synchronized.
- ✅ **Encrypted Recovery**: The server holds only an encrypted vault key blob tied to a hashed recovery token.

---

## 📊 Error Handling Format
Standardized error responses are returned when any endpoint fails:

```json
{
  "error": "Short description of the error",
  "code": "ERROR_CODE",
  "message": "Detailed explanation of what went wrong"
}
```

### Common HTTP Status Codes
- `200/201` - Success / Created
- `400` - Bad Request (e.g., Missing required body parameters)
- `401` - Unauthorized (Invalid token, invalid credentials)
- `403` - Forbidden (e.g., Attempting to sync someone else's vault)
- `404` - Not Found
- `409` - Conflict (e.g., Vault Push conflict requiring resolution)
- `500` - Internal Server Error
