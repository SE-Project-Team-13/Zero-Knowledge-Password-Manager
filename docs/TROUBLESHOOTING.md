# Troubleshooting & Support

## Installation Issues

### 1. `node-gyp` or C++ Build Errors
*   **Error**: `gyp ERR! find Python` or `Msbuild not found`
*   **Cause**: Missing build tools required for compiling native modules like `argon2`.
*   **Fix**: install the build tools for your OS (see [Prerequisites](./INSTALLATION.md#prerequisites)).
    *   **Windows**: Run `npm install --global --production windows-build-tools` (Admin) or install Desktop development with C++ via Visual Studio Installer.
    *   **macOS**: Run `xcode-select --install`.

### 2. `EADDRINUSE` (Port Already in Use)
*   **Error**: `listen EADDRINUSE: address already in use :::3001`
*   **Cause**: Another instance of the backend is running.
*   **Fix**: Kill the process on port 3001 (backend) or 3000 (frontend).
    *   **Mac/Linux**: `lsof -i :3001` then `kill -9 <PID>`
    *   **Windows**: `netstat -ano | findstr :3001` then `taskkill /PID <PID> /F`

### 3. `npm install` High Severity Vulnerabilities
*   **Note**: Some dependencies might show audit warnings.
*   **Action**: Use `npm audit fix` with caution. Most dev-tool warnings are safe to ignore for local development.

## Common Runtime Errors

### "Vault not found (404)" on Login
*   **Cause**: You are a new user and haven't saved any passwords yet.
*   **Fix**: The dashboard should auto-initialize an empty vault. Extensions might throw this error until you save your first password via the Dashboard.

### "OTP not received"
*   **Cause**: SMTP is not configured or configured incorrectly.
*   **Fix**: Check the terminal where `npm run dev:backend` is running. The OTP code is logged there: `[OTP] 🔑 Security Code: 123456`.

### "MongoDB Connection Failed"
*   **Cause**: Local MongoDB service is not running or URI is wrong.
*   **Fix**: Ensure `mongod` is running or check your Atlas IP whitelist.

## Uninstalling

To completely remove the application and its data:

1.  **Stop Servers**: `Ctrl+C` in your terminals.
2.  **Remove Directory**: `rm -rf Zero-Knowledge-Password-Manager`.
3.  **Drop Database** (MongoDB Shell):
    ```bash
    mongosh
    use vault
    db.dropDatabase()
    ```
