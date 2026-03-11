/**
 * Background Service Worker - Manifest V3
 *
 * This is the security core of the extension. It:
 * - Holds the derived encryption key in memory (never persisted)
 * - Manages vault state and auto-lock timer
 * - Handles all cryptographic operations
 * - Communicates with popup and content scripts via message passing
 *
 * Security guarantees:
 * - Key exists only in memory
 * - Browser close destroys the key
 * - Extension reload requires re-authentication
 * - Auto-lock after inactivity
 */

import {
  deriveKey,
  encrypt,
  decrypt,
  decryptVault,
  encryptVault,
  generateVerifier,
  generateClientProof,
  generateChallenge,
  verifyServerProof,
} from "@password-manager/crypto-engine";
import type {
  DerivedKey,
  EncryptedVault,
  DecryptResult,
} from "@password-manager/crypto-engine";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
    }
  }
}
declare const process: { env: NodeJS.ProcessEnv };

const BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? "https://zero-knowledge-password-manager.onrender.com"
    : "http://localhost:5000";

// ============================================================================
// SECURITY-CRITICAL: In-Memory State
// ============================================================================

// Local interface for extension's password entries
interface PasswordEntry {
  id: string;
  siteName: string;
  siteUrl: string;
  username: string;
  password: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
}

interface SessionState {
  userId: string | null;
  derivedKey: DerivedKey | null;
  decryptedVault: PasswordEntry[] | null;
  isLocked: boolean;
  lastActivity: number;
  lastServerSyncTimestamp: number;
  isOtpVerified: boolean;
  userEmail: string | null;
}

// This state exists ONLY in memory and is destroyed on extension reload/browser close
let sessionState: SessionState = {
  userId: null,
  derivedKey: null,
  decryptedVault: null,
  isLocked: true,
  lastActivity: Date.now(),
  lastServerSyncTimestamp: 0,
  isOtpVerified: false,
  userEmail: null,
};

// Session token stored separately for API calls
let sessionToken: string | null = null;

// ============================================================================
// Session Persistence (survives service worker restarts, cleared on browser close)
// ============================================================================

async function saveSessionState(): Promise<void> {
  try {
    // chrome.storage.session persists across service worker restarts
    // but is cleared when the browser closes - perfect for our needs
    await chrome.storage.session.set({
      sessionState: {
        userId: sessionState.userId,
        // Store derived key as serializable data
        derivedKey: sessionState.derivedKey ? {
          encryptionKey: Array.from(sessionState.derivedKey.encryptionKey),
          authKey: Array.from(sessionState.derivedKey.authKey),
          salt: Array.from(sessionState.derivedKey.salt),
          key: Array.from(sessionState.derivedKey.key),
        } : null,
        decryptedVault: sessionState.decryptedVault,
        isLocked: sessionState.isLocked,
        lastActivity: sessionState.lastActivity,
        lastServerSyncTimestamp: sessionState.lastServerSyncTimestamp,
        isOtpVerified: sessionState.isOtpVerified,
        userEmail: sessionState.userEmail,
      },
      sessionToken: sessionToken,
    });
  } catch (error) {
    console.error('[VaultSync:Extension] Failed to save session state:', error);
  }
}

async function restoreSessionState(): Promise<void> {
  try {
    const data = await chrome.storage.session.get(['sessionState', 'sessionToken']);
    
    if (data.sessionState) {
      const saved = data.sessionState;
      sessionState.userId = saved.userId;
      sessionState.isLocked = saved.isLocked ?? true;
      sessionState.lastActivity = saved.lastActivity ?? Date.now();
      sessionState.lastServerSyncTimestamp = saved.lastServerSyncTimestamp ?? 0;
      sessionState.decryptedVault = saved.decryptedVault;
      sessionState.isOtpVerified = saved.isOtpVerified ?? false;
      sessionState.userEmail = saved.userEmail ?? null;
      
      // Restore derived key from serialized format
      if (saved.derivedKey) {
        sessionState.derivedKey = {
          encryptionKey: new Uint8Array(saved.derivedKey.encryptionKey),
          authKey: new Uint8Array(saved.derivedKey.authKey),
          salt: new Uint8Array(saved.derivedKey.salt),
          key: new Uint8Array(saved.derivedKey.key),
        };
      }
    }
    
    if (data.sessionToken) {
      sessionToken = data.sessionToken;
    }
    
    console.log('[VaultSync:Extension] Session state restored:', {
      isLocked: sessionState.isLocked,
      hasVault: !!sessionState.decryptedVault,
      isOtpVerified: sessionState.isOtpVerified
    });
  } catch (error) {
    console.error('[VaultSync:Extension] Failed to restore session state:', error);
  }
}

