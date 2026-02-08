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

import { deriveKey, encrypt, decrypt } from '@password-manager/crypto-engine'
import type { DerivedKey, VaultEntry, EncryptedVault } from '@password-manager/crypto-engine'

// ============================================================================
// SECURITY-CRITICAL: In-Memory State
// ============================================================================

// Local interface for extension's password entries
interface PasswordEntry {
  id: string
  siteName: string
  siteUrl: string
  username: string
  password: string
  notes?: string
  createdAt: string
  updatedAt: string
}

interface SessionState {
  userId: string | null
  derivedKey: DerivedKey | null
  decryptedVault: PasswordEntry[] | null
  isLocked: boolean
  lastActivity: number
}


// This state exists ONLY in memory and is destroyed on extension reload/browser close
let sessionState: SessionState = {
  userId: null,
  derivedKey: null,
  decryptedVault: null,
  isLocked: true,
  lastActivity: Date.now()
}

// ============================================================================
// Configuration
// ============================================================================

const AUTO_LOCK_TIMEOUT = 15 * 60 * 1000 // 15 minutes
const BACKEND_URL = 'http://localhost:3001'
const EXTENSION_DEVICE_ID = 'extension-browser'

// ============================================================================
// Auto-Lock Timer
// ============================================================================

let autoLockTimer: any = null

function resetAutoLockTimer(): void {
  if (autoLockTimer !== null) {
    clearTimeout(autoLockTimer)
  }

  autoLockTimer = setTimeout(() => {
    lockVault()
  }, AUTO_LOCK_TIMEOUT)
}

// ============================================================================
// Session Management
// ============================================================================

let sessionToken: string | null = null

// ============================================================================
// API Client Helpers
// ============================================================================

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, { ...options, headers })

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.statusText}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorData.error || errorMessage
    } catch (e) { }
    throw new Error(errorMessage)
  }

  return response.json()
}

// ============================================================================
// Message Handlers
// ============================================================================

interface UnlockVaultMessage {
  type: 'UNLOCK_VAULT'
  masterPassword: string
  userId: string
}

interface AddPasswordMessage {
  type: 'ADD_PASSWORD'
  entry: PasswordEntry
}

interface GetVaultMessage {
  type: 'GET_VAULT'
}

interface LockVaultMessage {
  type: 'LOCK_VAULT'
}

interface GetStatusMessage {
  type: 'GET_STATUS'
}

interface HeartbeatMessage {
  type: 'HEARTBEAT'
}

interface DeletePasswordMessage {
  type: 'DELETE_PASSWORD'
  entryId: string
}

interface UpdatePasswordMessage {
  type: 'UPDATE_PASSWORD'
  entry: PasswordEntry
}

interface RegisterUserMessage {
  type: 'REGISTER_USER'
  email: string
  masterPassword: string
}

interface RequestAutofillMessage {
  type: 'REQUEST_AUTOFILL'
  url: string
}

interface CheckUrlMatchMessage {
  type: 'CHECK_URL_MATCH'
  url: string
}

type BackgroundMessage =
  | UnlockVaultMessage
  | AddPasswordMessage
  | GetVaultMessage
  | LockVaultMessage
  | GetStatusMessage
  | HeartbeatMessage
  | DeletePasswordMessage
  | UpdatePasswordMessage
  | RegisterUserMessage
  | RequestAutofillMessage
  | CheckUrlMatchMessage

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type)

  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Background] Error handling message:', error)
      sendResponse({ success: false, error: error.message })
    })

  return true
})

