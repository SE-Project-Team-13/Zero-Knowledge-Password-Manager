# Zenith Vault Mobile Client

This is the React Native mobile client for **Zenith Vault**, a secure, zero-knowledge password manager. It implements a secure authentication flow that ensures your Master Password never leaves your device.

## Features (Current Phase)

- **Zero-Knowledge Authentication**:
  - Implementation of full ZKP registration and login flows.
  - Uses Argon2id for key derivation and client-side proof generation.
  - Integration with backend challange-response mechanism.
- **Secure Storage**:
  - Uses `expo-secure-store` to persist session tokens and user identifiers encrypted on-device.
  - Master Key is derived in-memory only and never persisted (except securely via biometric unlocking strategies in future phases).
- **Session Management**:
  - Token-based session handling with automatic re-authentication checks.
- **Architecture**:
  - **State Management**: Zustand stores in `src/store/` for predictable state updates.
  - **Navigation**: React Navigation stack (`App.tsx`) handles Authenticated vs Unauthenticated flows.
  - **Crypto Engine**: Leverages the shared `@password-manager/crypto-engine` workspace for cryptographic primitives (AES-256-GCM, Argon2id).

## Project Structure

```
mobile/
├── src/
│   ├── components/  # Reusable UI components
│   ├── screens/     # Application screens (Login, Home)
│   ├── services/    # API and storage services
│   ├── store/       # Zustand state management
│   └── config.ts    # App configuration (API URLs)
├── App.tsx          # Entry point and navigation setup
└── README.md        # This file
```

## Getting Started

### Prerequisites

- Node.js & npm
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone OR Android Studio / Xcode for simulation.

### Setup

1.  Install dependencies (from root):
    ```bash
    npm install
    ```

2.  **Choose your runtime:**

    **Option A: Expo Go (Development, uses JS crypto)**
    ```bash
    cd mobile
    npx expo start
    # Scan QR code with Expo Go app
    ```
    
    **Option B: Development Build (Recommended for production, uses native crypto)**
    ```bash
    cd mobile
    npx expo prebuild     # Generate android/ios folders
    npx expo run:android  # or npx expo run:ios
    # Future runs:
    npx expo start --dev-client
    ```

    **Performance Note:** Option B enables native `react-native-quick-crypto` and `react-native-argon2` modules for 10-50x faster cryptography. Option A uses JavaScript fallbacks (`@noble/ciphers`, `@noble/hashes`) which are secure but slower.

### Type Checking

Ensure TypeScript types are valid across the monorepo:

```bash
cd mobile
npx tsc
```

## Security Design

The mobile app follows a strict zero-knowledge architecture:

1.  **Registration**: Client generates a random salt, derives the key locally, generates a verifier, and sends ONLY the verifier/salt to the server.
2.  **Login**: Client requests a challenge, proves knowledge of the key without sending it, receives a session token.
3.  **Vault Data**: (Implementation In-Progress) Data is encrypted locally with the derived key before sync.

For next implementation steps, see `MOBILE_APP_NEXT_STEPS.md`.
