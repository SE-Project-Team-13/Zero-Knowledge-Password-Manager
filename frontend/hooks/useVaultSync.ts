"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { apiClient, type VaultEntry, type SyncPayload } from "@/lib/api-client"
import { v4 as uuidv4 } from "uuid"
import { deriveKey, generateVerifier, generateClientProof, generateChallenge } from "@password-manager/crypto-engine"

export interface UseVaultSyncState {
  userId: string | null
  email: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastSyncTime: number | null
  version: number
  vaults: VaultEntry[]
  salt: string | null
  fullName: string | null
  isBreached?: boolean
  lastBreachCheck?: string
}

export interface UseVaultSyncActions {
  register: (email: string, fullName: string, masterPassword: string) => Promise<void>
  login: (email: string, masterPassword: string) => Promise<void>
  logout: () => void
  encryptAndSync: (entries: VaultEntry[]) => Promise<void>
  pullAndDecrypt: () => Promise<VaultEntry[]>
  resolveBreach: () => Promise<void>
}

export function useVaultSync(): [UseVaultSyncState, UseVaultSyncActions] {
  const parseHexToUint8Array = (hex: string): Uint8Array => {
    const matches = hex.match(/.{1,2}/g)
    if (!matches) {
      throw new Error("Invalid salt format from server")
    }
    return new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
  }

  const [state, setState] = useState<UseVaultSyncState>({
    userId: null,
    email: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    lastSyncTime: null,
    version: 0,
    vaults: [],
    salt: null,
    fullName: null,
    isBreached: false,
    lastBreachCheck: undefined,
  })

  const deviceIdRef = useRef<string>("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("device_id")
      if (stored) {
        deviceIdRef.current = stored
      } else {
        const newId = uuidv4()
        localStorage.setItem("device_id", newId)
        deviceIdRef.current = newId
      }

      // Restore authentication state from localStorage
      const storedSalt = localStorage.getItem("user_salt")
      const storedUserId = localStorage.getItem("user_id")
      const storedEmail = localStorage.getItem("user_email")
      const storedFullName = localStorage.getItem("user_fullname")
      const storedToken = localStorage.getItem("auth_token")
      const storedIsBreached = localStorage.getItem("user_is_breached") === "true"

      if (storedSalt && storedUserId && storedToken && storedEmail) {
        // Restore session token to API client
        apiClient.setToken(storedToken)

        setState(prev => ({
          ...prev,
          salt: storedSalt,
          userId: storedUserId,
          email: storedEmail,
          fullName: storedFullName,
          isAuthenticated: true,
          isBreached: storedIsBreached,
        }))
      }
    }
  }, [])

  const register = useCallback(async (email: string, fullName: string, masterPassword: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      // Generate random salt on client (16 bytes = 128 bits)
      const saltBuffer = crypto.getRandomValues(new Uint8Array(16))
      const salt = Array.from(saltBuffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

      // Derive keys using Argon2id
      const { authKey } = await deriveKey(masterPassword, saltBuffer)

      // Create proof using shared utility
      const proofHex = await generateVerifier(authKey)

      // Register with server
      const response = await apiClient.register(email, fullName, proofHex, salt)

      apiClient.setToken(response.sessionToken)
      localStorage.setItem("user_salt", salt)
      localStorage.setItem("user_id", response.userId)
      localStorage.setItem("user_email", email)
      localStorage.setItem("user_fullname", fullName)
      setState((prev) => ({
        ...prev,
        userId: response.userId,
        email: email,
        fullName: fullName,
        isAuthenticated: true,
        isLoading: false,
        salt: salt,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed"
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
      throw err
    }
  }, [])

  const login = useCallback(async (email: string, masterPassword: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      // 1. Get salt from server
      const { salt } = await apiClient.getSalt(email)

      // Convert salt hex to buffer
      const saltBuffer = parseHexToUint8Array(salt)

      // 2. Derive keys using Argon2id (same as during registration)
      const { authKey } = await deriveKey(masterPassword, saltBuffer)

      // 3. Re-compute verifier using shared utility
      const verifier = await generateVerifier(authKey)

      // 4. Generate random challenge using shared utility
      const challenge = generateChallenge()

      // 5. Compute client proof using shared utility
      const clientProof = await generateClientProof(verifier, challenge)

      // 6. Send login request
      const response = await apiClient.login(email, challenge, clientProof)

      apiClient.setToken(response.sessionToken)
      localStorage.setItem("user_salt", salt)
      localStorage.setItem("user_id", response.userId)
      localStorage.setItem("user_email", email)
      localStorage.setItem("user_fullname", response.fullName || "")
      if (response.isBreached) {
        localStorage.setItem("user_is_breached", "true")
      } else {
        localStorage.removeItem("user_is_breached")
      }
      setState((prev) => ({
        ...prev,
        userId: response.userId,
        email: email,
        fullName: response.fullName || null,
        isAuthenticated: true,
        isLoading: false,
        salt: salt,
        isBreached: response.isBreached,
        lastBreachCheck: response.lastBreachCheck,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed"
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    apiClient.clearToken()
    localStorage.removeItem("user_salt")
    localStorage.removeItem("user_id")
    localStorage.removeItem("user_email")
    localStorage.removeItem("user_fullname")
    sessionStorage.removeItem("otp_verified")
    sessionStorage.removeItem("session_master_password")
    localStorage.removeItem("user_is_breached")
    setState({
      userId: null,
      email: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastSyncTime: null,
      version: 0,
      vaults: [],
      salt: null,
      fullName: null,
      isBreached: false,
      lastBreachCheck: undefined,
    })
  }, [])

  const encryptAndSync = useCallback(
    async (entries: VaultEntry[]) => {
      if (!state.isAuthenticated) throw new Error("Not authenticated")

      setState((prev) => ({ ...prev, isLoading: true, error: null }))
      try {
        // This is a placeholder - actual encryption happens in the component
        // using the crypto-engine directly with the master password
        const payload: SyncPayload = {
          ciphertext: "", // Set by caller after encryption
          iv: "",
          salt: "",
          tag: "",
          deviceId: deviceIdRef.current,
          version: state.version + 1,
        }

        const response = await apiClient.pushVault(payload)

        setState((prev) => ({
          ...prev,
          lastSyncTime: Date.now(),
          version: response.version,
          isLoading: false,
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed"
        setState((prev) => ({ ...prev, error: message, isLoading: false }))
        throw err
      }
    },
    [state.isAuthenticated, state.version],
  )

  const pullAndDecrypt = useCallback(async (): Promise<VaultEntry[]> => {
    if (!state.isAuthenticated) throw new Error("Not authenticated")

    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const response = await apiClient.pullVault(deviceIdRef.current, state.version)

      // Placeholder: actual decryption happens in component with master password
      // and crypto-engine decryptVault function

      setState((prev) => ({
        ...prev,
        lastSyncTime: Date.now(),
        version: response.version,
        isLoading: false,
      }))

      return []
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pull failed"
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
      throw err
    }
  }, [state.isAuthenticated, state.version])

  return [
    state,
    {
      register,
      login,
      logout,
      encryptAndSync,
      pullAndDecrypt,
      resolveBreach: async () => {
        if (!state.email) return
        await apiClient.resolveBreach(state.email)
        localStorage.removeItem("user_is_breached")
        setState((prev) => ({ ...prev, isBreached: false }))
      },
    },
  ]
}
