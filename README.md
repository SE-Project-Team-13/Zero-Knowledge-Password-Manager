# Zero-Knowledge Password Manager

> **A state-of-the-art, high-security password management system built with a true zero-knowledge architecture.**

[![Security](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge&logo=shield-security)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20MongoDB-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind-black?style=for-the-badge&logo=next.js)](https://nextjs.org)

This repository contains the source code for the **Zero-Knowledge Password Manager**, a secure vault that ensures your data remains private even if the server is compromised.

---

## 🔗 Quick Links

- **[Installation](#installation)**
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
- [Usage Guide](#usage-guide)
  - [Registering & Vault Creation](#registering--vault-creation)
  - [Managing Passwords](#managing-passwords)
  - [Emergency Kit](#emergency-kit)
  - [Browser Extension](#browser-extension)
  - [Breach Detection](#breach-detection)
- [Architecture Deep Dive](#architecture-deep-dive)
  - [Zero-Knowledge Encryption](#zero-knowledge-encryption)
  - [Breach Detection (k-Anonymity)](#breach-detection-k-anonymity-1)
  - [Blind Sync Protocol](#blind-sync-protocol)
- [Security Best Practices](#security-best-practices)
- [Support & Documentation](#support--documentation)

---

## Introduction

**Zero-Knowledge Password Manager** handles your secrets without ever knowing them. Your master password derives an encryption key locally on your device using **Argon2id**. This key is used to encrypt your vault data with **AES-256-GCM** before it ever leaves your browser. The server only sees encrypted blobs.

## Features

- **True Zero-Knowledge Architecture**: Server cannot decrypt your data - all encryption happens client-side.
- **Privacy-Preserving Breach Detection**: Checks your credentials against breach databases without exposing your accounts (using k-Anonymity).
- **Emergency Recovery Kit**: Generate a recovery PDF to regain access if you lose your master password.
- **Multi-Platform Support**: Web Dashboard + Browser Extension for seamless password management.
- **Secure Authentication**: Email-based OTP verification for account security.
- **Auto-Lock & Session Management**: Automatic vault locking for enhanced security.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher (v20+ recommended).
  - _Verify:_ `node -v`
- **npm**: v9.0.0 or higher.
  - _Verify:_ `npm -v`
- **MongoDB**: A running instance (local or Atlas).
  - _Verify:_ `mongod --version` or check Atlas dashboard.
- **Build Tools** (Required for `node-gyp` compilation):
  - **Windows**: Visual Studio Build Tools (C++) and Python 3.11+.
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
  - **Linux**: `build-essential` and `python3`.

## Dependencies & Technologies

This project relies on the following core libraries and technologies:

### Frontend (`/frontend`)

- **Next.js**: The React framework for production with server-side rendering.
- **React**: Modern React with hooks and component architecture.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **@noble/hashes**: High-security cryptographic primitives (Argon2, SHA-256).
- **Zod**: TypeScript-first schema validation.
- **React Hook Form**: Performant, flexible forms validation.
- **Shadcn/UI & Radix UI**: Accessible component primitives.
- **Lucide React**: Beautiful & consistent icons.
- **Sonner**: Toast notification library.
- **jsPDF**: Client-side PDF generation for Emergency Kits.

### Backend (`/backend`)

- **Node.js & Express**: High-performance web server framework.
- **Mongoose**: MongoDB object modeling for asynchronous environment.
- **Node-Cron**: Task scheduler for periodic breach detection jobs.
- **Nodemailer**: Module for sending emails (OTP & Alerts).
- **UUID**: For generating unique identifiers.
- **Dotenv**: Zero-dependency module for loading environment variables.

### Crypto Engine (`/frontend/crypto-engine`)

- **Web Crypto API**: Utilizing native browser capabilities for AES-GCM and random value generation.

## Project Structure

```
Zero-Knowledge-Password-Manager/
├── frontend/              # Next.js web application
│   ├── crypto-engine/    # Core cryptographic library
│   └── extension/        # Browser extension
├── backend/              # Express.js API server
├── UML diagrams/         # System architecture diagrams
└── package.json          # Workspace configuration
```

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

## Usage Guide

Once the servers are running, follow these steps to use the application:

### Registering & Vault Creation

1.  Navigate to `http://localhost:3000`.
2.  Click **"Get Started"** or **"Register"**.
3.  Enter your Email and a Strong Master Password.
4.  **Important:** Your Master Password is _never_ sent to the server. It generates your encryption keys locally.
5.  Verification: Check your terminal (or email) for the OTP code.

### Managing Passwords

- **Add Item**: Click the "+" button in the dashboard to add a new login.
- **View Password**: Click the eye icon to decrypt and view a password.
- **Copy**: Use the copy icon to copy username/password to clipboard.
- **Edit/Delete**: Use the context menu on any item card.

### Emergency Kit

1.  Go to **Settings** -> **Danger Zone**.
2.  Click **"Generate Emergency Kit"**.
3.  A PDF will be generated containing your **Recovery Key** and instructions.
4.  **Save this PDF securely!** It is the _only_ way to recover your account if you forget your Master Password.

### Browser Extension

The browser extension allows you to autofill passwords directly from your browser:

1.  **Build the Extension**:
    ```bash
    npm run extension:build
    ```
2.  **Load in Browser** (Chrome/Edge):
    - Navigate to `chrome://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked"
    - Select the `frontend/extension/dist` folder
3.  **Login**: Use the same credentials as your web dashboard.
4.  **Autofill**: The extension will detect login forms and offer to fill credentials.

### Breach Detection

The system automatically checks your email against a mock breach database.

- **Manual Check**: The scheduled job runs every minute (in dev).
- **Simulate Breach**: Use the email `breached@example.com` during registration to see the Red Alert Banner on the dashboard.

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
    - _Result:_ The API server never knows exactly which account you are checking along the k-anonymity set.

### Blind Sync Protocol

The server acts as a "dumb store". It handles versioning and conflict resolution based on `vaultVersion` numbers, but it cannot merge the _content_ because it is encrypted. Conflict resolution pushes the newer version or asks client to resolve.

---

## Security Best Practices

### For Development

- Never commit `.env` files to version control
- Use strong, unique JWT secrets (minimum 32 characters)
- Keep your MongoDB instance secured with authentication

### For Production

- Use HTTPS for all communications
- Enable MongoDB authentication and use connection strings with credentials
- Set up proper CORS policies
- Use environment-specific configuration files
- Regularly update dependencies for security patches
- Consider using a managed MongoDB service (MongoDB Atlas) with IP whitelisting

### For Users

- Choose a strong master password (12+ characters, mixed case, numbers, symbols)
- Store your Emergency Kit PDF in a secure location (encrypted USB, password manager, safe)
- Never share your master password or recovery key
- Enable 2FA on your email account used for registration

---

## Support & Documentation

For additional help:

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/SE-Project-Team-13/Zero-Knowledge-Password-Manager/issues)
- **Architecture Diagrams**: See the `UML diagrams/` folder for visual documentation
- **API Documentation**: Backend API endpoints are documented in `backend/README.md`
