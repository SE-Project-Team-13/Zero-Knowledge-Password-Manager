# Installation Guide

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
*   **Recharts**: Composable charting library for dashboard analytics.
*   **Date-fns**: Modern date utility library.

### Backend (`/backend`)
*   **Node.js & Express**: High-performance web server framework.
*   **Mongoose**: MongoDB object modeling for asynchronous environment.
*   **Node-Cron**: Task scheduler for periodic breach detection jobs.
*   **Nodemailer**: Module for sending emails (OTP & Alerts).
*   **UUID**: For generating unique identifiers.
*   **Dotenv**: Zero-dependency module for loading environment variables.

### Crypto Engine (`/frontend/crypto-engine`)
*   **Web Crypto API**: Utilizing native browser capabilities for AES-GCM and random value generation.

## Installation Steps

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
