import { getApiBaseUrl } from "./api-base-url"

export interface VaultEntry {
  site: string
  username: string
  password: string
  metadata?: Record<string, any>
}

export interface SyncPayload {
  ciphertext: string
  iv: string
  salt: string
  tag: string
  deviceId: string
  version: number
}

export interface AuthResponse {
  userId: string
  fullName?: string // User's full name
  sessionToken: string
  salt: string
  verifier?: string
  serverProof?: string
  isBreached?: boolean
  lastBreachCheck?: string // Dates come as strings from JSON
  is2faEnabled?: boolean
}

export interface SyncResponse {
  success: boolean
  version: number
  lastUpdated: string
  ciphertext?: string
  iv?: string
  salt?: string
  tag?: string
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(
    baseUrl: string = getApiBaseUrl(),
    token?: string | null
  ) {
    // Ensure protocol is present
    this.baseUrl = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`
    
    if (token) {
      this.token = token
    } else if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token")
    }
  }

  setToken(sessionToken: string) {
    this.token = sessionToken
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", sessionToken)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, customToken?: string | null): Promise<T> {
    const headers = new Headers({
      "Content-Type": "application/json",
    })
    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => headers.set(key, value))
    }

    const activeToken = customToken || this.token
    if (activeToken) {
      headers.set("Authorization", `Bearer ${activeToken}`)
    }

    const targetUrl = `${this.baseUrl}${endpoint}`
    if (typeof window !== "undefined") {
      console.log(`[ApiClient] Requesting: ${options.method || 'GET'} ${targetUrl}`);
    }

    const response = await fetch(targetUrl, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      if (typeof window !== "undefined") {
        console.error(`[ApiClient] Error response from ${targetUrl}:`, response.status, error);
      }
      throw new Error(error.message || `API error: ${response.statusText}`)
    }

    const data = await response.json()
    if (typeof window !== "undefined" && endpoint === "/auth/me") {
       console.log(`[ApiClient] /auth/me payload:`, data)
    }
    return data as Promise<T>
  }

  // Authentication Endpoints
  async getSalt(email: string): Promise<{ salt: string, challenge: string, argon2Memory?: number, argon2Iterations?: number }> {
    return this.request<{ salt: string, challenge: string, argon2Memory?: number, argon2Iterations?: number }>(`/auth/salt/${encodeURIComponent(email)}`)
  }

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    return this.request<{ exists: boolean }>(`/auth/check-email/${encodeURIComponent(email)}`)
  }

  async register(email: string, fullName: string, verifier: string, salt: string, argon2Memory?: number, argon2Iterations?: number): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, fullName, verifier, salt, argon2Memory, argon2Iterations }),
    })
  }

  async login(email: string, challenge: string, clientProof: string): Promise<AuthResponse & { sessionToken: string }> {
    return this.request<AuthResponse & { sessionToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, challenge, clientProof }),
    })
  }

  async verifyOtp(email: string, code: string, token?: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }, token)
  }

  async checkBreach(email: string, token?: string): Promise<{ isBreached: boolean }> {
    return this.request<{ isBreached: boolean }>(`/auth/check-breach/${encodeURIComponent(email)}`, {}, token)
  }

  async resolveBreach(email: string, token?: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/auth/resolve-breach", {
      method: "POST",
    }, token)
  }

  // Sync Endpoints
  async pushVault(payload: SyncPayload, token?: string): Promise<SyncResponse> {
    return this.request<SyncResponse>("/sync/push", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token)
  }

  async pullVault(deviceId: string, version = 0, token?: string): Promise<SyncResponse> {
    return this.request<SyncResponse>(`/sync/pull?deviceId=${deviceId}&version=${version}`, {
      method: "GET",
    }, token)
  }

  async getMe(token?: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/me", {}, token)
  }

  async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/health")
  }
}

// Export a fresh instance creator for SSR
export const createApiClient = (token?: string | null) => new ApiClient(undefined, token)

// Export a base client for client-side use (singleton behavior preserved for browser)
export const apiClient = new ApiClient()
