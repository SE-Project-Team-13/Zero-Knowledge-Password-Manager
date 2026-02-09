/**
 * Comprehensive Crypto Engine Tests
 * 
 * Tests all components except full Argon2 integration (too slow for unit tests):
 * 1. AES-256-GCM encryption/decryption ✓
 * 2. Validation and helper functions ✓
 * 3. High-level vault operations (with mocked keys for speed) ✓
 * 
 * Note: Full Argon2id tests should be run separately as integration tests
 * due to their intentional computational cost (10-20s per test).
 */

import { encrypt, decrypt } from '../src/aes';
import { validateVaultEntry, createVaultEntry } from '../src/vault';
import { VaultEntry, DerivedKey } from '../src/types';

// Polyfill for Node environment
if (!global.crypto) {
  (global as any).crypto = require('crypto').webcrypto;
}

// Additional polyfills for TextEncoder/Decoder
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

describe('Crypto Engine - AES-256-GCM Encryption', () => {
    const mockEntry: VaultEntry = {
        site: 'TestSite',
        username: 'testuser',
        password: 'testpass',
        metadata: {
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            notes: 'Test notes'
        }
    };

    // Helper to create a mock derived key for testing
    async function createMockDerivedKey(): Promise<DerivedKey> {
        const encryptionKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        const authKey = await crypto.subtle.generateKey(
            { name: 'HMAC', hash: 'SHA-256' },
            true,
            ['sign', 'verify']
        );

        const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

        return { 
            encryptionKey, 
            authKey, 
            salt,
            key: encryptionKey // deprecated but required
        };
    }

    it('should encrypt data and produce valid ciphertext structure', async () => {
        const derivedKey = await createMockDerivedKey();
        const encrypted = await encrypt(mockEntry, derivedKey);

        expect(encrypted.ciphertext).toBeDefined();
        expect(encrypted.ciphertext.length).toBeGreaterThan(0);
        expect(encrypted.iv).toBeDefined();
        expect(encrypted.tag).toBeDefined();
        expect(encrypted.salt).toBeDefined();
        expect(encrypted.algorithm).toBe('AES-256-GCM');
        expect(encrypted.derivationAlgorithm).toBe('Argon2id');
    });

    it('should successfully decrypt with correct key (round trip)', async () => {
        const derivedKey = await createMockDerivedKey();
        const encrypted = await encrypt(mockEntry, derivedKey);
        const decrypted = await decrypt(encrypted, derivedKey);

        expect(decrypted).toEqual(mockEntry);
        expect(decrypted.site).toBe('TestSite');
        expect(decrypted.username).toBe('testuser');
        expect(decrypted.password).toBe('testpass');
        expect(decrypted.metadata?.notes).toBe('Test notes');
    });

    it('should fail to decrypt with wrong key (authentication)', async () => {
        const correctKey = await createMockDerivedKey();
        const wrongKey = await createMockDerivedKey();
        
        const encrypted = await encrypt(mockEntry, correctKey);

        await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
    });

    it('should handle entries with empty metadata fields', async () => {
        const emptyEntry: VaultEntry = {
            ...mockEntry,
            metadata: {
                ...mockEntry.metadata,
                notes: ''
            }
        };

        const derivedKey = await createMockDerivedKey();
        const encrypted = await encrypt(emptyEntry, derivedKey);
        const decrypted = await decrypt(encrypted, derivedKey);

        expect(decrypted.metadata?.notes).toBe('');
        expect(decrypted.site).toBe(emptyEntry.site);
    });

    it('should handle entries without metadata', async () => {
        const noMetadataEntry: VaultEntry = {
            site: 'example.com',
            username: 'user',
            password: 'pass'
        };

        const derivedKey = await createMockDerivedKey();
        const encrypted = await encrypt(noMetadataEntry, derivedKey);
        const decrypted = await decrypt(encrypted, derivedKey);

        expect(decrypted).toEqual(noMetadataEntry);
    });

    it('should produce different ciphertexts for same data (IV randomization)', async () => {
        const derivedKey = await createMockDerivedKey();
        
        const encrypted1 = await encrypt(mockEntry, derivedKey);
        const encrypted2 = await encrypt(mockEntry, derivedKey);

        // IVs should be different (randomized)
        expect(encrypted1.iv).not.toBe(encrypted2.iv);
        // Ciphertexts should be different due to different IVs
        expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
        
        // But both should decrypt to the same data
        const decrypted1 = await decrypt(encrypted1, derivedKey);
        const decrypted2 = await decrypt(encrypted2, derivedKey);
        expect(decrypted1).toEqual(decrypted2);
    });

    it('should handle special characters in credentials', async () => {
        const specialEntry: VaultEntry = {
            site: 'test@site.com',
            username: 'user+tag@example.com',
            password: 'p@$$w0rd!#%&*()[]{}',
            metadata: {
                notes: 'Special chars: 你好 🔐 €£¥'
            }
        };

        const derivedKey = await createMockDerivedKey();
        const encrypted = await encrypt(specialEntry, derivedKey);
        const decrypted = await decrypt(encrypted, derivedKey);

        expect(decrypted).toEqual(specialEntry);
    });

    it('should handle very long passwords', async () => {
        const longPassword = 'a'.repeat(1000);
        const longEntry: VaultEntry = {
            site: 'example.com',
            username: 'user',
            password: longPassword
        };

        const derivedKey = await createMockDerivedKey();
        const encrypted = await encrypt(longEntry, derivedKey);
        const decrypted = await decrypt(encrypted, derivedKey);

        expect(decrypted.password).toBe(longPassword);
        expect(decrypted.password.length).toBe(1000);
    });
});

