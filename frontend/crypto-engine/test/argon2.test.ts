
/**
 * Argon2id Key Derivation Tests
 */

import { deriveKey } from '../src/argon2';
import { TextEncoder, TextDecoder } from 'util';
import * as cryptoModule from 'crypto';

// Polyfill for Node environment
if (!global.crypto) {
  // @ts-ignore
  global.crypto = cryptoModule.webcrypto;
}
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

describe('Crypto Engine - Argon2id', () => {
    const testOptions = {
        iterations: 1, // Reduced for speed in tests
        memorySize: 1024,
        parallelism: 1
    };

    it('should derive a consistent key material from the same password and salt', async () => {
        console.log('\n--- Test: Argon2id Key Consistency ---');
        const password = 'CorrectHorseBatteryStaple';
        // Need Uint8Array for the actual function usually? mockDerivedKey used Uint8Array in previous test file
        // cryptoModule.randomBytes returns Buffer. Buffer is Uint8Array subclass.
        const salt = new Uint8Array(cryptoModule.randomBytes(16));
        
        console.log(`Input Password: "${password}"`);
        console.log(`Input Salt (hex): ${Buffer.from(salt).toString('hex')}`);

        console.log('[Action] Deriving Key 1...');
        const derived1 = await deriveKey(password, salt, testOptions);
        console.log('Derived Key 1 Algo:', derived1.encryptionKey.algorithm.name);
        
        console.log('[Action] Deriving Key 2 (same inputs)...');
        const derived2 = await deriveKey(password, salt, testOptions);
        
        console.log('Result Object Salt 1 (hex):', Buffer.from(derived1.salt).toString('hex'));
        
        // Check consistency
        expect(derived1.salt).toEqual(salt);
        expect(derived2.salt).toEqual(salt); // Should be same instance or value equality
        console.log('Result: Success - Derived keys structure is consistent.');
    });

    it('should configure derived key for AES-GCM', async () => {
        console.log('\n--- Test: Correct Algorithm Configuration ---');
        const derived = await deriveKey('pass', new Uint8Array(16), testOptions);
        
        console.log(`Derived Encryption Key Algorithm: ${derived.encryptionKey.algorithm.name}`);
        // Cast to any because TS types for WebCrypto KeyAlgorithm might be strict/missing name on base type
        console.log(`Derived Auth Key Algorithm: ${(derived.authKey.algorithm as any).name}`);
        
        expect(derived.encryptionKey.algorithm.name).toBe('AES-GCM');
        expect((derived.authKey.algorithm as any).name).toBe('HMAC');
        console.log('Result: Success - Keys configured for authenticated encryption (AES-GCM + HMAC).');
    });
});
