# Zero-Knowledge Password Manager

> **A state-of-the-art, high-security password management system built with a true zero-knowledge architecture.**

[![Security](https://img.shields.io/badge/Security-AES--256--GCM-blueviolet?style=for-the-badge&logo=shield-security)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20MongoDB-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%20%7C%20Tailwind-black?style=for-the-badge&logo=next.js)](https://nextjs.org)

This repository contains the source code for the **Zero-Knowledge Password Manager**, a secure vault that ensures your data remains private even if the server is compromised.

## 📚 Documentation

We have separated the documentation into detailed guides to make it easier to navigate, maintain, and expand with UML diagrams.

*   **[Installation Guide](docs/INSTALLATION.md)**: Prerequisites, dependencies, and setup instructions.
*   **[Usage Guide](docs/USAGE.md)**: How to register, manage passwords, uses the emergency kit, and check for breaches.
*   **[Architecture Deep Dive](docs/ARCHITECTURE.md)**: Detailed explanation of the Zero-Knowledge protocol, k-Anonymity breach detection, and system design (UML diagrams).
*   **[Troubleshooting & Support](docs/TROUBLESHOOTING.md)**: Frequently asked questions, common installation errors, and uninstall instructions.
*   **[Contributing](CONTRIBUTING.md)**: Guidelines for contributing code.

## 🚀 Quick Start

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/SE-Project-Team-13/Zero-Knowledge-Password-Manager.git
    cd Zero-Knowledge-Password-Manager
    npm install
    npm run crypto:build
    ```

2.  **Run Development Servers**:
    ```bash
    # Terminal 1
    npm run dev:backend

    # Terminal 2
    npm run dev
    ```

3.  **Open Dashboard**: Visit `http://localhost:3000`.

---

## Features Overview

- **True Zero-Knowledge**: Server cannot decrypt your data.
- **Privacy-Preserving Breach Detection**: Checks your credentials against breach databases without exposing your accounts (using k-Anonymity).
- **Emergency Kit**: Generate a recovery PDF to regain access if you lose your master password.
- **Secure Sharing**: Share credentials securely (Simulated).
- **Multi-Platform**: Web Dashboard + Browser Extension.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
