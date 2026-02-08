# 🛡️ ZeroKnowledge Vault

[![Security](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge&logo=shield-security)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20MongoDB-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**ZeroKnowledge Vault** is a state-of-the-art, high-security password management system built with a true zero-knowledge architecture. In this system, your master password and decrypted data never leave your device. The server acts only as a secure, encrypted storage medium for data it cannot read.

---

## ✨ Key Features

- 🔐 **Zero-Knowledge Architecture:** Decryption happens exclusively on the client side.
- 🛠️ **Encryption Standards:** Uses industry-standard AES-256-GCM for robust data protection.
- 🧬 **Advanced Key Derivation:** Argon2id hashing with randomized salts to thwart brute-force attacks.
- 📡 **Multi-Platform Access:**
  - **Web Dashboard:** A premium, Next.js-powered interface for managing your vault.
  - **Browser Extension:** Manifest V3 extension for Chrome and Edge with auto-fill capabilities.
- 📧 **Secure MFA:** Integrated Email-based OTP system for an additional layer of authentication.
- 🔄 **Real-time Sync:** Automatic encryption and synchronization across all your devices.
- 🛡️ **Security Controls:** Advanced features like **Master Key Rotation** and **Data Purging**.

---

## 🏗️ Security Architecture

### 1. Cryptographic Principles

The core of ZeroKnowledge Vault relies on the principle that the server should never have access to the user's plaintext secrets.

- **Key Derivation:** We use **Argon2id** (the winner of the Password Hashing Competition) to derive a 256-bit encryption key from the user's master password. This process is compute-intensive and memory-hard, making it highly resistant to GPU/ASIC-based cracking.
- **Encryption:** All data stored in the vault is encrypted using **AES-256-GCM** (Galois/Counter_Mode). This provides both confidentiality and authentication, ensuring that the data hasn't been tampered with while in transit or at rest.
- **Authentication:** The server verifies identity using a secure hash of the master password, but never stores the password itself or the key used for encryption.

### 2. The Verification Flow

1.  **Client-Side Initialization:** User enters credentials.
2.  **Key Generation:** Argon2id derives the encryption key locally.
3.  **OTP Verification:** A secondary verification step sends a code to the user's verified email.
4.  **Vault Retrieval:** Upon successful verification, the server returns a "Blob" – an encrypted chunk of data.
5.  **Local Decryption:** The browser uses the locally-derived key to decrypt the blob into memory. **No decrypted data is ever written to disk.**

---

## 📁 Project Structure

```text
├── frontend/
│   ├── app/                  # Next.js 15+ Web Dashboard
│   ├── extension/            # Chrome & Edge Browser Extension (MV3)
│   ├── crypto-engine/        # Core cryptographic implementation (Shared)
│   ├── components/           # Premium UI Component Library (Shadcn/UI)
│   ├── hooks/                # Specialized React hooks for Vault State
│   └── lib/                  # Shared utilities and API interaction layer
└── backend/                  # High-performance Node.js & MongoDB Sync Server
    └── src/
        ├── routes/           # API Endpoints (Auth, Vault, Security)
        ├── services/         # Business logic (Encryption logic, Emailer)
        └── database/         # MongoDB/Mongoose Schema & Configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** v20.x or higher (LTS recommended)
- **Package Manager:** npm (v9.x or higher)
- **Database:** MongoDB (Local instance or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- **Email:** An SMTP provider for OTP delivery (e.g., Gmail, SendGrid, or local development log)

### Installation

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/SE-Project-Team-13/Zero-Knowledge-Password-Manager.git
    cd Zero-Knowledge-Password-Manager
    ```

2.  **Install Dependencies:**
    This project uses a monorepo structure with npm workspaces. Install all dependencies from the root:
    ```bash
    npm install
    ```

3.  **Build Shared Components:**
    The core cryptographic engine must be built before running the application:
    ```bash
    npm run crypto:build
    ```

### Configuration

The backend requires several environment variables to function correctly.

1.  **Backend Setup:**
    ```bash
    cp backend/.env.example backend/.env
    ```
2.  **Edit `backend/.env`:**
    - `PORT`: Server port (default: 3001)
    - `MONGODB_URI`: Your MongoDB connection string.
    - `SMTP_*`: Credentials for your email provider (see the file for details).
    > [!TIP]
    > If SMTP credentials are omitted, the system will log OTPs directly to the terminal for development convenience.

---

## 🛠️ Development Workflow

To run the full ecosystem, you'll need to start both the backend and frontend separately from the root directory.

### 1. Start the Backend Server
The backend handles authentication, synchronization, and OTP management.
```bash
npm run dev:backend
```
*Access point: `http://localhost:3001`*

### 2. Start the Frontend Dashboard
The dashboard is a Next.js application that provides the primary user interface.
```bash
npm run dev
```
*Access point: `http://localhost:3000`*

### 3. Build & Load the Browser Extension
The extension provides auto-fill and quick-access features.
```bash
npm run extension:build
```
**To Load in Browser:**
1. Open Chrome or Edge and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `frontend/extension/dist` folder.

### 4. Shared Crypto Engine
If you make changes to the shared cryptographic logic in `frontend/crypto-engine`, rebuild it:
```bash
npm run crypto:build
```

---

## 🧰 Tech Stack

### Frontend & UI

- **Next.js 15:** For the high-performance dashboard.
- **Tailwind CSS:** For professional, modern styling.
- **Shadcn/UI & Radix:** accessible, premium UI components.
- **Lucide Icons:** minimalist and consistent iconography.

### Backend Infrastructure

- **Node.js / Express:** Robust API architecture.
- **MongoDB / Mongoose:** Scalable document-based storage.
- **Nodemailer:** Reliable transactional email delivery.

### Security Core

- **Web Crypto API:** Native, hardware-accelerated encryption.
- **@noble/hashes:** High-security cryptographic primitives.
- **Argon2id:** State-of-the-art key derivation.

---
