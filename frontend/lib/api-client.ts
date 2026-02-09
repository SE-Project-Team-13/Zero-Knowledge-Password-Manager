export interface VaultEntry {
  site: string
  username: string
  password: string
  metadata?: Record<string, unknown>
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

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") {
    this.baseUrl = baseUrl
    // Restore token from localStorage if available
    if (typeof window !== "undefined") {
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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers({
      "Content-Type": "application/json",
    })
    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => headers.set(key, value))
    }

    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`)
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `API error: ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  // Authentication Endpoints
  async getSalt(email: string): Promise<{ salt: string }> {
    return this.request<{ salt: string }>(`/auth/salt/${encodeURIComponent(email)}`)
  }

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    return this.request<{ exists: boolean }>(`/auth/check-email/${encodeURIComponent(email)}`)
  }

  async register(email: string, fullName: string, verifier: string, salt: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, fullName, verifier, salt }),
    })
  }

  async login(email: string, challenge: string, clientProof: string): Promise<AuthResponse & { sessionToken: string }> {
    return this.request<AuthResponse & { sessionToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, challenge, clientProof }),
    })
  }

  async resolveBreach(email: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/auth/resolve-breach", {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  }

  // Sync Endpoints
  async pushVault(payload: SyncPayload): Promise<SyncResponse> {
    return this.request<SyncResponse>("/sync/push", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async pullVault(deviceId: string, version = 0): Promise<SyncResponse> {
    return this.request<SyncResponse>(`/sync/pull?deviceId=${deviceId}&version=${version}`, {
      method: "GET",
    })
  }

  async getHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/health")
  }
}

export const apiClient = new ApiClient()