async function handleMessage(message: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<any> {
  switch (message.type) {
    case 'UNLOCK_VAULT':
      return await handleUnlockVault(message)
    case 'ADD_PASSWORD':
      return await handleAddPassword(message)
    case 'DELETE_PASSWORD':
      return await handleDeletePassword(message)
    case 'UPDATE_PASSWORD':
      return await handleUpdatePassword(message)
    case 'GET_VAULT':
      return handleGetVault()
    case 'LOCK_VAULT':
      return handleLockVault()
    case 'GET_STATUS':
      return handleGetStatus()
    case 'HEARTBEAT':
      updateLastActivity()
      return { success: true }
    case 'REGISTER_USER':
      return await handleRegisterUser(message)
    case 'REQUEST_AUTOFILL':
      return handleRequestAutofill(message)
    case 'CHECK_URL_MATCH':
      return handleCheckUrlMatch(message)
    default:
      return { success: false, error: 'Unknown message type' }
  }
}

function updateLastActivity() {
  sessionState.lastActivity = Date.now()
  resetAutoLockTimer()
}

// ============================================================================
// Unlock Vault Handler
// ============================================================================

async function handleUnlockVault(message: UnlockVaultMessage): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Background] Unlocking vault for user:', message.userId)
    const email = message.userId

    // Step 1: Get user salt from backend
    const { salt: saltHex } = await apiRequest<{ salt: string }>(`/auth/salt/${encodeURIComponent(email)}`)
    const saltBuffer = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))

    // Step 2: Derive keys
    // SECURITY NOTE: Dashboard currently uses email as salt for vault encryption in prototype
    // For compatibility, we'll try to decrypt with the real password first, then fallback to email
    // if decryption fails, as the dashboard currently has this "feature".
    let derivedKeys = await deriveKey(message.masterPassword, saltBuffer)

    // Step 3: Login to get session token
    // Match dashboard's SHA-256(verifier + challenge) logic
    const encoder = new TextEncoder()
    const proofData = encoder.encode("auth-proof")
    const verifierBuffer = await crypto.subtle.sign("HMAC", derivedKeys.authKey, proofData)
    const verifierHex = Array.from(new Uint8Array(verifierBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    const challengeBuffer = crypto.getRandomValues(new Uint8Array(16))
    const challengeHex = Array.from(challengeBuffer).map(b => b.toString(16).padStart(2, '0')).join('')

    const combined = encoder.encode(verifierHex + challengeHex)
    const clientProofBuffer = await crypto.subtle.digest("SHA-256", combined)
    const clientProof = Array.from(new Uint8Array(clientProofBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    const authResponse = await apiRequest<{ sessionToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        challenge: challengeHex,
        clientProof
      })
    })

    sessionToken = authResponse.sessionToken

    // Step 4: Pull vault
    // Using simple vault endpoint for broad compatibility
    const data = await apiRequest<any>(`/api/vault/${encodeURIComponent(email)}`)

    let decryptedVault: PasswordEntry[] = []

    if (data && data.ciphertext) {
      const encryptedVault: EncryptedVault = {
        ciphertext: data.ciphertext,
        iv: data.iv,
        salt: data.salt,
        algorithm: 'AES-256-GCM',
        derivationAlgorithm: 'Argon2id'
      }

      try {
        const decryptedRoot = await decrypt(encryptedVault, derivedKeys)
        decryptedVault = JSON.parse(decryptedRoot.password)
      } catch (e) {
        console.warn('[Background] Decryption with master password failed, trying email-key fallback (Dashboard compatibility)')
        // Fallback to email as password (compatibility with Dashboard's current prototype state)
        const fallbackKeys = await deriveKey(email, saltBuffer)
        const decryptedRoot = await decrypt(encryptedVault, fallbackKeys)
        decryptedVault = JSON.parse(decryptedRoot.password)
        // Switch to fallback keys for this session
        derivedKeys = fallbackKeys
      }
    }

    sessionState.userId = email
    sessionState.derivedKey = derivedKeys
    sessionState.decryptedVault = decryptedVault
    sessionState.isLocked = false

    updateLastActivity()
    return { success: true }

  } catch (error: any) {
    console.error('[Background] Failed to unlock vault:', error)
    lockVault()
    return { success: false, error: error.message || 'Failed to unlock vault' }
  }
}

// ============================================================================
// Register User Handler
// ============================================================================

async function handleRegisterUser(message: RegisterUserMessage): Promise<{ success: boolean; error?: string }> {
  try {
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16))
    const derivedKeys = await deriveKey(message.masterPassword, saltBuffer)
    const saltHex = Array.from(saltBuffer).map(b => b.toString(16).padStart(2, '0')).join('')

    const encoder = new TextEncoder()
    const verifierBuffer = await crypto.subtle.sign("HMAC", derivedKeys.authKey, encoder.encode("auth-proof"))
    const verifierHex = Array.from(new Uint8Array(verifierBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: message.email,
        salt: saltHex,
        verifier: verifierHex
      })
    })

    return await handleUnlockVault({
      type: 'UNLOCK_VAULT',
      masterPassword: message.masterPassword,
      userId: message.email
    })
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ============================================================================
// Handlers
// ============================================================================

