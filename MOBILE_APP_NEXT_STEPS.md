# Mobile Application Implementation Roadmap

This document outlines the next steps for re-implementing the full features of the Zero-Knowledge Password Manager mobile application.

## Current State

- **Authentication**: Fully implemented (Login & Register) connecting to the backend.
- **Crypto**: `crypto-engine` integrated for key derivation.
- **Secure Storage**: Session tokens and User ID stored securely.
- **Screens**: Login/Register screen and a basic "Home" placeholder.

## Phase 1: Core Vault Management

1. **Vault Store**:
   - Re-create `src/store/vaultStore.ts` using Zustand.
   - Implement `loadVault` to fetch encrypted items from `POST /sync/pull`.
   - Implement decryption logic using `@password-manager/crypto-engine` (AES-256-GCM).
   - Implement `addItem` to encrypt and push to `POST /sync/push`.
   - Manage local cache of decrypted items for performance.

2. **Vault List UI**:
   - Create `VaultListScreen.tsx`.
   - Display list of items with Site Name and Username.
   - Implement search functionality (local filtering of decrypted items).
   - Add "Pull to Refresh" for syncing.

3. **Vault Item Management**:
   - Create `VaultAddScreen.tsx` for adding new credentials.
   - Create `VaultDetailScreen.tsx` for viewing details (reveal password with authentication).
   - Implement "Edit" and "Delete" functionalities.

## Phase 2: Enhanced Security & UX

1. **Biometric Unlock**:
   - Use `expo-local-authentication` to secure the Master Key.
   - Store the encrypted Master Key in SecureStore and unlock with FaceID/fingerprint.
   - Avoid typing master password on every app launch.

2. **Auto-Fill Service**:
   - (Android) Implement Autofill Service to fill passwords in other apps/browsers.
   - (iOS) Implement Password Autofill Extension.

3. **Secure Clipboard**:
   - Implement clipboard clearing after X seconds (e.g., 30s) when copying passwords.

## Phase 3: Advanced Features

1. **Password Generator**:
   - Add a screen or modal to generate strong, random passwords.
   - Configurable options (length, special chars, numbers).

2. **Offline Support**:
   - Cache encrypted vault locally.
   - Allow read access when offline.
   - Queue changes for sync when online.

3. **Settings**:
   - Change Master Password (re-encrypt vault).
   - Manage devices/sessions.
   - Toggle specific security settings.

## API References

- `POST /auth/login`: Authenticate and get token.
- `POST /auth/register`: Create new account.
- `POST /sync/pull`: Fetch encrypted vault items.
- `POST /sync/push`: Upload encrypted vault items.

## Development Commands

- Start Backend: `npm run dev` (in backend folder)
- Start Mobile: `cd mobile && npx expo start`
