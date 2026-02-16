
/**
 * AES-256-GCM Encryption Tests
 */

import { encrypt, decrypt } from '../src/aes';
import { DerivedKey } from '../src/types';
import { TextEncoder, TextDecoder } from 'util';
import * as cryptoModule from 'crypto';

// Polyfill for Node environment
if (!global.crypto) {
  // @ts-ignore
  global.crypto = cryptoModule.webcrypto;
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

    it('should encrypt and decrypt a structured object correctly', async () => {
        console.log('\n--- Test: AES Encryption/Decryption Round Trip ---');
        const derivedKey = await createMockDerivedKey();
        
        const inputData = { 
            site: 'StartPage', 
            username: 'privacy_user', 
            password: 'CorrectHorseBatteryStaple! 🔐' 
        };
        console.log('Input Data:', inputData);
        
        console.log('[Action] Encrypting data...');
        const encrypted = await encrypt(inputData, derivedKey);
        
        console.log('Encrypted Output:');
        console.log(`  Ciphertext: ${encrypted.ciphertext.substring(0, 30)}... (truncated)`);
        console.log(`  IV: ${encrypted.iv}`);
        console.log(`  AuthTag: ${encrypted.tag}`);
        console.log(`  Salt: ${encrypted.salt}`);

        console.log('[Action] Decrypting data...');
        const decrypted = await decrypt(encrypted, derivedKey);
        
        console.log('Decrypted Output:', decrypted);
        
        expect(decrypted).toEqual(inputData);
        console.log('Result: Success - Decrypted data matches original input exactly.');
    });

    it('should generate unique IVs for identical inputs', async () => {
        console.log('\n--- Test: IV Uniqueness ---');
        const derivedKey = await createMockDerivedKey();
        const data = { 
            site: 'test', 
            username: 'u', 
            password: 'p' 
        };
        
        console.log('Input Data:', data);
        
        const enc1 = await encrypt(data, derivedKey);
        console.log(`Run 1 IV: ${enc1.iv}`);
        
        const enc2 = await encrypt(data, derivedKey);
        console.log(`Run 2 IV: ${enc2.iv}`);
        
        expect(enc1.iv).not.toBe(enc2.iv);
        console.log('Result: Success - IVs are unique, ensuring semantic security.');
    });
});
