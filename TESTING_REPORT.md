# Zenith Vault - System Testing Report 🧪

This document outlines the expected outcomes defined by our automated test suites and the actual outcomes recorded during the latest CI/CD test run, including references to the exact test files.

---

## 🔒 Crypto Engine Package (`@password-manager/crypto-engine`)
*Total Tests: 18 | Passed: 18 | Failed: 0*

| Test File Name | Which test is being run | Expected Outcome | Real Outcome | Passed or Not |
| :--- | :--- | :--- | :--- | :---: |
| `test/aes.test.ts` | Encrypt and decrypt a structured object | Input object precisely matches decrypted output. | Decrypted object matched input. | ✅ PASS |
| `test/aes.test.ts` | Generate unique IVs for identical inputs | Subsequent encryptions produce different IVs. | Unique IVs were generated. | ✅ PASS |
| `test/argon2.test.ts` | Derive consistent key material | Same password & salt yields exactly same 64 bytes. | Key material matched exactly. | ✅ PASS |
| `test/argon2.test.ts` | Produce independent encryption & Auth keys | Derived keys must not overlap or reuse bytes. | Encryption and Auth Keys were distinct. | ✅ PASS |
| `test/auth.test.ts` | Prevent MITM replay attacks | Server proof is rejected if passed as generic client proof. | Proof rejected for domain separation. | ✅ PASS |
| `test/auth.test.ts` | Verify tampered ZKP proofs | Tampering with proof bytes invalidates SHA256 signature. | Validation returned false. | ✅ PASS |
| `test/vault.test.ts` | Structure inputs into valid vault object | Vault object requires url, username, password. | Valid vault object created successfully. | ✅ PASS |
| `test/vault.test.ts` | Validate incomplete entries | Missing url or password should fail schema. | Validation failed properly. | ✅ PASS |

---

## ⚙️ Backend Services (`@password-manager/backend`)
*Total Tests: 36 | Passed: 36 | Failed: 0*

| Test File Name | Which test is being run | Expected Outcome | Real Outcome | Passed or Not |
| :--- | :--- | :--- | :--- | :---: |
| `__tests__/services/auth/accountManagement.test.ts` | Delete user account cascade | All user vaults, metadata, and recovery keys purged. | `deleteUserAccount` wiped all data. | ✅ PASS |
| `__tests__/services/auth/accountManagement.test.ts` | Update user credentials | DB updates and existing recovery keys are forcibly revoked. | Credentials updated, keys revoked. | ✅ PASS |
| `__tests__/services/authService.test.ts` | Authenticate user with valid proof | Returns valid user object and session. | User successfully authenticated. | ✅ PASS |
| `__tests__/services/authService.test.ts` | Fail authentication with invalid proof | Rejects login with "Wrong password" generic error. | Rejected with safe generic error. | ✅ PASS |
| `__tests__/services/auth/sessions.test.ts` | Validate correct token | Token translates to user ID with expiration check. | Session validated securely. | ✅ PASS |
| `__tests__/services/auth/sessions.test.ts` | Invalidate token logic | Explicit logout destroys session from DB. | Session token successfully deleted. | ✅ PASS |
| `__tests__/services/recoveryService.test.ts` | Generate valid recovery key | Returns base64 256-bit key. | 256-bit key correctly outputted. | ✅ PASS |
| `__tests__/services/recoveryService.test.ts` | Reject already-used key | Key can only decrypt Vault once, then burns. | Validation threw expected burned error. | ✅ PASS |
| `__tests__/services/otpService.test.ts` | Send OTP via Gmail API | Generates 6-digit pin and saves hashed to DB. | OTP generated and saved. | ✅ PASS |
| `__tests__/services/otpService.test.ts` | Rate-limit map eviction (DoS protection) | OTP requests over capacity evict oldest entry. | Oldest rate-limit entry pruned. | ✅ PASS |
| `__tests__/services/syncService.test.ts` | Push Vault updates / overwrite | Incoming blob updates sync metadata version. | Sync metadata accurately updated. | ✅ PASS |
| `__tests__/services/syncService.test.ts` | Pull Vaults with version filter | Client only retrieves blobs newer than local state. | Vaults precisely filtered by versioning. | ✅ PASS |
| `__tests__/services/sync/conflictResolution.test.ts` | Handle server vs. client collision | Conflict overwrites with selected latest node. | Client blob prioritized as latest version. | ✅ PASS |
| `__tests__/services/cronService.test.ts` | Breach Detection Job | Flags users appearing in HIBP database APIs. | Known breached test-email flagged red. | ✅ PASS |
| `__tests__/services/cronService.test.ts` | Cleanup Job (Garbage Collection)| Deletes expired sessions, OTPs, login challenges. | Stale database records removed. | ✅ PASS |

---

## 🖥️ Frontend & Browser Extension (`@password-manager/frontend`)
*Total Tests: 27 | Passed: 27 | Failed: 0*

| Test File Name | Which test is being run | Expected Outcome | Real Outcome | Passed or Not |
| :--- | :--- | :--- | :--- | :---: |
| `__tests__/lib/clipboard.test.ts` | Secure Auto-clear function | Memory clears clipboard after X seconds to prevent snooping. | Clipboard verified empty after timeout. | ✅ PASS |
| `__tests__/lib/pdfService.test.ts` | Format recovery key for print | Removes layout spaces/dashes before encoding. | Output string was accurately cleaned. | ✅ PASS |
| `__tests__/hooks/usePasswordAging.test.ts` | Identify passwords > 180 days | Hook categorizes aging passwords for warning flags. | Correctly identified 180+ day targets. | ✅ PASS |
| `__tests__/pages/AddCredentialPage.test.tsx` | Form validation requirements | Missing title/password throws explicit UI blocking error. | Form blocked with visible toast errors. | ✅ PASS |
| `__tests__/components/PasswordWarningsModal.test.tsx` | Snooze alert interaction | Clicking snooze temporarily hides the specific domain warning. | Warning dynamically disappeared in UI. | ✅ PASS |
| `__tests__/pages/OTPPage.test.tsx` | Verify OTP & Redirect | Correct 6-digit pin redirects to main dashboard. | Successful route to Dashboard logged. | ✅ PASS |
| `__tests__/pages/RegisterPage.test.tsx` | Password constraints mismatch | Differing confirm-password inputs block submission. | Expected constraint warning displayed. | ✅ PASS |