describe('Crypto Engine - Validation Functions', () => {
    it('should validate correct vault entry', () => {
        const validEntry: VaultEntry = {
            site: 'example.com',
            username: 'user',
            password: 'pass',
        };

        expect(validateVaultEntry(validEntry)).toBe(true);
    });

    it('should validate entry with metadata', () => {
        const validEntry: VaultEntry = {
            site: 'example.com',
            username: 'user',
            password: 'pass',
            metadata: {
                createdAt: '2023-01-01',
                notes: 'Test'
            }
        };

        expect(validateVaultEntry(validEntry)).toBe(true);
    });

    it('should reject entry with empty site', () => {
        const invalidEntry: VaultEntry = {
            site: '',
            username: 'user',
            password: 'pass',
        };

        expect(validateVaultEntry(invalidEntry)).toBe(false);
    });

    it('should reject entry with empty username', () => {
        const invalidEntry: VaultEntry = {
            site: 'example.com',
            username: '',
            password: 'pass',
        };

        expect(validateVaultEntry(invalidEntry)).toBe(false);
    });

    it('should reject entry with empty password', () => {
        const invalidEntry: VaultEntry = {
            site: 'example.com',
            username: 'user',
            password: '',
        };

        expect(validateVaultEntry(invalidEntry)).toBe(false);
    });

    it('should reject entry with missing fields', () => {
        const invalidEntry = {
            site: 'example.com',
            username: 'user',
            // password missing
        } as VaultEntry;

        expect(validateVaultEntry(invalidEntry)).toBe(false);
    });
});

describe('Crypto Engine - Helper Functions', () => {
    it('should create vault entry with default metadata', () => {
        const entry = createVaultEntry('github.com', 'user@example.com', 'secret123');

        expect(entry.site).toBe('github.com');
        expect(entry.username).toBe('user@example.com');
        expect(entry.password).toBe('secret123');
        expect(entry.metadata).toBeDefined();
        expect(entry.metadata?.createdAt).toBeDefined();
        
        // Verify createdAt is a valid ISO date
        const createdAt = new Date(entry.metadata!.createdAt!);
        expect(createdAt.toString()).not.toBe('Invalid Date');
    });

    it('should create vault entry with custom metadata', () => {
        const customMetadata = { 
            notes: 'Important account', 
            category: 'work',
            url: 'https://github.com'
        };
        const entry = createVaultEntry('github.com', 'user@example.com', 'secret123', customMetadata);

        expect(entry.metadata?.notes).toBe('Important account');
        expect(entry.metadata?.category).toBe('work');
        expect(entry.metadata?.url).toBe('https://github.com');
        expect(entry.metadata?.createdAt).toBeDefined();
    });

    it('should merge custom metadata with default createdAt', () => {
        const customMetadata = { notes: 'Test' };
        const entry = createVaultEntry('site.com', 'user', 'pass', customMetadata);

        expect(entry.metadata?.notes).toBe('Test');
        expect(entry.metadata?.createdAt).toBeDefined();
    });

    it('should handle empty custom metadata', () => {
        const entry = createVaultEntry('site.com', 'user', 'pass', {});

        expect(entry.metadata?.createdAt).toBeDefined();
    });
});

describe('Crypto Engine - Integration Scenarios', () => {
    async function createMockDerivedKey(): Promise<DerivedKey> {
        const encryptionKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        const authKey = await crypto.subtle.generateKey(
            { name: 'HMAC', hash: 'SHA-256' },
            true,
            ['sign', 'verify']
        );

        const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

        return { encryptionKey, authKey, salt, key: encryptionKey };
    }

    it('should handle complete workflow: create → validate → encrypt → decrypt', async () => {
        // Create entry
        const entry = createVaultEntry('github.com', 'user@example.com', 'secret123', {
            notes: 'Work account'
        });

        // Validate
        expect(validateVaultEntry(entry)).toBe(true);

        // Encrypt
        const derivedKey = await createMockDerivedKey();
        const encrypted = await encrypt(entry, derivedKey);

        // Simulate server storage
        const serialized = JSON.stringify(encrypted);
        expect(serialized).toBeDefined();

        // Deserialize
        const deserialized = JSON.parse(serialized);

        // Decrypt
        const decrypted = await decrypt(deserialized, derivedKey);

        // Verify
        expect(decrypted.site).toBe('github.com');
        expect(decrypted.username).toBe('user@example.com');
        expect(decrypted.password).toBe('secret123');
        expect(decrypted.metadata?.notes).toBe('Work account');
    });

    it('should handle multiple entries encryption/decryption', async () => {
        const entries = [
            createVaultEntry('github.com', 'user1', 'pass1'),
            createVaultEntry('gitlab.com', 'user2', 'pass2'),
            createVaultEntry('bitbucket.com', 'user3', 'pass3'),
        ];

        const derivedKey = await createMockDerivedKey();
        const encrypted = await Promise.all(
            entries.map(entry => encrypt(entry, derivedKey))
        );

        const decrypted = await Promise.all(
            encrypted.map(enc => decrypt(enc, derivedKey))
        );

        expect(decrypted).toHaveLength(3);
        expect(decrypted[0].site).toBe('github.com');
        expect(decrypted[1].site).toBe('gitlab.com');
        expect(decrypted[2].site).toBe('bitbucket.com');
    });
});
