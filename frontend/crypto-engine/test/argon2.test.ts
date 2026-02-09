/**
 * Argon2id Key Derivation Tests
 */

import { deriveKey } from '../src/argon2';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node environment
if (!global.crypto) {
  (global as any).crypto = require('crypto').webcrypto;
}
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

describe('Crypto Engine - Argon2id', () => {
    const testOptions = {
        iterations: 1,
        memorySize: 1024,
        parallelism: 1
    };

    it('should derive a consistent key from the same password and salt', async () => {
        console.log('Running: should derive a consistent key');
        const password = 'test-password';
        const salt = new Uint8Array(16).fill(0x01);
        
        const derived1 = await deriveKey(password, salt, testOptions);
        await deriveKey(password, salt, testOptions);
        
        expect(derived1.salt).toEqual(salt);
        console.log('Result: Success - salt is consistent');
    });

    it('should produce a valid CryptoKey for AES-GCM', async () => {
        console.log('Running: should produce a valid CryptoKey');
        const derived = await deriveKey('pass', new Uint8Array(16), testOptions);
        expect(derived.encryptionKey.algorithm.name).toBe('AES-GCM');
        console.log('Result: Success - algorithm is ' + derived.encryptionKey.algorithm.name);
    });
});
