# Usage Guide

Once the servers are running, follow these steps to use the application:

## 1. Registering & Vault Creation
1.  Navigate to `http://localhost:3000`.
2.  Click **"Get Started"** or **"Register"**.
3.  Enter your Email and a Strong Master Password.
4.  **Important:** Your Master Password is *never* sent to the server. It generates your encryption keys locally.
5.  Verification: Check your terminal (or email) for the OTP code.

## 2. Managing Passwords
*   **Add Item**: Click the "+" button in the dashboard to add a new login.
*   **View Password**: Click the eye icon to decrypt and view a password.
*   **Copy**: Use the copy icon to copy username/password to clipboard.
*   **Edit/Delete**: Use the context menu on any item card.

## 3. Emergency Kit
1.  Go to **Settings** -> **Danger Zone**.
2.  Click **"Generate Emergency Kit"**.
3.  A PDF will be generated containing your **Recovery Key** and instructions.
4.  **Save this PDF securely!** It is the *only* way to recover your account if you forget your Master Password.

## 4. Breach Detection
The system automatically checks your email against a mock breach database.
*   **Manual Check**: The scheduled job runs every minute (in dev).
*   **Simulate Breach**: Use the email `breached@example.com` during registration to see the Red Alert Banner on the dashboard.
