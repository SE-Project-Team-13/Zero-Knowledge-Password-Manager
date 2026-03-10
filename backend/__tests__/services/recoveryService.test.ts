
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { User, RecoveryKey } from '../../src/database/models.js';

describe('RecoveryService Integration Tests', () => {
    let recoveryService: any;
    let generateRecoveryKey: any;
    let storeRecoveryKeyHash: any;
    let verifyRecoveryKey: any;

    beforeAll(async () => {
        // Import service - it will use real models connected to MongoMemoryServer
        recoveryService = await import('../../src/services/recoveryService.js');
        generateRecoveryKey = recoveryService.generateRecoveryKey;
        storeRecoveryKeyHash = recoveryService.storeRecoveryKeyHash;
        verifyRecoveryKey = recoveryService.verifyRecoveryKey;
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        // DB cleanup is handled by jest.setup.js afterEach
    });

    it('generateRecoveryKey: should generate a valid recovery key', () => {
        console.log('Test Case 1: Generating a Recovery Key');
        const key = generateRecoveryKey();
        console.log('[Output] Generated Key:', key);
        expect(key).toBeDefined();
        expect(key.length).toBeGreaterThan(0);
        console.log('Result: generated key successfully.');
    });

    it('storeRecoveryKeyHash: should hash key and save user recovery record', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const keyHash = 'hashed-key-value';
        const encryptedVaultKey = 'encrypted-vault-key-abc';

        console.log(`Test Case 2: Storing Recovery Key for User ${userId}`);

        const result = await storeRecoveryKeyHash(userId, keyHash, encryptedVaultKey);

        expect(result).toBeDefined();
        expect(result.userId.toString()).toBe(userId);
        expect(result.keyHash).toBe(keyHash);
        expect(result.encryptedVaultKey).toBe(encryptedVaultKey);
        expect(result.isRevoked).toBe(false);

        // Verify in DB
        const storedInDb = await RecoveryKey.findById(result._id);
        expect(storedInDb).toBeDefined();
        expect(storedInDb?.keyHash).toBe(keyHash);
        console.log('Result: Recovery key stored securely.');
    });

    it('verifyRecoveryKey: should verify a valid key and return vault key', async () => {
        console.log('Test Case 3: Verifying Recovery Key');
        const email = 'recovery-test@example.com';
        const rawKey = generateRecoveryKey();
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const encryptedVaultKey = 'secret-vault-key';

        // Setup: Create User
        const user = new User({
            email,
            fullName: 'Test User',
            salt: 'salt',
            verifier: 'verifier'
        });
        await user.save();

        // Setup: Create RecoveryKey
        const recoveryKey = new RecoveryKey({
            userId: user._id,
            keyHash,
            encryptedVaultKey,
            isRevoked: false
        });
        await recoveryKey.save();

        console.log(`[Input] Verifying Key for ${email}`);

        const result = await verifyRecoveryKey(email, rawKey);

        console.log('[Output] Verification Result:', result);

        expect(result.success).toBe(true);
        expect(result.userId).toBe(user._id.toString());
        expect(result.encryptedVaultKey).toBe(encryptedVaultKey);

        // Verify usedAt is set
        const updatedKey = await RecoveryKey.findById(recoveryKey._id);
        expect(updatedKey?.usedAt).toBeDefined();
        console.log('Result: Success - Valid recovery key accepted.');
    });

    it('verifyRecoveryKey: should reject a revoked key with the expected error', async () => {
        const email = 'revoked-key-test@example.com';
        const rawKey = generateRecoveryKey();
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const user = new User({
            email,
            fullName: 'Revoked Key User',
            salt: 'salt',
            verifier: 'verifier',
        });
        await user.save();

        await RecoveryKey.create({
            userId: user._id,
            keyHash,
            encryptedVaultKey: 'some-encrypted-vault-key',
            isRevoked: true,
        });

        const result = await verifyRecoveryKey(email, rawKey);

        expect(result.success).toBe(false);
        expect(result.error).toBe('This recovery key has been revoked and can no longer be used.');
    });

    it('verifyRecoveryKey: should reject an already-used key with the expected error', async () => {
        const email = 'used-key-test@example.com';
        const rawKey = generateRecoveryKey();
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const user = new User({
            email,
            fullName: 'Used Key User',
            salt: 'salt',
            verifier: 'verifier',
        });
        await user.save();

        await RecoveryKey.create({
            userId: user._id,
            keyHash,
            encryptedVaultKey: 'some-encrypted-vault-key',
            isRevoked: false,
            usedAt: new Date(),
        });

        const result = await verifyRecoveryKey(email, rawKey);

        expect(result.success).toBe(false);
        expect(result.error).toBe('This recovery key has already been used and cannot be used again.');
    });
});
