import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import { User } from '../../../src/database/models.js';
import * as authService from '../../../src/services/authService.js';

describe('AuthService - Registration Helper Integration Tests', () => {

    beforeEach(async () => {
        // DB is cleared by jest.setup.ts afterEach, but explicit clear here is fine too if needed.
        // jest.setup.ts handles it.
    });

    it('checkUserExists: should return true for existing user', async () => {
        const email = 'check@test.com';
        console.log(`Test Case 1: Checking if user ${email} exists`);

        await User.create({
            email,
            fullName: 'Test User',
            salt: 'salt',
            verifier: 'verifier'
        });

        const exists = await authService.checkUserExists(email);

        console.log(`[Output] Exists: ${exists}`);

        expect(exists).toBe(true);
        console.log('Result: Success - User existence detected.');
    });

    it('checkUserExists: should return false for non-existent user', async () => {
        const email = 'new-user@test.com';
        console.log(`Test Case 2: Checking if user ${email} exists (should not)`);

        const exists = await authService.checkUserExists(email);

        console.log(`[Output] Exists: ${exists}`);

        expect(exists).toBe(false);
        console.log('Result: Success - User absence detected.');
    });

    it('getUserSalt: should return salt for existing user', async () => {
        const email = 'salt@test.com';
        const expectedSalt = 'random-salt-value-123';
        console.log(`Test Case 3: Fetching salt for ${email}`);

        await User.create({
            email,
            fullName: 'Salt User',
            salt: expectedSalt,
            verifier: 'verifier'
        });

        const result = await authService.getUserSalt(email);

        console.log(`[Output] Salt: ${result}`);

        expect(result).toBe(expectedSalt);
        console.log('Result: Success - Salt retrieved correctly.');
    });
});
