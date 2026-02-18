import { create } from 'zustand';
import { SecureStorageService } from '../services/secureStorage';
import { deriveKey, DerivedKey, generateVerifier, generateClientProof } from '@password-manager/crypto-engine';
import axios from 'axios';
import { API_URL } from '../config';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  masterKey: DerivedKey | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  userId: null,
  masterKey: null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Fetch Salt and Challenge
      console.log(`Fetching salt for ${email}`);
      const saltResponse = await axios.get(`${API_URL}/auth/salt/${email}`);
      const { salt, challenge } = saltResponse.data;

      if (!salt || !challenge) throw new Error("User not found or invalid response");

      // 2. Derive Key
      const saltBuffer = new Uint8Array(Buffer.from(salt, 'base64')); 
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

      set({ isAuthenticated: true, userId, masterKey: derivedKey, isLoading: false });

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
        salt: Buffer.from(salt).toString('base64'),
        verifier
      });
      
      const { sessionToken, userId } = response.data;
      
      await SecureStorageService.saveSessionId(sessionToken);
      if (userId) {
          await SecureStorageService.saveItem('user_id', userId);
      }
      
      set({ isAuthenticated: true, userId, masterKey: derivedKey, isLoading: false });
    } catch (e) {
      console.error(e);
      let msg = (e as Error).message;
      if (axios.isAxiosError(e) && e.response) {
          msg = e.response.data.message || msg;
      }
      set({ error: msg, isLoading: false });
    }
  },

  logout: async () => {
    await SecureStorageService.clearSession();
    await SecureStorageService.deleteItem('user_id');
    set({ isAuthenticated: false, masterKey: null, userId: null });
  },

  checkAuth: async () => {
    const session = await SecureStorageService.getSessionId();
    const userId = await SecureStorageService.getItem('user_id');
    
    // If we have a session, we are "logged in" but don't have the Master Key.
    // For MVP, we force re-login to derive key. 
    // Ideally we would verify session validation with backend here.
    if (session && userId) {
        set({ userId });
        // Optional: validate token with backend?
        // For now, assume session valid but require password for key.
    }
  }
}));