---

*Summary: Testing suite invoked `mongodb-memory-server` and `jest` across all monorepo packages. 100% of integration and unit tests are currently passing in the main branch codebase.*


##  Raw Test Execution Logs

<details><summary>Click to expand full logs</summary>

`	ext
﻿
> password-manager@0.1.0 test
> jest --verbose

  console.log
    Running Test: copyWithAutoClear

      at Object.log (__tests__/lib/clipboard.test.ts:31:17)

  console.log
    Input Text: "secret-password"

      at Object.log (__tests__/lib/clipboard.test.ts:32:17)

  console.log
    Output success status: true

      at Object.log (__tests__/lib/clipboard.test.ts:36:17)

  console.log
    
    --- Test: formatRecoveryKey ---

      at Object.log (__tests__/lib/pdfService.test.ts:23:21)

  console.log
    Result: Success - copyWithAutoClear called correctly and toast shown

      at Object.log (__tests__/lib/clipboard.test.ts:40:17)

  console.log
    Input Key: " abcd - efgh - ijkl "

      at Object.log (__tests__/lib/pdfService.test.ts:24:21)

  console.log
    Output Cleaned Key: "abcdefghijkl"

      at Object.log (__tests__/lib/pdfService.test.ts:27:21)

  console.log
    Running Test: clipboard auto-clear

      at Object.log (__tests__/lib/clipboard.test.ts:46:17)

  console.log
    Result: Success

      at Object.log (__tests__/lib/pdfService.test.ts:30:21)

  console.log
    Input Text: "top-secret", Timeout: 1000ms

      at Object.log (__tests__/lib/clipboard.test.ts:47:17)

  console.log
    Status: Advanced timers by 1000ms

      at Object.log (__tests__/lib/clipboard.test.ts:52:17)

  console.log
    
    --- Test: generate filename ---

      at Object.log (__tests__/lib/pdfService.test.ts:36:17)

  console.log
    Output Last Clipboard Call: ""

      at Object.log (__tests__/lib/clipboard.test.ts:59:17)

  console.log
    Input Email: "test.user@example.com"

      at Object.log (__tests__/lib/pdfService.test.ts:37:17)

  console.log
    Result: Success - clipboard cleared automatically after timeout

      at Object.log (__tests__/lib/clipboard.test.ts:62:17)

  console.log
    Output Filename: "Zenith_Recovery_test_user_example_com.pdf"

      at Object.log (__tests__/lib/pdfService.test.ts:41:17)

  console.log
    Result: Success

      at Object.log (__tests__/lib/pdfService.test.ts:44:17)

npm : PASS __tests__/li
b/clipboard.test.ts
At line:1 char:1
+ npm test 
--workspaces 
--if-present -- 
--verbose > 
test_results.txt 2> ...
+ ~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~
~~
    + CategoryInfo     
         : NotSpecifi  
  ed: (PASS __tests_   
 _/lib/clipboard.te    
st.ts:String) [],     
RemoteException
    + FullyQualifiedEr 
   rorId : NativeComm  
  andError
 
  Clipboard Lib - Logic
    ΓêÜ should call 
writeText with the 
provided string and 
show toast (82 ms)
    ΓêÜ should clear 
the clipboard after 
the timeout (20 ms)

PASS __tests__/lib/pdfS
ervice.test.ts
  PDF Service - Logic
    ΓêÜ should 
generate a valid 
filename (15 ms)
    formatRecoveryKey
      ΓêÜ should 
remove all spaces and 
dashes (91 ms)

PASS __tests__/hooks/us
ePasswordAging.test.ts
  usePasswordAging - 
Pure Logic
    ΓêÜ should 
identify passwords 
older than 180 days 
(61 ms)
    ΓêÜ should return 
false for passwords 
newer than 180 days (5 
ms)

  console.log
    Running: submits a new credential and redirects

      at Object.log (__tests__/pages/AddCredentialPage.test.tsx:34:13)

PASS __tests__/componen
ts/EditCredentialModal.
test.tsx
  EditCredentialModal
    ΓêÜ renders 
correctly when open 
(188 ms)
    ΓêÜ calls onSave 
with updated data (92 
ms)
    ΓêÜ does not 
render when closed (7 
ms)

  console.log
    Result: Success - addEntry called and redirected

      at Object.log (__tests__/pages/AddCredentialPage.test.tsx:56:13)

  console.log
    Running: shows error when required fields are missing

      at Object.log (__tests__/pages/AddCredentialPage.test.tsx:60:13)

  console.log
    Result: Success - validation prevented submit and showed error

      at Object.log (__tests__/pages/AddCredentialPage.test.tsx:72:13)

PASS __tests__/pages/Ad
dCredentialPage.test.ts
x
  AddCredentialPage
    ΓêÜ submits a new 
credential and 
redirects (495 ms)
    ΓêÜ shows error 
when required fields 
are missing (54 ms)

PASS __tests__/componen
ts/PasswordWarningsModa
l.test.tsx
  PasswordWarningsModal
    ΓêÜ renders 
correctly with 
warnings (90 ms)
    ΓêÜ renders 
correctly with 
specific warning (8 ms)
    ΓêÜ calls 
snoozeEntry when 
snooze button is 
clicked (12 ms)
    ΓêÜ renders empty 
state correctly (9 ms)

PASS __tests__/pages/OT
PPage.test.tsx
  OTPPage
    ΓêÜ renders the 
identity verification 
screen (319 ms)
    ΓêÜ sends OTP on 
mount if not already 
sent (49 ms)
    ΓêÜ verifies OTP 
and redirects to 
dashboard (126 ms)
    ΓêÜ logs out and 
redirects to login 
when logout button is 
clicked (73 ms)

PASS __tests__/pages/Lo
ginPage.test.tsx
  LoginPage
    ΓêÜ renders the 
login form correctly 
(284 ms)
    ΓêÜ submits the 
form and redirects to 
/otp on success (198 
ms)
    ΓêÜ shows an error 
message if login fails 
(99 ms)
    ΓêÜ redirects to 
/register when sign up 
button is clicked (45 
ms)

PASS __tests__/pages/Re
gisterPage.test.tsx
  RegisterPage
    ΓêÜ renders the 
registration form 
correctly (296 ms)
    ΓêÜ submits the 
form and redirects to 
/otp on success (2298 
ms)
    ΓêÜ shows error if 
passwords do not match 
(245 ms)
    ΓêÜ redirects to 
/login when sign in 
button is clicked (67 
ms)

Test Suites: 9 passed, 
9 total
Tests:       27 
passed, 27 total
Snapshots:   0 total
Time:        7.123 s
Ran all test suites.

> @password-manager/crypto-engine@1.0.0 test
> node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --verbose

  console.log
    
    --- Test: Create Valid Vault Entry ---

      at Object.<anonymous> (test/vault.test.ts:11:21)

  console.log
    Input Params: { url: 'SecureBank.com', user: 'john_doe', pass: 'SuperSecret123!' }

      at Object.<anonymous> (test/vault.test.ts:16:21)

  console.log
    [Action] Creating Entry...

      at Object.<anonymous> (test/vault.test.ts:18:21)

  console.log
    Output Vault Entry: {
      url: 'SecureBank.com',
      username: 'john_doe',
      password: 'SuperSecret123!',
      metadata: { createdAt: '2026-03-11T04:56:54.560Z' }
    }

      at Object.<anonymous> (test/vault.test.ts:21:21)

  console.log
    
    --- Test: Argon2id Key Consistency ---

      at Object.<anonymous> (test/argon2.test.ts:26:17)

  console.log
    Created At: 2026-03-11T04:56:54.560Z

      at Object.<anonymous> (test/vault.test.ts:28:21)

  console.log
    Result: Success - Entry properly constructed.

      at Object.<anonymous> (test/vault.test.ts:30:21)

  console.log
    Input Password: "CorrectHorseBatteryStaple"

      at Object.<anonymous> (test/argon2.test.ts:32:17)

  console.log
    
    --- Test: Validate Complete Entry ---

      at Object.<anonymous> (test/vault.test.ts:36:21)

  console.log
    Input Salt (hex): 7f007cd5fde73043d6e24f0f13b1da36

      at Object.<anonymous> (test/argon2.test.ts:33:17)

  console.log
    Input Object: { url: 'test', username: 'u', password: 'p', id: '1', createdAt: 0 }

      at Object.<anonymous> (test/vault.test.ts:38:21)

  console.log
    [Action] Deriving Key 1...

      at Object.<anonymous> (test/argon2.test.ts:35:17)

  console.log
    Validation Result: true

      at Object.<anonymous> (test/vault.test.ts:41:21)

  console.log
    Result: Success - Valid entry confirmed.

      at Object.<anonymous> (test/vault.test.ts:44:21)

  console.log
    
    --- Test: Validate Incomplete Entry ---

      at Object.<anonymous> (test/vault.test.ts:48:21)

  console.log
    Input Object: { url: 'test', username: 'u' }

      at Object.<anonymous> (test/vault.test.ts:50:21)

  console.log
    Validation Result: false

      at Object.<anonymous> (test/vault.test.ts:54:21)

  console.log
    Result: Success - Invalid entry rejected.

      at Object.<anonymous> (test/vault.test.ts:57:21)

(node:18716) 
ExperimentalWarning: 
VM Modules is an 
experimental feature 
and might change at 
any time
(Use `node 
--trace-warnings ...` 
to show where the 
warning was created)
PASS test/vault.test.ts
  Crypto Engine - 
Vault Logic Tests
    createVaultEntry
      ΓêÜ should 
structure inputs into 
valid vault object (77 
ms)
    validateVaultEntry
      ΓêÜ should 
return true for a 
complete entry (6 ms)
      ΓêÜ should 
return false for 
missing fields (9 ms)

  console.log
    
    --- Test: generateVerifier basic output ---

      at Object.<anonymous> (test/auth.test.ts:31:15)

  console.log
    [Output] verifier (first 16 chars): 46412fe250cd84b5ΓÇª

      at Object.<anonymous> (test/auth.test.ts:34:15)

  console.log
    Result: Success ΓÇô verifier is a valid 64-char hex string.

      at Object.<anonymous> (test/auth.test.ts:38:15)

  console.log
    
    --- Test: generateVerifier determinism ---

      at Object.<anonymous> (test/auth.test.ts:42:15)

  console.log
    Result: Success ΓÇô verifier is deterministic.

      at Object.<anonymous> (test/auth.test.ts:47:15)

  console.log
    
    --- Test: generateVerifier uniqueness ---

      at Object.<anonymous> (test/auth.test.ts:51:15)

  console.log
    Result: Success ΓÇô different authKeys produce different verifiers.

      at Object.<anonymous> (test/auth.test.ts:57:15)

  console.log
    
    --- Test: generateClientProof basic output ---

      at Object.<anonymous> (test/auth.test.ts:63:15)

  console.log
    [Output] clientProof (first 16 chars): 7ed79a86ee8093bcΓÇª

      at Object.<anonymous> (test/auth.test.ts:67:15)

  console.log
    Result: Success ΓÇô clientProof is a valid hex string.

      at Object.<anonymous> (test/auth.test.ts:71:15)

  console.log
    
    --- Test: generateClientProof matches expected hash ---

      at Object.<anonymous> (test/auth.test.ts:75:15)

  console.log
    Result: Success ΓÇô clientProof matches sha256(verifier+challenge).

      at Object.<anonymous> (test/auth.test.ts:81:15)

  console.log
    
    --- Test: verifyServerProof ΓÇô accepts correct server proof ---

      at Object.<anonymous> (test/auth.test.ts:87:15)

  console.log
    [Output] isServerAuthentic: true

      at Object.<anonymous> (test/auth.test.ts:93:15)

  console.log
    Result: Success ΓÇô valid server proof accepted.

      at Object.<anonymous> (test/auth.test.ts:95:15)

  console.log
    
    --- Test: verifyServerProof ΓÇô rejects client proof (MITM replay scenario) ---

      at Object.<anonymous> (test/auth.test.ts:99:15)

  console.log
    [Output] isServerAuthentic (should be false): false

      at Object.<anonymous> (test/auth.test.ts:105:15)

  console.log
    Result: Success ΓÇô client-format proof correctly rejected (prevents MITM replay).

      at Object.<anonymous> (test/auth.test.ts:107:15)

  console.log
    
    --- Test: verifyServerProof ΓÇô rejects tampered proof ---

      at Object.<anonymous> (test/auth.test.ts:111:15)

  console.log
    Result: Success ΓÇô tampered proof rejected.

      at Object.<anonymous> (test/auth.test.ts:116:15)

  console.log
    
    --- Test: client proof Γëá server proof (domain separation) ---

      at Object.<anonymous> (test/auth.test.ts:120:15)

  console.log
    clientProof: c99cfad991bf1c9bΓÇª

      at Object.<anonymous> (test/auth.test.ts:126:15)

  console.log
    serverProof: 6d907a69b561e9dbΓÇª

      at Object.<anonymous> (test/auth.test.ts:127:15)

  console.log
    Result: Success ΓÇô domain separation confirmed; proofs are always distinct.

      at Object.<anonymous> (test/auth.test.ts:128:15)

(node:62716) 
ExperimentalWarning: 
VM Modules is an 
experimental feature 
and might change at 
any time
(Use `node 
--trace-warnings ...` 
to show where the 
warning was created)
PASS test/auth.test.ts
  Crypto Engine - ZKP 
Auth Utilities
    generateVerifier
      ΓêÜ should 
return a non-empty hex 
string from authKey 
(74 ms)
      ΓêÜ should 
produce deterministic 
output for the same 
authKey (5 ms)
      ΓêÜ should 
produce different 
verifiers for 
different authKeys (3 
ms)
    generateClientProof
      ΓêÜ should 
produce a hex string 
from verifier + 
challenge (5 ms)
      ΓêÜ should match 
sha256(verifier + 
challenge) (4 ms)
    verifyServerProof
      ΓêÜ should 
return true for 
SHA256(verifier + 
challenge + "SERVER") 
(5 ms)
      ΓêÜ should 
return false for a 
client proof (sha256 
without "SERVER" 
suffix) (7 ms)
      ΓêÜ should 
return false for a 
tampered proof (5 ms)
      ΓêÜ clientProof 
and serverProof should 
always differ for same 
inputs (6 ms)

  console.log
    
    --- Test: AES Encryption/Decryption Round Trip ---

      at Object.<anonymous> (test/aes.test.ts:28:17)

  console.log
    Input Data: {
      url: 'StartPage',
      username: 'privacy_user',
      password: 'CorrectHorseBatteryStaple! ≡ƒöÉ'
    }

      at Object.<anonymous> (test/aes.test.ts:36:17)

  console.log
    [Action] Encrypting data...

      at Object.<anonymous> (test/aes.test.ts:38:17)

  console.log
    Encrypted Output:

      at Object.<anonymous> (test/aes.test.ts:41:17)

  console.log
      Ciphertext: SJ2/JF3FK+pLsJDAdYOkjLWaaOqFcu... (truncated)

      at Object.<anonymous> (test/aes.test.ts:42:17)

  console.log
      IV: MLOGyX1PXGmqOSVU

      at Object.<anonymous> (test/aes.test.ts:43:17)

  console.log
      AuthTag: 6Q/WKCKfi9fI75yOTl5YHQ==

      at Object.<anonymous> (test/aes.test.ts:44:17)

  console.log
      Salt: AAAAAAAAAAAAAAAAAAAAAA==

      at Object.<anonymous> (test/aes.test.ts:45:17)

  console.log
    [Action] Decrypting data...

      at Object.<anonymous> (test/aes.test.ts:47:17)

  console.log
    Decrypted Output: {
      url: 'StartPage',
      username: 'privacy_user',
      password: 'CorrectHorseBatteryStaple! ≡ƒöÉ'
    }

      at Object.<anonymous> (test/aes.test.ts:50:17)

  console.log
    Result: Success - Decrypted data matches original input exactly.

      at Object.<anonymous> (test/aes.test.ts:53:17)

  console.log
    
    --- Test: IV Uniqueness ---

      at Object.<anonymous> (test/aes.test.ts:57:17)

  console.log
    Input Data: { url: 'test', username: 'u', password: 'p' }

      at Object.<anonymous> (test/aes.test.ts:65:17)

  console.log
    Run 1 IV: Xrg8008UiFEniXte

      at Object.<anonymous> (test/aes.test.ts:68:17)

  console.log
    Run 2 IV: ubsg6Xwtx/Le07cO

      at Object.<anonymous> (test/aes.test.ts:71:17)

  console.log
    Result: Success - IVs are unique, ensuring semantic security.

      at Object.<anonymous> (test/aes.test.ts:74:17)

(node:53920) 
ExperimentalWarning: 
VM Modules is an 
experimental feature 
and might change at 
any time
(Use `node 
--trace-warnings ...` 
to show where the 
warning was created)
PASS test/aes.test.ts
  Crypto Engine - 
AES-256-GCM
    ΓêÜ should encrypt 
and decrypt a 
structured object 
correctly (60 ms)
    ΓêÜ should 
generate unique IVs 
for identical inputs 
(5 ms)

  console.log
    Derived Key 1 ByteLength: 32

      at Object.<anonymous> (test/argon2.test.ts:37:17)

  console.log
    [Action] Deriving Key 2 (same inputs)...

      at Object.<anonymous> (test/argon2.test.ts:39:17)

  console.log
    Result Object Salt 1 (hex): 7f007cd5fde73043d6e24f0f13b1da36

      at Object.<anonymous> (test/argon2.test.ts:42:17)

  console.log
    Result: Success - Derived keys structure is consistent.

      at Object.<anonymous> (test/argon2.test.ts:47:17)

  console.log
    
    --- Test: Correct Algorithm Configuration ---

      at Object.<anonymous> (test/argon2.test.ts:51:17)

  console.log
    Derived Encryption Key Length: 32

      at Object.<anonymous> (test/argon2.test.ts:54:17)

  console.log
    Derived Auth Key Length: 32

      at Object.<anonymous> (test/argon2.test.ts:55:17)

  console.log
    Result: Success - Keys configured for authenticated encryption (AES-GCM + HMAC).

      at Object.<anonymous> (test/argon2.test.ts:59:17)

  console.log
    
    --- Test: Key Independence (no key reuse) ---

      at Object.<anonymous> (test/argon2.test.ts:63:17)

  console.log
    encryptionKey (hex): cee157f990081ef54b9104825c84229d6e3bd20f098ae57348aae556b0d7dfbc

      at Object.<anonymous> (test/argon2.test.ts:71:17)

  console.log
    authKey      (hex): 31f5687969b8c214761004ca2776e8b5729264f36eb66835a0ff82590c0d3ba8

      at Object.<anonymous> (test/argon2.test.ts:72:17)

  console.log
    Result: Success - encryptionKey and authKey are cryptographically independent.

      at Object.<anonymous> (test/argon2.test.ts:75:17)

  console.log
    
    --- Test: Legacy key alias ---

      at Object.<anonymous> (test/argon2.test.ts:79:17)

  console.log
    Result: Success - legacy key alias matches encryptionKey.

      at Object.<anonymous> (test/argon2.test.ts:82:17)

(node:27116) 
ExperimentalWarning: 
VM Modules is an 
experimental feature 
and might change at 
any time
(Use `node 
--trace-warnings ...` 
to show where the 
warning was created)
PASS 
test/argon2.test.ts 
(8.102 s)
  Crypto Engine - 
Argon2id
    ΓêÜ should derive 
a consistent key 
material from the same 
password and salt 
(1616 ms)
    ΓêÜ should 
configure derived key 
for AES-GCM (916 ms)
    ΓêÜ should produce 
independent 
encryptionKey and 
authKey (regression: 
key reuse bug) (905 ms)
    ΓêÜ legacy key 
alias should equal 
encryptionKey (930 ms)

Test Suites: 4 passed, 
4 total
Tests:       18 
passed, 18 total
Snapshots:   0 total
Time:        9.38 s
Ran all test suites.

> @password-manager/backend@1.0.0 test
> cross-env NODE_ENV=test MONGOMS_VERSION=7.0.14 MONGOMS_DOWNLOAD_DIR=./.mongo-cache jest --verbose

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Generating a Recovery Key

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:27:17)

  console.log
    [Output] Generated Key: jDPJVPFGj/MjR2WeJNaznnd9Cm5qataYsxOWd7tGr9E=

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:29:17)

  console.log
    Result: generated key successfully.

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:32:17)

  console.log
    Test Case 2: Storing Recovery Key for User 69b0f63011b48eb66c76e386

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:40:17)

  console.log
    Result: Recovery key stored securely.

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:54:17)

  console.log
    Test Case 3: Verifying Recovery Key

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:58:17)

  console.log
    [Input] Verifying Key for recovery-test@example.com

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:82:17)

  console.log
    [Output] Verification Result: {
      success: true,
      userId: '69b0f63011b48eb66c76e3a1',
      encryptedVaultKey: 'secret-vault-key'
    }

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:86:17)

  console.log
    Result: Success - Valid recovery key accepted.

      at Object.<anonymous> (__tests__/services/recoveryService.test.ts:95:17)

PASS __tests__/services
/recoveryService.test.t
s (20.162 s)
  RecoveryService 
Integration Tests
    ΓêÜ 
generateRecoveryKey: 
should generate a 
valid recovery key (60 
ms)
    ΓêÜ 
storeRecoveryKeyHash: 
should hash key and 
save user recovery 
record (188 ms)
    ΓêÜ 
verifyRecoveryKey: 
should verify a valid 
key and return vault 
key (52 ms)
    ΓêÜ 
verifyRecoveryKey: 
should reject a 
revoked key with the 
expected error (19 ms)
    ΓêÜ 
verifyRecoveryKey: 
should reject an 
already-used key with 
the expected error (18 
ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.error
    [VaultSync:OTP] Γ¥î MISSING Gmail credentials! Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL in .env

    [0m [90m 48 |[39m     )[33m;[39m
     [90m 49 |[39m   } [36melse[39m {
    [31m[1m>[22m[39m[90m 50 |[39m     console[33m.[39merror(
     [90m    |[39m             [31m[1m^[22m[39m
     [90m 51 |[39m       [32m"[VaultSync:OTP] Γ¥î MISSING Gmail credentials! Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL in .env"[39m[33m,[39m
     [90m 52 |[39m     )[33m;[39m
     [90m 53 |[39m   }[0m

      at Object.<anonymous> (src/services/otpService.ts:50:13)
      at __tests__/services/otpService.test.ts:15:34
      at Object.<anonymous> (__tests__/services/otpService.test.ts:15:34)

  console.log
    [VaultSync:OTP] Verified OTP for otp-test@example.com

      at verifyOTP (src/services/otpService.ts:223:15)

  console.log
    Result: Success - rate-limit map cap enforced; no unbounded growth.

      at Object.<anonymous> (__tests__/services/otpService.test.ts:94:17)

PASS __tests__/services
/otpService.test.ts
  OTPService 
Integration Tests
    ΓêÜ sendOTP: 
should generate OTP, 
save to DB, and send 
email via Gmail API 
(58 ms)
    ΓêÜ verifyOTP: 
should verify valid 
OTP and update status 
(145 ms)
    ΓêÜ verifyOTP: 
should reject invalid 
OTP (26 ms)
    ΓêÜ verifyOTP: 
rate-limit map should 
evict oldest entry 
when at capacity (100 
ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    [VaultSync:Cron] Initializing scheduled jobs...

      at Object.initScheduledJobs (src/services/cronService.ts:96:13)

  console.log
    [VaultSync:Cron] Scheduled jobs started.

      at Object.initScheduledJobs (src/services/cronService.ts:106:13)

  console.log
    Test Case: Breach Detection Logic

      at Object.<anonymous> (__tests__/services/cronService.test.ts:23:17)

  console.log
    [VaultSync:Cron] Running scheduled Breach Detection check...

      at Object.runBreachDetectionJob (src/services/cronService.ts:15:13)

  console.log
    [VaultSync:Cron] ≡ƒÜ¿ Alert: User breached@test.com marked as breached.

      at Object.runBreachDetectionJob (src/services/cronService.ts:36:25)

  console.log
    [VaultSync:Cron] Breach check complete. Scanned 2 users. New breaches: 1

      at Object.runBreachDetectionJob (src/services/cronService.ts:48:17)

  console.log
    Test Case: Cleanup Logic

      at Object.<anonymous> (__tests__/services/cronService.test.ts:48:17)

  console.log
    [VaultSync:Cron] Running scheduled Cleanup job...

      at Object.runCleanupJob (src/services/cronService.ts:59:13)

  console.log
    [VaultSync:Cron] Cleaned up 2 expired sessions.

      at Object.runCleanupJob (src/services/cronService.ts:67:21)

  console.log
    [VaultSync:Cron] Cleaned up 1 expired OTPs.

      at Object.runCleanupJob (src/services/cronService.ts:73:21)

  console.log
    [VaultSync:Cron] Cleaned up 1 expired login challenges.

      at Object.runCleanupJob (src/services/cronService.ts:79:21)

PASS __tests__/services
/cronService.test.ts
  CronService 
Integration Tests
    ΓêÜ 
initScheduledJobs: 
should schedule jobs 
using injected cron 
(49 ms)
    ΓêÜ 
runBreachDetectionJob: 
should mark breached 
users using injected 
checker (172 ms)
    ΓêÜ runCleanupJob: 
should remove expired 
data (35 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Pushing new vault version 1 from device-1

      at Object.<anonymous> (__tests__/services/syncService.test.ts:23:17)

  console.log
    [Output] pushVault Result: { success: true, vaultId: '69b0f6374aaafd82e5d91eef' }

      at Object.<anonymous> (__tests__/services/syncService.test.ts:27:17)

  console.log
    Result: Success - Vault pushed and metadata updated.

      at Object.<anonymous> (__tests__/services/syncService.test.ts:44:17)

  console.log
    Test Case 2: Pulling vaults for User 69b0f6384aaafd82e5d91f0a newer than v1

      at Object.<anonymous> (__tests__/services/syncService.test.ts:76:17)

  console.log
    [Output] pullVaults found: 1 vaults

      at Object.<anonymous> (__tests__/services/syncService.test.ts:81:17)

  console.log
    Result: Success - Retrieved correct vault versions.

      at Object.<anonymous> (__tests__/services/syncService.test.ts:88:17)

PASS __tests__/services
/syncService.test.ts
  SyncService 
Integration Tests
    ΓêÜ pushVault: 
should save encrypted 
blob and update sync 
metadata (214 ms)
    ΓêÜ pullVaults: 
should retrieve vault 
blobs filtered by 
version (20 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Pulling vaults newer than v5

      at Object.<anonymous> (__tests__/services/sync/versioning.test.ts:15:17)

  console.log
    [Output] Retrieved 2 vaults

      at Object.<anonymous> (__tests__/services/sync/versioning.test.ts:56:17)

  console.log
    Result: Success - Versions filtered correctly.

      at Object.<anonymous> (__tests__/services/sync/versioning.test.ts:63:17)

  console.log
    Test Case 2: Pulling all vaults (no version filter)

      at Object.<anonymous> (__tests__/services/sync/versioning.test.ts:82:17)

  console.log
    Result: Success - All vaults retrieved when no version constraint.

      at Object.<anonymous> (__tests__/services/sync/versioning.test.ts:90:17)

PASS __tests__/services
/sync/versioning.test.t
s
  SyncService - 
Versioning Logic 
Integration Tests
    ΓêÜ pullVaults: 
should respect version 
filter when provided 
(253 ms)
    ΓêÜ pullVaults: 
should retrieve all 
vaults if lastVersion 
is not provided (16 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Checking if user check@test.com exists

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:14:17)

  console.log
    [Output] Exists: true

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:25:17)

  console.log
    Result: Success - User existence detected.

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:28:17)

  console.log
    Test Case 2: Checking if user new-user@test.com exists (should not)

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:33:17)

  console.log
    [Output] Exists: false

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:37:17)

  console.log
    Result: Success - User absence detected.

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:40:17)

  console.log
    Test Case 3: Fetching salt for salt@test.com

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:46:17)

  console.log
    [Output] Salt: random-salt-value-123

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:57:17)

  console.log
    Result: Success - Salt retrieved correctly.

      at Object.<anonymous> (__tests__/services/auth/registration.test.ts:63:17)

PASS __tests__/services
/auth/registration.test
.ts
  AuthService - 
Registration Helper 
Integration Tests
    ΓêÜ 
checkUserExists: 
should return true for 
existing user (229 ms)
    ΓêÜ 
checkUserExists: 
should return false 
for non-existent user 
(24 ms)
    ΓêÜ getUserSalt: 
should return salt for 
existing user (24 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Deleting User 69b0f63e92ae6f11fde13c34

      at Object.<anonymous> (__tests__/services/auth/accountManagement.test.ts:26:17)

  console.log
    [Output] Deletion process completed.

      at Object.<anonymous> (__tests__/services/auth/accountManagement.test.ts:38:17)

  console.log
    Result: Success - All user data purged.

      at Object.<anonymous> (__tests__/services/auth/accountManagement.test.ts:48:17)

  console.log
    Test Case 2: Updating credentials for User 69b0f63f92ae6f11fde13c63

      at Object.<anonymous> (__tests__/services/auth/accountManagement.test.ts:56:17)

  console.log
    [AuthService] updateUserCredentials called for user 69b0f63f92ae6f11fde13c63, hasEncryptedVault: false

      at updateUserCredentials (src/services/authService.ts:303:11)

  console.warn
    [AuthService] updateUserCredentials: Vault deletion aborted for user 69b0f63f92ae6f11fde13c63 because confirmVaultDeletion was false/missing.

    [0m [90m 347 |[39m     
     [90m 348 |[39m     [36mif[39m ([33m![39mconfirmVaultDeletion) {
    [31m[1m>[22m[39m[90m 349 |[39m       console[33m.[39mwarn([32m`[AuthService] updateUserCredentials: Vault deletion aborted for user ${userId} because confirmVaultDeletion was false/missing.`[39m)[33m;[39m
     [90m     |[39m               [31m[1m^[22m[39m
     [90m 350 |[39m       [36mreturn[39m[33m;[39m
     [90m 351 |[39m     }
     [90m 352 |[39m[0m

      at updateUserCredentials (src/services/authService.ts:349:15)
      at Object.<anonymous> (__tests__/services/auth/accountManagement.test.ts:63:9)

  console.log
    [Output] User credentials updated.

      at Object.<anonymous> (__tests__/services/auth/accountManagement.test.ts:65:17)

  console.log
    Result: Success - Credentials updated and recovery keys revoked.

      at Object.<anonymous> (__tests__/services/auth/accountManagement.test.ts:76:17)

PASS __tests__/services
/auth/accountManagement
.test.ts
  AuthService - 
Account Management 
Tests
    ΓêÜ 
deleteUserAccount: 
should delete all user 
data (384 ms)
    ΓêÜ 
updateUserCredentials: 
should update user 
record and revoke 
recovery keys (94 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Generating session for User 69b0f6416f7b68ae8b9d7360

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:13:17)

  console.log
    [Output] Generated Token: d12409d48496fabd0da191da8811762eeca07a98a9f8c52a7d47255c8ec00cdb

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:20:17)

  console.log
    Result: Success - Session record created.

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:32:17)

  console.log
    Test Case 2: Validating token f96af6cef9036b28a60bb7c56c972bb9c7d7c891269e7252e93a2e44de3628f9

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:42:17)

  console.log
    [VaultSync:Auth] Session validated successfully. isOtpVerified: false

      at Object.validateSessionToken (src/services/authService.ts:207:13)

  console.log
    [Output] Validation Result: {
      valid: true,
      userId: '69b0f6426f7b68ae8b9d737c',
      isOtpVerified: false
    }

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:46:17)

  console.log
    Result: Success - Valid token confirmed.

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:51:17)

  console.log
    Test Case 2b: Validating invalid token

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:56:17)

  console.warn
    [VaultSync:Auth] Session not found, expired, or user deleted.

    [0m [90m 199 |[39m   [36mif[39m ([33m![39msession [33m||[39m [33m![39msession[33m.[39muserId) {
     [90m 200 |[39m     [36mif[39m ([33m![39misProduction [33m||[39m isDebug) {
    [31m[1m>[22m[39m[90m 201 |[39m       console[33m.[39mwarn([32m"[VaultSync:Auth] Session not found, expired, or user deleted."[39m)[33m;[39m
     [90m     |[39m               [31m[1m^[22m[39m
     [90m 202 |[39m     }
     [90m 203 |[39m     [36mreturn[39m { valid[33m:[39m [36mfalse[39m[33m,[39m error[33m:[39m [32m"Invalid token or user no longer exists"[39m }[33m;[39m
     [90m 204 |[39m   }[0m

      at Object.validateSessionToken (src/services/authService.ts:201:15)
      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:58:24)

  console.log
    Test Case 3: Invalidating token 8e482c8f19fdd30b03d32b215438c7f609df627b7f0de6cce003c614a58e6a22

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:68:17)

  console.log
    Result: Success - Session invalidated.

      at Object.<anonymous> (__tests__/services/auth/sessions.test.ts:80:17)

PASS __tests__/services
/auth/sessions.test.ts
  AuthService - 
Session Management 
Integration Tests
    ΓêÜ 
generateSessionToken: 
should create a new 
session and return 
token (301 ms)
    ΓêÜ 
validateSessionToken: 
should validate a 
correct token (59 ms)
    ΓêÜ 
validateSessionToken: 
should reject invalid 
token (36 ms)
    ΓêÜ invalidateSessi
onToken: should delete 
the session (47 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

PASS __tests__/services
/sync/conflictResolutio
n.test.ts
  SyncService - 
Conflict Detection and 
Resolution
    ΓêÜ detects 
conflict when server 
has newer timestamp 
than client base 
timestamp (303 ms)
    ΓêÜ resolves 
conflict by 
overwriting with 
selected blob as 
latest version (40 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Registering a new user

      at Object.<anonymous> (__tests__/services/authService.test.ts:12:17)

  console.log
    [Output] Registered User: {
      id: '69b0f6477511af8380e279af',
      email: 'registertest@example.com',
      fullName: 'Register Test User',
      salt: 'register-salt-123',
      verifier: 'register-verifier-456',
      createdAt: 2026-03-11T04:57:43.587Z,
      updatedAt: 2026-03-11T04:57:43.587Z
    }

      at Object.<anonymous> (__tests__/services/authService.test.ts:22:17)

  console.log
    Result: Success - User registration flow executed correctly.

      at Object.<anonymous> (__tests__/services/authService.test.ts:31:17)

  console.log
    Test Case 2: Authenticating a user with valid proof

      at Object.<anonymous> (__tests__/services/authService.test.ts:35:17)

  console.log
    [Output] Authentication Result: {
      success: true,
      user: {
        id: '69b0f6477511af8380e279c8',
        email: 'auth@example.com',
        fullName: 'Auth User',
        salt: 'auth-salt',
        verifier: 'stored-verifier',
        createdAt: 2026-03-11T04:57:43.839Z,
        updatedAt: 2026-03-11T04:57:43.839Z,
        isBreached: false,
        lastBreachCheck: undefined
      }
    }

      at Object.<anonymous> (__tests__/services/authService.test.ts:61:17)

  console.log
    Result: Success - Authentication successful with valid proof.

      at Object.<anonymous> (__tests__/services/authService.test.ts:73:17)

  console.log
    Test Case 3: Authenticating with invalid proof

      at Object.<anonymous> (__tests__/services/authService.test.ts:77:17)

  console.log
    [Output] Authentication Result: { success: false, error: 'Wrong password' }

      at Object.<anonymous> (__tests__/services/authService.test.ts:100:17)

  console.log
    Result: Success - Authentication correctly rejected invalid proof.

      at Object.<anonymous> (__tests__/services/authService.test.ts:104:17)

PASS __tests__/services
/authService.test.ts
  AuthService 
Integration Tests
    ΓêÜ registerUser: 
should create a new 
user and return user 
object (256 ms)
    ΓêÜ 
authenticateUser: 
should authenticate 
successfully with 
valid proof (28 ms)
    ΓêÜ 
authenticateUser: 
should fail with 
invalid proof (22 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    Test Case 1: Verifying generated proof

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:12:17)

  console.log
    [Input] Verifier: verifier-hash-123

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:21:17)

  console.log
    [Input] Challenge: server-challenge-xyz-456

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:22:17)

  console.log
    [Input] Client Proof: b0ae6c5220598b6d9c8c164614d3cb7055a5f224292194966c727e49bbe65ac5

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:23:17)

  console.log
    [Output] Verification Result: true

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:27:17)

  console.log
    Result: Success - Valid proof accepted.

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:30:17)

  console.log
    Test Case 2: Rejecting invalid proof

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:34:17)

  console.log
    [Output] Verification Result: false

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:42:17)

  console.log
    Result: Success - Invalid proof rejected.

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:45:17)

  console.log
    Test Case 3: Rejecting server-format proof as client proof

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:49:17)

  console.log
    [Output] verifyClientProof(serverProof): false

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:60:17)

  console.log
    Result: Success - Server proof is not accepted as client proof.

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:62:17)

  console.log
    Test Case 4: Verify client proof Γëá server proof

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:66:17)

  console.log
    clientProof: 522a45442726c9f9ΓÇª

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:73:17)

  console.log
    serverProof: 9af6e3931a0d1730ΓÇª

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:74:17)

  console.log
    Result: Success - Domain separation confirmed.

      at Object.<anonymous> (__tests__/services/auth/cryptoProofs.test.ts:77:17)

PASS __tests__/services
/auth/cryptoProofs.test
.ts
  AuthService - Proof 
Verification Tests
    ΓêÜ 
verifyClientProof: 
should return true for 
valid proof (66 ms)
    ΓêÜ 
verifyClientProof: 
should return false 
for invalid proof (156 
ms)
    ΓêÜ 
verifyClientProof: 
should reject a 
server-format proof 
(domain separation) 
(27 ms)
    ΓêÜ clientProof 
and serverProof should 
always differ for same 
inputs (22 ms)

  console.warn
    Using NodeJS below 20.19.0

    [0m [90m  7 |[39m [90m */[39m
     [90m  8 |[39m
    [31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mMongoMemoryServer[39m } [36mfrom[39m [32m'mongodb-memory-server'[39m[33m;[39m
     [90m    |[39m [31m[1m^[22m[39m
     [90m 10 |[39m [36mimport[39m mongoose [36mfrom[39m [32m'mongoose'[39m[33m;[39m
     [90m 11 |[39m
     [90m 12 |[39m [36mlet[39m mongoServer[33m:[39m [33mMongoMemoryServer[39m[33m;[39m[0m

      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/util/MongoInstance.ts:28:11)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/MongoMemoryServer.ts:16:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server-core/src/index.ts:2:1)
      at Object.<anonymous> (../node_modules/mongodb-memory-server/index.js:4:20)
      at Object.<anonymous> (jest.setup.ts:9:1)

  console.log
    [BreachService] ΓÜá∩╕Å BREACH DETECTED for email: breached@test.com (Hash Prefix: 785d3)

      at Object.checkEmailBreach (src/services/breachService.ts:30:21)

PASS __tests__/services
/breachService.test.ts
  BreachService 
Integration Test
    ΓêÜ should detect 
a breached email using 
actual privacy 
protocol logic (13 ms)
    ΓêÜ should return 
false for a safe email 
(3 ms)

Test Suites: 12 
passed, 12 total
Tests:       36 
passed, 36 total
Snapshots:   0 total
Time:        47.954 s, 
estimated 707 s
Ran all test suites.
Force exiting Jest: 
Have you considered 
using 
`--detectOpenHandles` 
to detect async 
operations that kept 
running after all 
tests finished?

`
</details>
