# Zero-Knowledge Password Manager (DevDocs)

> **A state-of-the-art, high-security password management system built with a true zero-knowledge architecture.**

[![Security](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge&logo=shield-security)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20MongoDB-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind-black?style=for-the-badge&logo=next.js)](https://nextjs.org)

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Backend Environment](#backend-environment)
  - [Frontend Environment](#frontend-environment)
- [Running the Project](#running-the-project)
  - [Development Mode](#development-mode)
  - [Production Build](#production-build)
- [Architecture Deep Dive](#architecture-deep-dive)
  - [Zero-Knowledge Encryption](#zero-knowledge-encryption)
  - [Breach Detection (k-Anonymity)](#breach-detection-k-anonymity)
  - [Blind Sync Protocol](#blind-sync-protocol)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Introduction

**ZeroKnowledge Vault** handles your secrets without ever knowing them. Your master password derives an encryption key locally on your device using **Argon2id**. This key is used to encrypt your vault data with **AES-256-GCM** before it ever leaves your browser. The server only sees encrypted blobs.

## Features

- **True Zero-Knowledge**: Server cannot decrypt your data.
- **Privacy-Preserving Breach Detection**: Checks your credentials against breach databases without exposing your accounts (using k-Anonymity).
- **Emergency Kit**: Generate a recovery PDF to regain access if you lose your master password.
- **Secure Sharing**: Share credentials securely (Simulated).
- **Multi-Platform**: Web Dashboard + Browser Extension.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9.0.0 or higher.
- **MongoDB**: A running instance (local or Atlas) for the backend.

## Installation

To install the project locally, run the following commands:

```bash
# 1. Clone the repository
git clone https://github.com/SE-Project-Team-13/Zero-Knowledge-Password-Manager.git

# 2. Navigate to the directory
cd Zero-Knowledge-Password-Manager

# 3. Install dependencies (Workspaces)
npm install

# 4. Build the core crypto library
npm run crypto:build
```

## Configuration

You need to configure both the backend and frontend environment variables.

### Backend Environment
Create `backend/.env` with the following:

```properties
PORT=3001
MONGODB_URI=mongodb://localhost:27017/vault
# Email Config (Required for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
# JWT Secret
JWT_SECRET=your-super-secret-key-at-least-32-chars
```

> **Note:** If you don't have SMTP credentials, the system will log OTP codes to the terminal console (`npm run dev:backend`).

### Frontend Environment
Create `frontend/.env` (optional, defaults allow local dev):

```properties
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Running the Project

The project consists of a Backend API and a Frontend Dashboard. You must run both.

### Development Mode

**Terminal 1: Backend**
```bash
npm run dev:backend
```
_Output should show: `[VaultSync] Blind sync backend listening on port 3001`_

**Terminal 2: Frontend**
```bash
npm run dev
```
_Output should show: `Ready in ...` and access via `http://localhost:3000`_

### Production Build

To build for production:

```bash
# Build Frontend
npm run build -w frontend

# Build Backend
npm run build -w backend

# Start Production
npm start
```

## Architecture Deep Dive

### Zero-Knowledge Encryption

1.  **User Input**: User types `Master Password`.
2.  **Key Derivation**: `Argon2id` hashes the password with a random salt (100MB memory cost, 4 iterations). Result: `Derived Key`.
3.  **Encryption**: `AES-256-GCM` uses `Derived Key` to encrypt vault data. Result: `Ciphertext`.
4.  **Storage**: `Ciphertext` is sent to MongoDB. The server **never** sees the `Master Password` or `Derived Key`.

### Breach Detection (k-Anonymity)

1.  **Hashing**: The system hashes the user's email/username (SHA-1/SHA-256).
2.  **Prefixing**: Only the **first 5 characters** of the hash are sent to the Breach API.
3.  **Matching**: The API returns all breaches matching that prefix.
4.  **Local Filtering**: The client checks the full hash against the returned list locally.
    *   _Result:_ The API server never knows exactly which account you are checking along the k-anonymity set.

### Blind Sync Protocol

The server acts as a "dumb store". It handles versioning and conflict resolution based on `vaultVersion` numbers, but it cannot merge the _content_ because it is encrypted. Conflic resolution pushes the newer version or asks client to resolve.

## Troubleshooting

### "Vault not found (404)" on Login
*   **Cause**: You are a new user and haven't saved any passwords yet.
*   **Fix**: The dashboard should auto-initialize an empty vault. Extensions might throw this error until you save your first password via the Dashboard.

### "OTP not received"
*   **Cause**: SMTP is not configured or configured incorrectly.
*   **Fix**: Check the terminal where `npm run dev:backend` is running. The OTP code is logged there: `[OTP] 🔑 Security Code: 123456`.

### "MongoDB Connection Failed"
*   **Cause**: Local MongoDB service is not running or URI is wrong.
*   **Fix**: Ensure `mongod` is running or check your Atlas IP whitelist.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
