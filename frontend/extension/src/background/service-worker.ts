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
  generateVerifier,
  generateClientProof,
  generateChallenge
} from '@password-manager/crypto-engine'
import type { DerivedKey, EncryptedVault, DecryptResult } from '@password-manager/crypto-engine'

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
// ============================================================================
// Auto-Lock Timer
// ============================================================================

let autoLockTimer: ReturnType<typeof setTimeout> | null = null

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  }

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }

  const url = `${BACKEND_URL}${endpoint}`
  console.log(`[VaultSync:Extension] Fetching: ${url}`)
  const response = await fetch(url, { ...options, headers })

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

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  console.log('[VaultSync:Extension] Received message:', message.type)

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      console.error('[VaultSync:Extension] Error handling message:', error)
      sendResponse({ success: false, error: error.message })
    })

  return true
})

async function handleMessage(message: BackgroundMessage): Promise<unknown> {
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
    console.log('[VaultSync:Extension] Unlocking vault for user:', message.userId)
    const email = message.userId

    // Step 1: Get user salt from backend
    const { salt: saltHex, challenge: challengeHex, argon2Memory, argon2Iterations } = await apiRequest<{ salt: string, challenge: string, argon2Memory?: number, argon2Iterations?: number }>(`/auth/salt/${encodeURIComponent(email)}`)
    const saltChunks = saltHex.match(/.{1,2}/g)
    if (!saltChunks) {
      throw new Error('Invalid salt format returned by server')
    }
    const saltBuffer = new Uint8Array(saltChunks.map(byte => parseInt(byte, 16)))

    // Step 2: Derive keys
    // SECURITY NOTE: Dashboard currently uses email as salt for vault encryption in prototype
    // For compatibility, we'll try to decrypt with the real password first, then fallback to email
    // if decryption fails, as the dashboard currently has this "feature".
    const derivedKeys = await deriveKey(message.masterPassword, saltBuffer, {
      memorySize: argon2Memory || undefined,
      iterations: argon2Iterations || undefined
    })
    // Step 3: Login to get session token using ZKP auth utilities
    
    const verifierHex = await generateVerifier(derivedKeys.authKey)
    const clientProof = await generateClientProof(verifierHex, challengeHex)

    const authResponse = await apiRequest<{ sessionToken: string; userId: string }>('/auth/login', {
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
    const data = await apiRequest<{
      ciphertext?: string
      iv?: string
      salt?: string
      tag?: string
      authTag?: string
    }>(`/api/vault/${encodeURIComponent(authResponse.userId)}`)

    let decryptedVault: PasswordEntry[] = []

    if (data && data.ciphertext) {
      const encryptedVault: EncryptedVault = {
        ciphertext: data.ciphertext,
        iv: data.iv!,
        salt: data.salt!,
        tag: (data.tag || data.authTag)!, // Map both possible tag field names
        algorithm: 'AES-256-GCM',
        derivationAlgorithm: 'Argon2id'
      }


      try {
        console.log('[VaultSync:Extension] Attempting decryption...')
        const decryptResult = await decryptVault(message.masterPassword, encryptedVault)
        
        if (!decryptResult.success) {
          throw new Error(decryptResult.error)
        }
        
        decryptedVault = JSON.parse(decryptResult.data.password)
        console.log('[VaultSync:Extension] Decryption succeeded')
      } catch (e) {
        console.error('[VaultSync:Extension] Decryption with master password failed:', e)
        throw new Error('Vault decryption failed. Please ensure your password is correct.')
      }
    }

    sessionState.userId = authResponse.userId
    sessionState.derivedKey = derivedKeys
    sessionState.decryptedVault = decryptedVault
    sessionState.isLocked = false

    updateLastActivity()
    return { success: true }

  } catch (error) {
    console.error('[VaultSync:Extension] Failed to unlock vault:', error)
    lockVault()
    return { success: false, error: error instanceof Error ? error.message : 'Failed to unlock vault' }
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

    const verifierHex = await generateVerifier(derivedKeys.authKey)

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
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Registration failed' }
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
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add password' }
  }
}

async function handleDeletePassword(message: DeletePasswordMessage): Promise<{ success: boolean; error?: string }> {
  if (sessionState.isLocked || !sessionState.decryptedVault) return { success: false, error: 'Locked' }
  try {
    sessionState.decryptedVault = sessionState.decryptedVault.filter(e => e.id !== message.entryId)
    await syncVaultToBackend()
    updateLastActivity()
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete password' }
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
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update password' }
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
  console.log('[VaultSync:Extension] Extension installed')
})

chrome.runtime.onStartup.addListener(() => {
  console.log('[VaultSync:Extension] Browser started')
})

// SECURITY: When service worker is terminated, all state is lost
// This is a FEATURE, not a bug - it ensures the key is never persisted
console.log('[VaultSync:Extension] Service worker initialized')
