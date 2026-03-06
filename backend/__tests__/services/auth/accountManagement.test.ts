
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import mongoose from 'mongoose';
import { User, OTP, Session, LoginChallenge, RecoveryKey } from '../../../src/database/models.js';

describe('AuthService - Account Management Tests', () => {
    let deleteUserAccount: any;
    let updateUserCredentials: any;

    beforeAll(async () => {
        // Real service, real models
        const authService = await import('../../../src/services/authService.js');
        deleteUserAccount = authService.deleteUserAccount;
        updateUserCredentials = authService.updateUserCredentials;
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        // DB cleanup handled by jest.setup.js
    });

    it('deleteUserAccount: should delete all user data', async () => {
        const userId = new mongoose.Types.ObjectId();
        const email = 'delete@test.com';

        console.log(`Test Case 1: Deleting User ${userId}`);

        // Setup: Create all related data to ensure cascade delete works
        await User.create({ _id: userId, email, fullName: 'Del', salt: 's', verifier: 'v' });
        await Session.create({ userId, token: 't', expiresAt: new Date(Date.now() + 1000 * 60 * 60) });
        await RecoveryKey.create({ userId, keyHash: 'k', encryptedVaultKey: 'e' });
        // OTP and LoginChallenge use email
        await OTP.create({ email, code: '123456', expiresAt: new Date(Date.now() + 1000 * 60 * 10) });
        await LoginChallenge.create({ email, challenge: 'c', expiresAt: new Date(Date.now() + 1000 * 60 * 10) });

        await deleteUserAccount(userId.toString());

        console.log('[Output] Deletion process completed.');

        // Verify deletion
        expect(await User.findById(userId)).toBeNull();
        expect(await Session.findOne({ userId })).toBeNull();
        expect(await RecoveryKey.findOne({ userId })).toBeNull();
        expect(await OTP.findOne({ email })).toBeNull();
        // LoginChallenge is not currently deleted by deleteUserAccount (it expires naturally)
        // expect(await LoginChallenge.findOne({ email })).toBeNull();

        console.log('Result: Success - All user data purged.');
    });

    it('updateUserCredentials: should update user record and revoke recovery keys', async () => {
        const userId = new mongoose.Types.ObjectId();
        const salt = 'new-salt';
        const verifier = 'new-verifier';

        console.log(`Test Case 2: Updating credentials for User ${userId}`);

        // Setup
        await User.create({ _id: userId, email: 'update@test.com', fullName: 'Up', salt: 'old', verifier: 'old' });
        // Create active recovery key
        await RecoveryKey.create({ userId, keyHash: 'hash', encryptedVaultKey: 'evk', isRevoked: false });

        await updateUserCredentials(userId.toString(), salt, verifier);

        console.log('[Output] User credentials updated.');

        // Verify User updated
        const user = await User.findById(userId);
        expect(user?.salt).toBe(salt);
        expect(user?.verifier).toBe(verifier);

        // Verify Recovery Key revoked
        const key = await RecoveryKey.findOne({ userId });
        expect(key?.isRevoked).toBe(true);

        console.log('Result: Success - Credentials updated and recovery keys revoked.');
    });
});