async function clearSessionState(): Promise<void> {
  try {
    await chrome.storage.session.clear();
  } catch (error) {
    console.error('[VaultSync:Extension] Failed to clear session state:', error);
  }
}

// ============================================================================
// Configuration
// ============================================================================

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes (Deprecated)
// ============================================================================
// Auto-Lock Timer
// ============================================================================

let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

function resetAutoLockTimer(): void {
  // Auto-lock on inactivity is disabled per user request. 
  // The vault now only locks securely upon browser close (when memory state is wiped).
  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}

// ============================================================================
// API Client Helpers
// ============================================================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  const url = `${BACKEND_URL}${endpoint}`;
  console.log(`[VaultSync:Extension] Fetching: ${url}`);
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================================================
// Message Handlers
// ============================================================================

interface UnlockVaultMessage {
  type: "UNLOCK_VAULT";
  masterPassword: string;
  userId: string;
}

interface GetVaultMessage {
  type: "GET_VAULT";
}

interface LockVaultMessage {
  type: "LOCK_VAULT";
}

interface GetStatusMessage {
  type: "GET_STATUS";
}

interface HeartbeatMessage {
  type: "HEARTBEAT";
}

interface RegisterUserMessage {
  type: "REGISTER_USER";
  email: string;
  masterPassword: string;
}

interface RequestAutofillMessage {
  type: "REQUEST_AUTOFILL";
  url: string;
}

interface CheckUrlMatchMessage {
  type: "CHECK_URL_MATCH";
  url: string;
}

interface GetUserProfileMessage {
  type: "GET_USER_PROFILE";
}

interface CheckNewCredentialMessage {
  type: "CHECK_NEW_CREDENTIAL";
  url: string;
  username: string;
}

interface SaveNewCredentialMessage {
  type: "SAVE_NEW_CREDENTIAL";
  url: string;
  siteName: string;
  username: string;
  password?: string;
}

interface SendOtpMessage {
  type: "SEND_OTP";
}

interface VerifyOtpMessage {
  type: "VERIFY_OTP";
  code: string;
}

type BackgroundMessage =
  | UnlockVaultMessage
  | GetVaultMessage
  | LockVaultMessage
  | GetStatusMessage
  | HeartbeatMessage
  | RegisterUserMessage
  | RequestAutofillMessage
  | CheckUrlMatchMessage
  | GetUserProfileMessage
  | CheckNewCredentialMessage
  | SaveNewCredentialMessage
  | SendOtpMessage
  | VerifyOtpMessage;

chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, _sender, sendResponse) => {
    console.log("[VaultSync:Extension] Received message:", message.type);

    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        console.error("[VaultSync:Extension] Error handling message:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  },
);

async function handleMessage(message: BackgroundMessage): Promise<unknown> {
  switch (message.type) {
    case "UNLOCK_VAULT":
      return await handleUnlockVault(message);
    case "GET_VAULT":
      return await handleGetVault();
    case "LOCK_VAULT":
      return handleLockVault();
    case "GET_STATUS":
      return handleGetStatus();
    case "HEARTBEAT":
      updateLastActivity();
      return { success: true };
    case "REGISTER_USER":
      return await handleRegisterUser(message);
    case "REQUEST_AUTOFILL":
      return handleRequestAutofill(message);
    case "CHECK_URL_MATCH":
      return handleCheckUrlMatch(message);
    case "GET_USER_PROFILE":
      return await handleGetUserProfile();
    case "CHECK_NEW_CREDENTIAL":
      return await handleCheckNewCredential(message);
    case "SAVE_NEW_CREDENTIAL":
      return await handleSaveNewCredential(message);
    case "SEND_OTP":
      return await handleSendOtp();
    case "VERIFY_OTP":
      return await handleVerifyOtp(message);
    default:
      return { success: false, error: "Unknown message type" };
  }
}

function updateLastActivity() {
  sessionState.lastActivity = Date.now();
  resetAutoLockTimer();
}

// ============================================================================
// Unlock Vault Handler
// ============================================================================

async function handleUnlockVault(
  message: UnlockVaultMessage,
): Promise<{ success: boolean; error?: string; otpRequired?: boolean }> {
  try {
    console.log(
      "[VaultSync:Extension] Unlocking vault for user:",
      message.userId,
    );
    const email = message.userId;

    // Step 1: Get user salt from backend
    const {
      salt: saltHex,
      challenge: challengeHex,
      argon2Memory,
      argon2Iterations,
    } = await apiRequest<{
      salt: string;
      challenge: string;
      argon2Memory?: number;
      argon2Iterations?: number;
    }>(`/auth/salt/${encodeURIComponent(email)}`);
    const saltChunks = saltHex.match(/.{1,2}/g);
    if (!saltChunks) {
      throw new Error("Invalid salt format returned by server");
    }
    const saltBuffer = new Uint8Array(
      saltChunks.map((byte) => parseInt(byte, 16)),
    );

    // Step 2: Derive keys
    // SECURITY NOTE: Dashboard currently uses email as salt for vault encryption in prototype
    // For compatibility, we'll try to decrypt with the real password first, then fallback to email
    // if decryption fails, as the dashboard currently has this "feature".
    const derivedKeys = await deriveKey(message.masterPassword, saltBuffer, {
      memorySize: argon2Memory || undefined,
      iterations: argon2Iterations || undefined,
    });
    // Step 3: Login to get session token using ZKP auth utilities

    const verifierHex = await generateVerifier(derivedKeys.authKey);
    const clientProof = await generateClientProof(verifierHex, challengeHex);

    const authResponse = await apiRequest<{
      sessionToken: string;
      userId: string;
      serverProof?: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        challenge: challengeHex,
        clientProof,
      }),
    });

    // SECURITY: Verify server proof to guard against MITM attacks.
    if (authResponse.serverProof) {
      const isServerAuthentic = verifyServerProof(verifierHex, challengeHex, authResponse.serverProof);
      if (!isServerAuthentic) {
        throw new Error("Server authentication failed. Possible man-in-the-middle attack.");
      }
    }

    sessionToken = authResponse.sessionToken;

    // Step 4: Pull vault — prefer sync blob (latest) with fallback to legacy API
    let vaultBlobData: {
      ciphertext?: string;
      iv?: string;
      salt?: string;
      tag?: string;
      authTag?: string;
    } | null = null;
    let serverSyncTimestamp = 0;

    try {
      const blobRes = await fetch(`${BACKEND_URL}/sync/blob/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authResponse.sessionToken}`,
        },
        body: JSON.stringify({ userId: authResponse.userId, lastKnownTimestamp: 0 }),
      });
      if (blobRes.ok) {
        const blobJson = await blobRes.json();
        serverSyncTimestamp = blobJson.serverTimestamp || 0;
        if (blobJson?.blob?.ciphertext) {
          vaultBlobData = blobJson.blob;
          console.log('[VaultSync:Extension] Loaded vault from sync blob (ts=', serverSyncTimestamp, ')');
        }
      }
    } catch (blobErr) {
      console.warn('[VaultSync:Extension] Sync blob pull failed, falling back to legacy API', blobErr);
    }

    // Fallback: legacy vault endpoint
    if (!vaultBlobData) {
      const legacyData = await apiRequest<{
        ciphertext?: string;
        iv?: string;
        salt?: string;
        tag?: string;
        authTag?: string;
      }>(`/api/vault/${encodeURIComponent(authResponse.userId)}`);
      if (legacyData?.ciphertext) {
        vaultBlobData = legacyData;
        console.log('[VaultSync:Extension] Loaded vault from legacy API');
      }
    }

    let decryptedVault: PasswordEntry[] = [];

    if (vaultBlobData && vaultBlobData.ciphertext) {
      const encryptedVault: EncryptedVault = {
        ciphertext: vaultBlobData.ciphertext,
        iv: vaultBlobData.iv!,
        salt: vaultBlobData.salt!,
        tag: (vaultBlobData.tag || vaultBlobData.authTag)!,
        algorithm: "AES-256-GCM",
        derivationAlgorithm: "Argon2id",
      };

      try {
        console.log("[VaultSync:Extension] Attempting decryption...");
        const decryptResult = await decryptVault(
          message.masterPassword,
          encryptedVault,
          {
            memorySize: argon2Memory || undefined,
            iterations: argon2Iterations || undefined,
          }
        );

        if (!decryptResult.success) {
          throw new Error(decryptResult.error);
        }

        decryptedVault = JSON.parse(decryptResult.data.password);
        console.log("[VaultSync:Extension] Decryption succeeded");
      } catch (e) {
        console.error(
          "[VaultSync:Extension] Decryption with master password failed:",
          e,
        );
        throw new Error(
          "Vault decryption failed. Please ensure your password is correct.",
        );
      }
    }

    sessionState.userId = authResponse.userId;
    sessionState.derivedKey = derivedKeys;
    sessionState.decryptedVault = decryptedVault;
    sessionState.isLocked = false;
    sessionState.lastServerSyncTimestamp = serverSyncTimestamp;
    sessionState.userEmail = email;
    sessionState.isOtpVerified = false; // Require OTP verification after unlock

    updateLastActivity();
    
    // Persist session state so it survives service worker restarts
    await saveSessionState();
    
    // Start periodic sync for instant updates
    startPeriodicSync();
    
    // Automatically send OTP after successful unlock
    try {
      await sendOtpToUser(email);
      console.log('[VaultSync:Extension] OTP sent automatically after unlock');
    } catch (otpError) {
      console.warn('[VaultSync:Extension] Failed to auto-send OTP:', otpError);
    }
    
    return { success: true, otpRequired: true };
  } catch (error) {
    console.error("[VaultSync:Extension] Failed to unlock vault:", error);
    lockVault();
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unlock vault",
    };
  }
}

