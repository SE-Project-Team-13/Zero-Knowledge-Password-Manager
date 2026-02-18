import * as SecureStore from 'expo-secure-store';

const ENCRYPTED_KEY_STORAGE_KEY = 'zeropass_encrypted_account_key';
const SESSION_ID_KEY = 'zeropass_session_id';

export const SecureStorageService = {
  /**
   * Safe wrapper for SecureStore.setItemAsync
   */
  async saveItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`SecureStorageService Save Error (${key}):`, error);
      throw error;
    }
  },

  /**
   * Safe wrapper for SecureStore.getItemAsync
   */
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStorageService Get Error (${key}):`, error);
      return null;
    }
  },

  /**
   * Safe wrapper for SecureStore.deleteItemAsync
   */
  async deleteItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`SecureStorageService Delete Error (${key}):`, error);
    }
  },

  // Specific helpers
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
