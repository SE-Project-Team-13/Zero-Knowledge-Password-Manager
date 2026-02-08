# Zero-Knowledge Password Manager

> **A state-of-the-art, high-security password management system built with a true zero-knowledge architecture.**

[![Security](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge&logo=shield-security)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20MongoDB-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind-black?style=for-the-badge&logo=next.js)](https://nextjs.org)

This repository contains the source code for the **Zero-Knowledge Password Manager**, a secure vault that ensures your data remains private even if the server is compromised.

---

## 📚 Documentation Structure

1.  **[Introduction & Installation (You are here)](README.md)**: Features, Dependencies, Setup, and Troubleshooting.
2.  **[Detailed Usage & Testing](docs/USER_GUIDE.md)**: How to use the application features and run tests.
3.  **[Architecture & Diagrams](docs/ARCHITECTURE.md)**: System design, security protocols, and UML diagrams.

---

## Introduction

**ZeroKnowledge Vault** handles your secrets without ever knowing them. Your master password derives an encryption key locally on your device using **Argon2id**. This key is used to encrypt your vault data with **AES-256-GCM** before it ever leaves your browser. The server only sees encrypted blobs.

### Key Features

- **True Zero-Knowledge**: Server cannot decrypt your data.
- **Privacy-Preserving Breach Detection**: Checks your credentials against breach databases without exposing your accounts (using k-Anonymity).
- **Emergency Kit**: Generate a recovery PDF to regain access if you lose your master password.
- **Secure Sharing**: Share credentials securely (Simulated).
- **Multi-Platform**: Web Dashboard + Browser Extension.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: v18.0.0 or higher (v20+ recommended).
    *   *Verify:* `node -v`
*   **npm**: v9.0.0 or higher.
    *   *Verify:* `npm -v`
*   **MongoDB**: A running instance (local or Atlas).
    *   *Verify:* `mongod --version` or check Atlas dashboard.
*   **Build Tools** (Required for `node-gyp` compilation):
    *   **Windows**: Visual Studio Build Tools (C++) and Python 3.11+.
    *   **macOS**: Xcode Command Line Tools (`xcode-select --install`).
    *   **Linux**: `build-essential` and `python3`.

## Dependencies & Technologies

This project relies on the following core libraries and technologies:

### Frontend (`/frontend`)
*   **Next.js (v16.0.10)**: The React framework for production.
*   **React (v19.2.0)**: Use of latest hooks and Server Components.
*   **Tailwind CSS (v4.0+)**: Utility-first CSS framework for styling.
*   **@noble/hashes**: High-security cryptographic primitives (Argon2, SHA-256).
*   **Zod**: TypeScript-first schema validation.
*   **React Hook Form**: Performant, flexible forms validation.
*   **Shadcn/UI & Radix UI**: Accessible component primitives.
*   **Lucide React**: Beautiful & consistent icons.
*   **Sonner**: A toast notification library.
*   **jsPDF**: Client-side PDF generation for Emergency Kits.

### Backend (`/backend`)
*   **Node.js & Express**: High-performance web server framework.
*   **Mongoose**: MongoDB object modeling for asynchronous environment.
*   **Node-Cron**: Task scheduler for periodic breach detection jobs.
*   **Nodemailer**: Module for sending emails (OTP & Alerts).
*   **UUID**: For generating unique identifiers.
*   **Dotenv**: Zero-dependency module for loading environment variables.

### Crypto Engine (`/frontend/crypto-engine`)
*   **Web Crypto API**: Utilizing native browser capabilities for AES-GCM and random value generation.

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

## Troubleshooting

### Installation Issues

#### 1. `node-gyp` or C++ Build Errors
*   **Error**: `gyp ERR! find Python` or `Msbuild not found`
*   **Cause**: Missing build tools required for compiling native modules like `argon2`.
*   **Fix**: install the build tools for your OS (see [Prerequisites](#prerequisites)).
    *   **Windows**: Run `npm install --global --production windows-build-tools` (Admin) or install Desktop development with C++ via Visual Studio Installer.
    *   **macOS**: Run `xcode-select --install`.

#### 2. `EADDRINUSE` (Port Already in Use)
*   **Error**: `listen EADDRINUSE: address already in use :::3001`
*   **Cause**: Another instance of the backend is running.
*   **Fix**: Kill the process on port 3001 (backend) or 3000 (frontend).
    *   **Mac/Linux**: `lsof -i :3001` then `kill -9 <PID>`
    *   **Windows**: `netstat -ano | findstr :3001` then `taskkill /PID <PID> /F`

### Common Runtime Errors

#### "Vault not found (404)" on Login
*   **Cause**: You are a new user and haven't saved any passwords yet.
*   **Fix**: The dashboard should auto-initialize an empty vault. Extensions might throw this error until you save your first password via the Dashboard.

#### "OTP not received"
*   **Cause**: SMTP is not configured or configured incorrectly.
*   **Fix**: Check the terminal where `npm run dev:backend` is running. The OTP code is logged there: `[OTP] 🔑 Security Code: 123456`.

#### "MongoDB Connection Failed"
*   **Cause**: Local MongoDB service is not running or URI is wrong.
*   **Fix**: Ensure `mongod` is running or check your Atlas IP whitelist.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