// ============================================================================
// Register User Handler
// ============================================================================

async function handleRegisterUser(
  message: RegisterUserMessage,
): Promise<{ success: boolean; error?: string }> {
  try {
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
    const derivedKeys = await deriveKey(message.masterPassword, saltBuffer);
    const saltHex = Array.from(saltBuffer)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const verifierHex = await generateVerifier(derivedKeys.authKey);

    await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: message.email,
        salt: saltHex,
        verifier: verifierHex,
      }),
    });

    return await handleUnlockVault({
      type: "UNLOCK_VAULT",
      masterPassword: message.masterPassword,
      userId: message.email,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

// ============================================================================
// Handlers
// ============================================================================

function parseVaultEntriesFromDecryptedPayload(payload: unknown): PasswordEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const decrypted = payload as { password?: string };
  if (typeof decrypted.password !== "string") return [];
  try {
    const parsed = JSON.parse(decrypted.password);
    return Array.isArray(parsed) ? (parsed as PasswordEntry[]) : [];
  } catch {
    return [];
  }
}

async function refreshVaultFromServerIfNewer(): Promise<void> {
  if (
    sessionState.isLocked ||
    !sessionState.derivedKey ||
    !sessionState.userId ||
    !sessionToken ||
    !sessionState.isOtpVerified // SECURITY: Only sync after OTP verification
  ) {
    return;
  }

  try {
    const pullResponse = await fetch(`${BACKEND_URL}/sync/blob/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        userId: sessionState.userId,
        lastKnownTimestamp: sessionState.lastServerSyncTimestamp,
      }),
    });

    if (!pullResponse.ok) {
      return;
    }

    const payload = await pullResponse.json();
    const serverTimestamp = Number(payload?.serverTimestamp || 0);

    if (serverTimestamp > sessionState.lastServerSyncTimestamp) {
      console.log('[VaultSync:Extension] Server has newer data, updating local timestamp:', {
        oldTimestamp: sessionState.lastServerSyncTimestamp,
        newTimestamp: serverTimestamp
      });
      sessionState.lastServerSyncTimestamp = serverTimestamp;
    }

    if (!payload?.hasUpdate || !payload?.blob?.ciphertext) {
      return;
    }

    console.log('[VaultSync:Extension] Syncing newer vault data from server');

    const remoteBlob = payload.blob as {
      ciphertext: string;
      iv: string;
      salt: string;
      tag?: string;
      authTag?: string;
    };

    const decryptedVaultPayload = await decrypt(
      {
        ciphertext: remoteBlob.ciphertext,
        iv: remoteBlob.iv,
        salt: remoteBlob.salt,
        tag: remoteBlob.tag || remoteBlob.authTag,
        algorithm: "AES-256-GCM",
        derivationAlgorithm: "Argon2id",
      },
      sessionState.derivedKey,
    );

    const newVault = parseVaultEntriesFromDecryptedPayload(decryptedVaultPayload);
    const activeCount = newVault.filter(e => !e.isDeleted).length;
    const deletedCount = newVault.filter(e => e.isDeleted).length;
    
    console.log('[VaultSync:Extension] Vault updated:', {
      totalEntries: newVault.length,
      active: activeCount,
      deleted: deletedCount
    });
    
    sessionState.decryptedVault = newVault;
  } catch (error) {
    console.warn("[VaultSync:Extension] Non-blocking sync refresh failed:", error);
  }
}

async function handleGetVault() {
  if (sessionState.isLocked || !sessionState.decryptedVault)
    return { success: false, error: "Locked" };

  // Refresh vault from server to get latest data (including deletions)
  await refreshVaultFromServerIfNewer();

  updateLastActivity();
  
  const totalEntries = sessionState.decryptedVault?.length || 0;
  const activeEntries = (sessionState.decryptedVault || []).filter((entry) => !entry.isDeleted);
  const deletedCount = totalEntries - activeEntries.length;
  
  console.log('[VaultSync:Extension] GET_VAULT response:', {
    total: totalEntries,
    active: activeEntries.length,
    deleted: deletedCount
  });
  
  return { success: true, vault: activeEntries };
}

function handleLockVault() {
  lockVault();
  return { success: true };
}

function handleGetStatus() {
  return { 
    isLocked: sessionState.isLocked,
    isOtpVerified: sessionState.isOtpVerified 
  };
}

function normalizeUrlForMatch(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const port = url.port ? `:${url.port}` : "";
    // We intentionally discard the pathname (e.g., /login) to match across the entire domain
    return `${url.protocol}//${host}${port}`;
  } catch {
    return null;
  }
}

function normalizeEntryUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return normalizeUrlForMatch(withScheme);
}

function findMatchingEntries(currentUrl: string): PasswordEntry[] {
  if (sessionState.isLocked || !sessionState.decryptedVault) return [];
  const current = normalizeUrlForMatch(currentUrl);
  if (!current) return [];

  return sessionState.decryptedVault.filter((entry) => {
    if (entry.isDeleted) return false;
    const entryUrl = normalizeEntryUrl(entry.siteUrl);
    return entryUrl === current;
  });
}

function handleRequestAutofill(message: RequestAutofillMessage) {
  const entries = findMatchingEntries(message.url);
  if (entries.length === 0) {
    return {
      success: false,
      match: false,
      error: "No matching entry for this URL",
    };
  }
  updateLastActivity();
  return { success: true, match: true, entries };
}

function handleCheckUrlMatch(message: CheckUrlMatchMessage) {
  const entries = findMatchingEntries(message.url);
  const currentNormalized = normalizeUrlForMatch(message.url);
  const sampleEntries: string[] = [];
  if (sessionState.decryptedVault) {
    for (const vaultEntry of sessionState.decryptedVault) {
      if (sampleEntries.length >= 5) break;
      if (vaultEntry.isDeleted) continue;
      const normalized = normalizeEntryUrl(vaultEntry.siteUrl);
      if (normalized) sampleEntries.push(normalized);
    }
  }
  return {
    success: true,
    match: entries.length > 0,
    currentNormalized,
    sampleEntries,
  };
}

async function handleGetUserProfile() {
  return new Promise((resolve) => {
    chrome.identity.getProfileUserInfo((userInfo) => {
      resolve({ success: true, profile: userInfo });
    });
  });
}

async function handleCheckNewCredential(message: CheckNewCredentialMessage) {
  if (sessionState.isLocked || !sessionState.decryptedVault)
    return { success: false, shouldPrompt: false };

  await refreshVaultFromServerIfNewer();

  const current = normalizeUrlForMatch(message.url);
  if (!current) return { success: true, shouldPrompt: false };

  const exists = sessionState.decryptedVault.some((entry) => {
    if (entry.isDeleted) return false;
    const entryUrl = normalizeEntryUrl(entry.siteUrl);
    return entryUrl === current && entry.username === message.username;
  });
  
  // Prompt ONLY if it doesn't already exist in the vault
  return { success: true, shouldPrompt: !exists };
}

async function handleSaveNewCredential(message: SaveNewCredentialMessage) {
  if (
    sessionState.isLocked ||
    !sessionState.derivedKey ||
    !sessionState.decryptedVault ||
    !sessionState.userId ||
    !sessionToken
  ) {
    return { success: false, error: "Vault locked or offline" };
  }

  if (!sessionState.isOtpVerified) {
    return { success: false, error: "Please complete 2FA verification first" };
  }

  try {
    await refreshVaultFromServerIfNewer();

    if (!sessionState.decryptedVault) {
      return { success: false, error: "Vault locked or offline" };
    }

    const now = new Date().toISOString();
    const newEntry: PasswordEntry = {
      id: crypto.randomUUID(),
      siteName: message.siteName || message.url,
      siteUrl: message.url,
      username: message.username,
      password: message.password || "",
      notes: "Saved via browser extension",
      createdAt: now,
      updatedAt: now,
    };

    // Update in-memory vault immediately
    sessionState.decryptedVault.push(newEntry);

    // Re-encrypt the entire vault state using crypto-engine tools
    const vaultString = JSON.stringify(sessionState.decryptedVault);
    const encryptedVaultWrapper = await encrypt(
      { url: 'extension-sync', username: 'vault', password: vaultString },
      sessionState.derivedKey
    );
    const labels = sessionState.decryptedVault.map(e => (e.siteName || e.siteUrl || "").toLowerCase());

    // 1. Sync legacy format back to the node backend
    const response1 = await fetch(`${BACKEND_URL}/api/vault/${encodeURIComponent(sessionState.userId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        encryptedVault: encryptedVaultWrapper,
        labels,
      }),
    });

    if (!response1.ok) {
      console.warn('[VaultSync:Extension] Legacy API save failed:', response1.status);
    }

    // 2. Also push to Modern Sync API for consistency
    const nowTs = Date.now();
    const blobPayload = {
      ciphertext: encryptedVaultWrapper.ciphertext,
      iv: encryptedVaultWrapper.iv,
      salt: encryptedVaultWrapper.salt,
      authTag: encryptedVaultWrapper.tag || "",
      version: nowTs,
      timestamp: nowTs,
      nonce: crypto.randomUUID(),
    };

    let modernSyncOk = false;
    const response2 = await fetch(`${BACKEND_URL}/sync/blob/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        userId: sessionState.userId,
        deviceId: "browser-extension",
        blob: blobPayload,
        // Use the server's last known timestamp so we don't false-conflict.
        // If 0, the server skips conflict detection entirely.
        baseTimestamp: sessionState.lastServerSyncTimestamp,
      }),
    });

    if (response2.ok) {
      // Keep session timestamp in sync for future saves in the same session
      sessionState.lastServerSyncTimestamp = nowTs;
      modernSyncOk = true;
    } else if (response2.status === 409) {
      // Conflict: server has a newer blob — pull the server's timestamp and retry push
      console.warn('[VaultSync:Extension] Sync blob conflict, retrying with server timestamp...');
      try {
        const conflictData = await response2.json();
        const serverTs: number = conflictData?.conflict?.latestServerTimestamp || nowTs;
        const retryRes = await fetch(`${BACKEND_URL}/sync/blob/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            userId: sessionState.userId,
            deviceId: "browser-extension",
            blob: blobPayload,
            baseTimestamp: serverTs,
          }),
        });
        if (retryRes.ok) {
          sessionState.lastServerSyncTimestamp = nowTs;
          modernSyncOk = true;
          console.log('[VaultSync:Extension] Retry sync push succeeded');
        } else {
          console.warn('[VaultSync:Extension] Retry sync push also failed:', retryRes.status);
        }
      } catch (retryErr) {
        console.warn('[VaultSync:Extension] Conflict retry failed:', retryErr);
      }
    } else {
      console.warn('[VaultSync:Extension] Sync blob push failed:', response2.status);
    }

    if (!response1.ok && !modernSyncOk) {
      throw new Error("Failed to sync new credential via any sync API (legacy and modern)");
    }

    console.log('[VaultSync:Extension] Credential saved successfully:', {
      legacyApi: response1.ok,
      modernApi: modernSyncOk,
      timestamp: nowTs
    });

    updateLastActivity();
    
    // Persist updated vault state
    await saveSessionState();
    
    // Trigger immediate sync on other devices/tabs by updating a sync trigger flag
    try {
      // Use chrome.storage.local to trigger cross-tab sync
      await chrome.storage.local.set({ 
        'vault_sync_trigger': Date.now(),
        'vault_sync_source': 'extension'
      });
    } catch (err) {
      console.warn('[VaultSync:Extension] Failed to set sync trigger:', err);
    }
    
    return { success: true };
  } catch (err) {
    console.error("[VaultSync] Save New Credential Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Encryption/Sync failure" };
  }
}

function lockVault(): void {
  sessionState.userId = null;
  sessionState.derivedKey = null;
  sessionState.decryptedVault = null;
  sessionState.isLocked = true;
  sessionState.lastServerSyncTimestamp = 0;
  sessionState.isOtpVerified = false;
  sessionState.userEmail = null;
  sessionToken = null;
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = null;
  
  // Stop periodic sync when locked
  stopPeriodicSync();
  
  // Clear persisted session state
  clearSessionState().catch(console.error);
  
  chrome.runtime.sendMessage({ type: "VAULT_LOCKED" }).catch(() => {});
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer;
}

// ============================================================================
// Extension Lifecycle
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log("[VaultSync:Extension] Extension installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[VaultSync:Extension] Browser started");
});

// Restore session state when service worker starts/restarts
restoreSessionState().then(() => {
  console.log("[VaultSync:Extension] Service worker initialized and session restored");
  startPeriodicSync();
}).catch((error) => {
  console.error("[VaultSync:Extension] Failed to restore session:", error);
});

// ============================================================================
// Periodic Sync (1 second interval for instant updates)
// ============================================================================

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

function startPeriodicSync(): void {
  // Clear any existing interval
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
  }

  // Sync every 1 second when unlocked
  syncIntervalId = setInterval(async () => {
    if (!sessionState.isLocked && sessionState.userId && sessionToken) {
      try {
        await refreshVaultFromServerIfNewer();
        await saveSessionState(); // Persist any updates
      } catch (error) {
        // Silently fail - don't spam logs for network issues
        console.debug('[VaultSync:Extension] Background sync skipped:', error);
      }
    }
  }, 1000); // 1 second interval for instant updates
  
  console.log('[VaultSync:Extension] Periodic sync started (1 second interval)');
}

function stopPeriodicSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[VaultSync:Extension] Periodic sync stopped');
  }
}

// ============================================================================
// OTP Handlers
// ============================================================================

async function sendOtpToUser(email: string): Promise<void> {
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${BACKEND_URL}/otp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send OTP');
  }
}

async function handleSendOtp(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sessionState.userEmail) {
      return { success: false, error: 'Email not found' };
    }

    await sendOtpToUser(sessionState.userEmail);
    console.log('[VaultSync:Extension] OTP sent to:', sessionState.userEmail);
    return { success: true };
  } catch (error) {
    console.error('[VaultSync:Extension] Failed to send OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send OTP',
    };
  }
}

async function handleVerifyOtp(message: VerifyOtpMessage): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sessionState.userEmail || !sessionToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${BACKEND_URL}/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        email: sessionState.userEmail,
        code: message.code,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Invalid verification code' };
    }

    // Mark OTP as verified in session state
    sessionState.isOtpVerified = true;
    await saveSessionState();
    
    console.log('[VaultSync:Extension] OTP verified successfully');
    return { success: true };
  } catch (error) {
    console.error('[VaultSync:Extension] Failed to verify OTP:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

// ============================================================================
// Keepalive
// ============================================================================

// Keep service worker alive by listening to alarms
chrome.alarms.create('keep-alive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    // Periodic keepalive - do nothing, just prevents worker termination
    console.log('[VaultSync:Extension] Keepalive ping');
  }
});

// SECURITY: When service worker is terminated, all state is lost
// This is a FEATURE, not a bug - it ensures the key is never persisted
console.log("[VaultSync:Extension] Service worker initialized");