async function handleAddPassword(message: AddPasswordMessage): Promise<{ success: boolean; error?: string }> {
  if (sessionState.isLocked || !sessionState.decryptedVault) return { success: false, error: 'Locked' }
  try {
    sessionState.decryptedVault.push(message.entry)
    await syncVaultToBackend()
    updateLastActivity()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handleDeletePassword(message: DeletePasswordMessage): Promise<{ success: boolean; error?: string }> {
  if (sessionState.isLocked || !sessionState.decryptedVault) return { success: false, error: 'Locked' }
  try {
    sessionState.decryptedVault = sessionState.decryptedVault.filter(e => e.id !== message.entryId)
    await syncVaultToBackend()
    updateLastActivity()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function handleUpdatePassword(message: UpdatePasswordMessage): Promise<{ success: boolean; error?: string }> {
  if (sessionState.isLocked || !sessionState.decryptedVault) return { success: false, error: 'Locked' }
  try {
    const idx = sessionState.decryptedVault.findIndex(e => e.id === message.entry.id)
    if (idx !== -1) {
      sessionState.decryptedVault[idx] = { ...message.entry, updatedAt: new Date().toISOString() }
      await syncVaultToBackend()
      updateLastActivity()
      return { success: true }
    }
    return { success: false, error: 'Not found' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

function handleGetVault() {
  if (sessionState.isLocked || !sessionState.decryptedVault) return { success: false, error: 'Locked' }
  updateLastActivity()
  return { success: true, vault: sessionState.decryptedVault }
}

function handleLockVault() {
  lockVault()
  return { success: true }
}

function handleGetStatus() {
  return { isLocked: sessionState.isLocked }
}

function normalizeUrlForMatch(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    const port = url.port ? `:${url.port}` : ''
    let path = url.pathname || '/'
    if (path.length > 1) {
      path = path.replace(/\/+$/, '')
    }
    return `${url.protocol}//${host}${port}${path}`
  } catch {
    return null
  }
}

function normalizeEntryUrl(rawUrl: string): string | null {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return normalizeUrlForMatch(withScheme)
}

function findMatchingEntry(currentUrl: string): PasswordEntry | null {
  if (sessionState.isLocked || !sessionState.decryptedVault) return null
  const current = normalizeUrlForMatch(currentUrl)
  if (!current) return null

  for (const entry of sessionState.decryptedVault) {
    const entryUrl = normalizeEntryUrl(entry.siteUrl)
    if (entryUrl && entryUrl === current) {
      return entry
    }
  }

  return null
}

function handleRequestAutofill(message: RequestAutofillMessage) {
  const entry = findMatchingEntry(message.url)
  if (!entry) {
    return { success: false, match: false, error: 'No matching entry for this URL' }
  }
  updateLastActivity()
  return { success: true, match: true, entry }
}

function handleCheckUrlMatch(message: CheckUrlMatchMessage) {
  const entry = findMatchingEntry(message.url)
  const currentNormalized = normalizeUrlForMatch(message.url)
  const sampleEntries: string[] = []
  if (sessionState.decryptedVault) {
    for (const vaultEntry of sessionState.decryptedVault) {
      if (sampleEntries.length >= 5) break
      const normalized = normalizeEntryUrl(vaultEntry.siteUrl)
      if (normalized) sampleEntries.push(normalized)
    }
  }
  return {
    success: true,
    match: Boolean(entry),
    currentNormalized,
    sampleEntries
  }
}

async function syncVaultToBackend(): Promise<void> {
  if (!sessionState.userId || !sessionState.derivedKey || !sessionState.decryptedVault) throw new Error('State error')

  // Prepare the vault entry wrapper exactly like the dashboard
  const vaultEntry = {
    site: 'VAULT_ROOT',
    username: 'SYSTEM',
    password: JSON.stringify(sessionState.decryptedVault)
  }

  // Encrypt the vault data
  const encryptedVault = await encrypt(vaultEntry, sessionState.derivedKey)

  // Generate labels for search (matching dashboard logic)
  const labels = sessionState.decryptedVault.map(e => e.siteName.toLowerCase())

  // Send to the simple vault endpoint (same as dashboard)
  await apiRequest(`/api/vault/${encodeURIComponent(sessionState.userId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      encryptedVault,
      labels
    })
  })
}

function lockVault(): void {
  sessionState.userId = null
  sessionState.derivedKey = null
  sessionState.decryptedVault = null
  sessionState.isLocked = true
  sessionToken = null
  if (autoLockTimer) clearTimeout(autoLockTimer)
  autoLockTimer = null
  chrome.runtime.sendMessage({ type: 'VAULT_LOCKED' }).catch(() => { })
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
  return buffer
}

// ============================================================================
// Extension Lifecycle
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed')
})

chrome.runtime.onStartup.addListener(() => {
  console.log('[Background] Browser started - vault is locked by default')
})

// SECURITY: When service worker is terminated, all state is lost
// This is a FEATURE, not a bug - it ensures the key is never persisted
console.log('[Background] Service worker initialized - vault is locked')
