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
      console.log(`Fetching salt for ${email}`);
      const saltResponse = await axios.get(`${API_URL}/auth/salt/${encodeURIComponent(email)}`);
      const { salt, challenge } = saltResponse.data;

      if (!salt || !challenge) throw new Error("User not found or invalid response");

      // 2. Derive Key
      const saltBuffer = hexToBytes(salt);
      const derivedKey = await deriveKey(password, saltBuffer);

      // 3. Generate Client Proof
      // Based on crypto-engine: generateClientProof(verifierHex, challengeHex)
      // Wait. The client does NOT know the verifier. The client derives the verifier from the authKey.
      // Let's check crypto-engine/auth.ts
      // generateClientProof(verifierHex: string, challengeHex: string)
      // The CLIENT needs the verifier to generate the proof?
      // Yes, if following SRP or similar where client proves knowledge of verifier.
      // So client must generate verifier from its derived key.
      
      const verifierHex = await generateVerifier(derivedKey.authKey);
      const clientProof = await generateClientProof(verifierHex, challenge);

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
      // 1. Generate new salt
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      // 2. Derive Key
      const derivedKey = await deriveKey(password, salt);
      
      // 3. Generate Verifier
      const verifier = await generateVerifier(derivedKey.authKey);
      
      // 4. Register on Backend
      const response = await axios.post(`${API_URL}/auth/register`, {
        email,
        fullName,
        salt: bytesToHex(salt),
        verifier
      });
      
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
      console.error(e);
      let msg = (e as Error).message;
      if (axios.isAxiosError(e) && e.response) {
          msg = e.response.data.message || msg;
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
