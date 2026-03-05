
/**
 * Vault Operations Tests
 */

import { validateVaultEntry, createVaultEntry } from '../src/vault';

describe('Crypto Engine - Vault Logic Tests', () => {
    describe('createVaultEntry', () => {
        it('should structure inputs into valid vault object', () => {
            console.log('\n--- Test: Create Valid Vault Entry ---');
            const url = 'SecureBank.com';
            const user = 'john_doe';
            const pass = 'SuperSecret123!';
            
            console.log('Input Params:', { url, user, pass });
            
            console.log('[Action] Creating Entry...');
            const entry = createVaultEntry(url, user, pass);
            
            console.log('Output Vault Entry:', entry);
            
            expect(entry.url).toBe(url);
            // ID is not assigned by createVaultEntry (handled by DB)
            // Expect metadata to contain createdAt
            expect(entry.metadata).toBeDefined();
            expect(entry.metadata?.createdAt).toBeDefined();
            console.log(`Created At: ${entry.metadata?.createdAt}`);
            
            console.log('Result: Success - Entry properly constructed.');
        });
    });

    describe('validateVaultEntry', () => {
        it('should return true for a complete entry', () => {
            console.log('\n--- Test: Validate Complete Entry ---');
            const entry = { url: 'test', username: 'u', password: 'p', id: '1', createdAt: 0 };
            console.log('Input Object:', entry);
            
            const isValid = validateVaultEntry(entry);
            console.log(`Validation Result: ${isValid}`);
            
            expect(isValid).toBe(true);
            console.log('Result: Success - Valid entry confirmed.');
        });

        it('should return false for missing fields', () => {
            console.log('\n--- Test: Validate Incomplete Entry ---');
            const entry = { url: 'test', username: 'u' }; // missing password
            console.log('Input Object:', entry);
            
            // @ts-ignore testing js behavior or partial type
            const isValid = validateVaultEntry(entry);
            console.log(`Validation Result: ${isValid}`);
            
            expect(isValid).toBe(false);
            console.log('Result: Success - Invalid entry rejected.');
        });
    });
});
