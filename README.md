<div align="center">
  <img src="./frontend/public/logo.png" alt="Zenith Vault Logo" width="120" />
</div>

# Zenith Vault

> **A state-of-the-art, high-security password management system built with a true zero-knowledge architecture.**

[![Security](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge&logo=shield-security)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20MongoDB-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Mobile](https://img.shields.io/badge/Mobile-Expo%20%7C%20React%20Native-blue?style=for-the-badge&logo=expo)](https://expo.dev)

This repository contains the source code for **Zenith Vault**, a secure password management system that ensures your data remains private even if the server is compromised. It follows a strict **Zero-Knowledge** philosophy: your master password never leaves your device.

---

## 🔗 Quick Links

- **[Installation](#installation)**
- **[Contributing & Development Guide](#contributing--development-guide)**
- **[Verifying Installation](#verifying-installation)**
- **[Running Tests](#running-tests)**
- **[Usage Guide](#usage-guide)**
- **[Architecture](#architecture-deep-dive)**

---

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Dependencies & Technologies](#dependencies--technologies)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Contributing & Development Guide](#contributing--development-guide)
- [Verifying Installation](#verifying-installation)
- [Running Tests](#running-tests)
- [Usage Guide](#usage-guide)
  - [Registering & Vault Creation](#registering--vault-creation)
  - [Managing Passwords](#managing-passwords)
  - [Emergency Kit](#emergency-kit)
  - [Browser Extension](#browser-extension)
  - [Mobile Application](#mobile-application-usage)
  - [Breach Detection](#breach-detection)
- [Architecture Deep Dive](#architecture-deep-dive)
  - [Zero-Knowledge Proof (ZKP) Authentication](#zero-knowledge-proof-zkp-authentication)
  - [Client-Side Encryption (AES-256-GCM)](#client-side-encryption-aes-256-gcm)
  - [Breach Detection (k-Anonymity)](#breach-detection-k-anonymity-1)
  - [Blind Sync Protocol](#blind-sync-protocol)
- [Security Best Practices](#security-best-practices)
- [Support & Documentation](#support--documentation)

---

## Introduction

**Zenith Vault** handles your secrets without ever knowing them. Your master password is used to derive encryption keys and authentication proofs locally on your device using **Argon2id**.

The system employs **Zero-Knowledge Proofs (ZKP)** for authentication, meaning the server verifies you know your password without you ever having to send it (or even a hash of it) over the network. Your vault data is encrypted with **AES-256-GCM** before uploading, ensuring total privacy.

## Features

- **True Zero-Knowledge Architecture**: Server cannot decrypt your data - all encryption happens client-side.
- **ZKP Authentication**: Log in securely without transmitting passwords or password hashes.
- **Privacy-Preserving Breach Detection**: Checks your credentials against breach databases without exposing your accounts (using k-Anonymity).
- **Emergency Recovery Kit**: Generate a recovery PDF to regain access if you lose your master password.
- **Multi-Platform Support**: Web Dashboard, Browser Extension, and **Mobile App (Expo/React Native)**.
- **Strict 2FA Enforcement**: Mandatory Multi-factor security with Email-based OTP verification for all user logins.
- **Backend Security Hardening**: Strict HTTPS enforcement, NoSQL injection prevention with `express-mongo-sanitize`, and extended HTTP security framing using `helmet`.
- **Auto-Lock & Strict Session Management**: Automatic vault locking alongside exact stateless session token validation.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.0.0 or higher recommended.
  - _Verify:_ `node -v`
- **npm**: v10.0.0 or higher.
  - _Verify:_ `npm -v`
- **MongoDB**: A running instance (local or Atlas).
  - _Verify:_ `mongosh --eval "db.version()"`
- **Expo CLI**: For mobile development (`npm install -g expo-cli`).
- **Build Tools** (Required for `node-gyp` compilation):
  - **Windows**: Visual Studio Build Tools (C++) and Python 3.11+.
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
  - **Linux**: `build-essential` and `python3`.

## Dependencies & Technologies

This project is a monorepo leveraging npm workspaces:

### Frontend (`/frontend`)

- **Next.js**: Modern React framework.
- **Tailwind CSS & Shadcn/UI**: Modern styling and accessible components.
- **Lucide React & Sonner**: Icons and toast notifications.
- **jsPDF**: For generating the Emergency Kit.

### Backend (`/backend`)

- **Node.js & Express**: High-performance API server.
- **Mongoose**: MongoDB object modeling.
- **Nodemailer / Gmail API**: For secure OTP and alert delivery.
- **Helmet & Mongo-Sanitize**: Enforcing modern web security controls.
- **Node-Cron**: For scheduled security tasks (Breach Detection).

### Mobile (`/mobile`)

- **React Native & Expo**: Cross-platform mobile development.
- **Zustand**: Lightweight state management.
- **Expo Secure Store**: Hardware-backed secure storage for session keys.

### Crypto Engine (`/frontend/crypto-engine`)

- **Web Crypto API**: Native browser/mobile cryptographic primitives.
- **Argon2 / Noble Hashes**: High-security key derivation and hashing.

## Project Structure

```
zenith-vault/
├── frontend/              # Next.js web application
│   ├── crypto-engine/    # Shared cryptographic library
│   └── extension/        # Browser extension
├── backend/              # Express.js API server
├── mobile/               # Expo/React Native mobile client
├── UML diagrams/         # System architecture diagrams
└── package.json          # Root workspace configuration
```

## Installation

To install the project locally, run the following commands:

```bash
# 1. Clone the repository
git clone https://github.com/SE-Project-Team-13/Zero-Knowledge-Password-Manager.git

# 2. Navigate to the directory
cd Zero-Knowledge-Password-Manager

# 3. Install dependencies for all workspaces
npm install

# 4. Build the core crypto library (required by all clients)
npm run crypto:build
```

---

## Configuration

### Backend Environment (`backend/.env`)

```properties
PORT=3001
MONGODB_URI=mongodb://localhost:27017/vault
# Gmail Config (for OTP)
GMAIL_USER_EMAIL=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

_Note: In development, OTPs are logged to the terminal if Gmail is not configured._

### Frontend/Mobile Environment

- **Frontend**: `frontend/.env.local` (sets `NEXT_PUBLIC_API_URL`)
- **Mobile**: `mobile/.env` (sets `EXPO_PUBLIC_API_URL`)

## Running the Project

### Development Mode

**Terminal 1: Backend**

```bash
npm run dev:backend
```

**Terminal 2: Frontend (Web)**

```bash
npm run dev:frontend
```

**Terminal 3: Mobile (Expo)**

```bash
cd mobile
npx expo start
```

---

## Contributing & Development Guide

We use a modern **monorepo** structure built with npm workspaces. All major moving parts live in their respective subdirectories, sharing access to the compiled `/frontend/crypto-engine`.

When modifying the project or fixing bugs, adhere to the following workflow:

1. **Verify Your Node Environment**:
   Ensure you're using Node v20+. Use `nvm` (Node Version Manager) if necessary.

2. **Branching**:
   Create a dedicated feature or bugfix branch:

   ```bash
   git checkout -b feature/your-awesome-feature
   ```

3. **Developing Shared Crypto code**:
   If you modify anything inside `frontend/crypto-engine/`, **you must rebuild it** before those changes reflect in the `frontend` or `mobile` apps:

   ```bash
   npm run crypto:build
   ```

4. **Code Quality**:
   Before committing, run the following workspace scripts from the root directory to ensure your code matches the repository guidelines:

   ```bash
   # Run all formatters and linters
   npm run lint

   # Execute the entire test suite across frontend, backend, and crypto packages
   npm test --workspaces
   ```

5. **Pull Requests**:
   Submit a PR against the `main` branch. Ensure your PR description outlines the problem you are solving and links to any open GitHub Issues.

---

## Verifying Installation

1. **Backend**: Check for `[VaultSync] Blind sync backend listening on port 3001`.
2. **Web**: Access `http://localhost:3000`.
3. **Mobile**: Scan the QR code from Metro Bundler using the **Expo Go** app.
4. **Crypto**: Verify `frontend/crypto-engine/dist` contains compiled assets.

## Running Tests

```bash
# Run all tests in the monorepo
npm test --workspaces

# Run specific workspace tests
npm test -w backend
npm test -w frontend/crypto-engine
```

## Usage Guide

### Registering & Vault Creation

- When you register, a random salt and verifier are created locally. The server stores these but never sees your password.
- Your Master Password generates a **Master Key** that never leaves your device.

### Emergency Kit

- Found in **Settings -> Danger Zone**.
- This PDF contains your **Recovery Key**. **Without it or your master password, your data is permanently inaccessible.**

### Mobile Application Usage

- Sync your vault across devices.
- Secure biometric integration (FaceID/Fingerprint) is handled on-device.
- Ensure the Mobile app is pointed to your backend IP address in the `.env` file.

## Architecture Deep Dive

### Zero-Knowledge Proof (ZKP) Authentication

Zenith Vault uses a customized challenge-response protocol. During login:

1. The client requests a random challenge from the server.
2. The client uses its local **Master Key** to sign/process this challenge.
3. The server verifies the response matches the stored verifier without ever knowing the key.

### Client-Side Encryption (AES-256-GCM)

All vault items are encrypted using Authenticated Encryption (AES-GCM). This ensures:

- **Confidentiality**: No one can read the data.
- **Integrity**: The client can detect if the server or a third party has tampered with the encrypted blobs.

### Breach Detection (k-Anonymity)

Uses the "Range Search" technique:

- Client hashes email -> SHA256.
- Client sends only the **first 5 characters** of the hash to the breach API.
- API returns all possible matches for that prefix.
- Client filters for the full hash locally. **The API provider never knows your actual email.**

### Blind Sync Protocol

The server acts solely as a synchronization hub, enabling seamless multi-device support without exposing underlying data.

- **Stateless Validation**: Each sync request is rigorously verified via stateless user sessions to prevent unauthorized modifications.
- **Encrypted Data Blobs**: The server receives and stores securely encrypted text blobs, maintaining zero insight into their internal structure or contents.

---

## Security Best Practices

- **Strict HTTPS Enforcement**: Unencrypted HTTP traffic is outright blocked or redirected in the production environment.
- **Rate-Limiting Subsystems**: Dedicated limiters mitigate brute-force attempts on sensitive endpoints such as authentication (`/auth`) and OTP generation (`/otp/send`).
- **NoSQL Injection Defenses**: Advanced payload sanitation via `express-mongo-sanitize` comprehensively protects against malicious query payloads.
- **Session Protection & CORS**: Handled precisely with secure headers using `helmet` and closely modeled `Access-Control-Allow-Origin` values restricting requests to valid domain entities only.

---

## Support & Documentation

- **API Reference**: See `backend/src/routes/` for endpoint definitions.
- **UML**: Architectural diagrams available in `/UML diagrams`.
- **Issues**: [GitHub Issues](https://github.com/SE-Project-Team-13/Zero-Knowledge-Password-Manager/issues)
