import { create } from 'zustand';
import { SecureStorageService } from '../services/secureStorage';
import { deriveKey, DerivedKey, generateVerifier, generateClientProof } from '@password-manager/crypto-engine';
import axios from 'axios';
import { API_URL } from '../config';

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error('Invalid salt format from server');
  }
  const matches = normalized.match(/.{1,2}/g);
  if (!matches) {
    throw new Error('Invalid salt format from server');
  }
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface AuthState {
  isAuthenticated: boolean;
  isOtpPending: boolean;
  pendingEmail: string | null;
  recoveryEmail: string | null;
  recoveredMasterPassword: string | null;
  userId: string | null;
  masterKey: DerivedKey | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  completeOtpVerification: () => void;
  setMasterKey: (masterKey: DerivedKey | null) => void;
  setRecoveryContext: (email: string | null, masterPassword: string | null) => void;
  clearRecoveryContext: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isOtpPending: false,
  pendingEmail: null,
  recoveryEmail: null,
  recoveredMasterPassword: null,
  userId: null,
  masterKey: null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Fetch Salt and Challenge
      console.log(`[Auth] API_URL=${API_URL}`);
      console.log(`Fetching salt for ${email}`);
      const saltResponse = await axios.get(`${API_URL}/auth/salt/${encodeURIComponent(email)}`);
      console.log(`[Auth] Salt fetched successfully`);
      const { salt, challenge, argon2Memory, argon2Iterations } = saltResponse.data;

      if (!salt || !challenge) throw new Error("User not found or invalid response");

      // 2. Derive Key
      const saltBuffer = hexToBytes(salt);
      console.log(`[Auth] Starting key derivation (Argon2)...`);
      const derivedKey = await deriveKey(password, saltBuffer, { 
        // Fallback to undefined for legacy accounts to use the default 8192 memory (slow on mobile, but preserves access)
        memorySize: argon2Memory || undefined, 
        iterations: argon2Iterations || undefined 
      });
      console.log(`[Auth] Key derived successfully`);

      // 3. Generate Client Proof
      console.log(`[Auth] Generating verifier...`);
      const verifierHex = await generateVerifier(derivedKey.authKey);
      console.log(`[Auth] Generating client proof...`);
      const clientProof = await generateClientProof(verifierHex, challenge);
      console.log(`[Auth] Proof generated successfully`);

      // 4. Login
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        challenge,
        clientProof
      });
      
      const { sessionToken, userId } = response.data;
      
      await SecureStorageService.saveSessionId(sessionToken);
      if (userId) {
          await SecureStorageService.saveItem('user_id', userId);
      }

      // Login only establishes a session; user must complete OTP before full auth.
      set({
        isAuthenticated: false,
        isOtpPending: true,
        pendingEmail: email.trim().toLowerCase(),
        userId,
        masterKey: derivedKey,
        isLoading: false,
      });

    } catch (e) {
      console.error(e);
      let msg = (e as Error).message;
      if (axios.isAxiosError(e) && e.response) {
          msg = e.response.data.message || msg;
      }
      set({ error: msg, isLoading: false });
    }
  },

  register: async (email: string, fullName: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`[Auth] Starting registration for ${email}...`);
      // 1. Generate new salt
      const salt = crypto.getRandomValues(new Uint8Array(16));
      console.log(`[Auth] Generated salt`);
      
      // 2. Derive Key
      console.log(`[Auth] Deriving key for registration...`);
      const derivedKey = await deriveKey(password, salt, { memorySize: 128 });
      console.log(`[Auth] Registration key derived`);
      
      // 3. Generate Verifier
      console.log(`[Auth] Generating registration verifier...`);
      const verifier = await generateVerifier(derivedKey.authKey);
      console.log(`[Auth] Registration verifier generated`);
      
      // 4. Register on Backend
      console.log(`[Auth] Sending registration request to backend...`);
      const response = await axios.post(`${API_URL}/auth/register`, {
        email,
        fullName,
        salt: bytesToHex(salt),
        verifier,
        argon2Memory: 128,
        argon2Iterations: 1
      });
      console.log(`[Auth] Registration request successful`);
      
      const { sessionToken, userId } = response.data;
      
      await SecureStorageService.saveSessionId(sessionToken);
      if (userId) {
          await SecureStorageService.saveItem('user_id', userId);
      }
      
      set({
        isAuthenticated: true,
        isOtpPending: false,
        pendingEmail: null,
        userId,
        masterKey: derivedKey,
        isLoading: false,
      });
    } catch (e) {
      console.error("[Auth] Registration failed", e);
      let msg = (e as Error).message;
      if (axios.isAxiosError(e) && e.response) {
          msg = e.response.data.message || msg;
          console.error(`[Auth] Backend Error (Status ${e.response.status}):`, e.response.data);
      }
      set({ error: msg, isLoading: false });
    }
  },

  completeOtpVerification: () => {
    set({
      isAuthenticated: true,
      isOtpPending: false,
      pendingEmail: null,
      error: null,
    });
  },

  setMasterKey: (masterKey: DerivedKey | null) => {
    set({ masterKey });
  },

  setRecoveryContext: (email: string | null, masterPassword: string | null) => {
    set({
      recoveryEmail: email,
      recoveredMasterPassword: masterPassword,
    });
  },

  clearRecoveryContext: () => {
    set({
      recoveryEmail: null,
      recoveredMasterPassword: null,
    });
  },

  logout: async () => {
    const token = await SecureStorageService.getSessionId();
    if (token) {
      try {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
      } catch (e: any) {
        // Always clear local state even if server logout fails.
        console.warn('[Auth] Server logout failed, continuing local logout:', e?.response?.status || e?.message);
      }
    }

    await SecureStorageService.clearSession();
    await SecureStorageService.deleteItem('user_id');
    set({
      isAuthenticated: false,
      isOtpPending: false,
      pendingEmail: null,
      recoveryEmail: null,
      recoveredMasterPassword: null,
      masterKey: null,
      userId: null,
    });
  },

  checkAuth: async () => {
    const session = await SecureStorageService.getSessionId();
    const userId = await SecureStorageService.getItem('user_id');
    
    // If we have a session, we are "logged in" but don't have the Master Key.
    // For MVP, we force re-login to derive key. 
    // Ideally we would verify session validation with backend here.
    if (session && userId) {
        set({ userId, isAuthenticated: false, isOtpPending: false, pendingEmail: null });
        // Optional: validate token with backend?
        // For now, assume session valid but require password for key.
    }
  }
}));
