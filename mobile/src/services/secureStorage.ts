import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ENCRYPTED_KEY_STORAGE_KEY = 'zenithvault_encrypted_account_key';
const SESSION_ID_KEY = 'zenithvault_session_id';

/**
 * Cross-platform storage: uses expo-secure-store on native, localStorage on web.
 */
const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const SecureStorageService = {
  async saveItem(key: string, value: string): Promise<void> {
    try {
      await storage.setItem(key, value);
    } catch (error) {
      console.error(`SecureStorageService Save Error (${key}):`, error);
      throw error;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await storage.getItem(key);
    } catch (error) {
      console.error(`SecureStorageService Get Error (${key}):`, error);
      return null;
    }
  },

  async deleteItem(key: string): Promise<void> {
    try {
      await storage.deleteItem(key);
    } catch (error) {
      console.error(`SecureStorageService Delete Error (${key}):`, error);
    }
  },

  async saveSessionId(sessionId: string) {
    await this.saveItem(SESSION_ID_KEY, sessionId);
  },

  async getSessionId() {
    return this.getItem(SESSION_ID_KEY);
  },

  async clearSession() {
    await this.deleteItem(SESSION_ID_KEY);
  },

  async saveEncryptedKey(encryptedKey: string) {
    await this.saveItem(ENCRYPTED_KEY_STORAGE_KEY, encryptedKey);
  },

  async getEncryptedKey() {
    return this.getItem(ENCRYPTED_KEY_STORAGE_KEY);
  }
};
