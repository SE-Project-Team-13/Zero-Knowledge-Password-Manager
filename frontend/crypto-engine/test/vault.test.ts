/**
 * Vault Operations Tests
 */

import { validateVaultEntry, createVaultEntry } from '../src/vault';

describe('Crypto Engine - Vault Operations', () => {
    describe('createVaultEntry', () => {
        it('should create a valid vault entry object', () => {
            console.log('Running: should create vault entry');
            const entry = createVaultEntry('example.com', 'user', 'pass');
            expect(entry.site).toBe('example.com');
            console.log('Result: Success - entry created for ' + entry.site);
        });
    });

    describe('validateVaultEntry', () => {
        it('should return true for a complete entry', () => {
            console.log('Running: should validate complete entry');
            const entry = { site: 'ok', username: 'ok', password: 'ok' };
            expect(validateVaultEntry(entry)).toBe(true);
            console.log('Result: Success - entry validated');
        });
    });
});
