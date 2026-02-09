/**
 * AES-256-GCM Encryption Tests
 */

import { encrypt, decrypt } from '../src/aes';
import { DerivedKey } from '../src/types';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node environment
if (!global.crypto) {
  (global as any).crypto = require('crypto').webcrypto;
}
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

describe('Crypto Engine - AES-256-GCM', () => {
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
        const salt = new Uint8Array(16);
        return { encryptionKey, authKey, salt, key: encryptionKey };
    }

    it('should encrypt and decrypt a string correctly', async () => {
        console.log('Running: should encrypt and decrypt correctly');
        const derivedKey = await createMockDerivedKey();
        const data = { site: 'Test', username: 'user', password: 'Secret message 🔐' };
        
        const encrypted = await encrypt(data, derivedKey);
        const decrypted = await decrypt(encrypted, derivedKey);
        
        expect(decrypted).toEqual(data);
        console.log('Result: Success - round trip complete');
    });

    it('should use a unique IV for every encryption', async () => {
        console.log('Running: should use a unique IV');
        const derivedKey = await createMockDerivedKey();
        const data = { site: 'Test', username: 'user', password: 'data' };
        
        const enc1 = await encrypt(data, derivedKey);
        const enc2 = await encrypt(data, derivedKey);
        
        expect(enc1.iv).not.toBe(enc2.iv);
        console.log('Result: Success - IVs are different: ' + enc1.iv + ' vs ' + enc2.iv);
    });
});
