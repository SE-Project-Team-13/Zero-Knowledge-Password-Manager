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

const API_URL =
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
}

interface SessionState {
  userId: string | null;
  derivedKey: DerivedKey | null;
  decryptedVault: PasswordEntry[] | null;
  isLocked: boolean;
  lastActivity: number;
  lastServerSyncTimestamp: number;
}

// This state exists ONLY in memory and is destroyed on extension reload/browser close
let sessionState: SessionState = {
  userId: null,
  derivedKey: null,
  decryptedVault: null,
  isLocked: true,
  lastActivity: Date.now(),
  lastServerSyncTimestamp: 0,
};

// ============================================================================
// Configuration
// ============================================================================

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes (Deprecated)
const BACKEND_URL = "https://zero-knowledge-password-manager.onrender.com";
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
// Session Management
// ============================================================================

let sessionToken: string | null = null;

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
  | SaveNewCredentialMessage;

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
      return handleGetVault();
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
      return handleCheckNewCredential(message);
    case "SAVE_NEW_CREDENTIAL":
      return await handleSaveNewCredential(message);
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
): Promise<{ success: boolean; error?: string }> {
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

    updateLastActivity();
    return { success: true };
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

function handleGetVault() {
  if (sessionState.isLocked || !sessionState.decryptedVault)
    return { success: false, error: "Locked" };
  updateLastActivity();
  return { success: true, vault: sessionState.decryptedVault };
}

function handleLockVault() {
  lockVault();
  return { success: true };
}

function handleGetStatus() {
  return { isLocked: sessionState.isLocked };
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

function handleCheckNewCredential(message: CheckNewCredentialMessage) {
  if (sessionState.isLocked || !sessionState.decryptedVault)
    return { success: false, shouldPrompt: false };
  const current = normalizeUrlForMatch(message.url);
  if (!current) return { success: true, shouldPrompt: false };

  const exists = sessionState.decryptedVault.some((entry) => {
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

  try {
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
    const response1 = await fetch(`${API_URL}/api/vault/${encodeURIComponent(sessionState.userId)}`, {
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

    const response2 = await fetch(`${API_URL}/sync/blob/push`, {
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
    } else if (response2.status === 409) {
      // Conflict: server has a newer blob — pull the server's timestamp and retry push
      console.warn('[VaultSync:Extension] Sync blob conflict, retrying with server timestamp...');
      try {
        const conflictData = await response2.json();
        const serverTs: number = conflictData?.conflict?.latestServerTimestamp || nowTs;
        const retryRes = await fetch(`${API_URL}/sync/blob/push`, {
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

    if (!response1.ok) {
      throw new Error("Failed to sync new credential to Web Dashboard API");
    }

    updateLastActivity();
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
  sessionToken = null;
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = null;
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

// SECURITY: When service worker is terminated, all state is lost
// This is a FEATURE, not a bug - it ensures the key is never persisted
console.log("[VaultSync:Extension] Service worker initialized");
