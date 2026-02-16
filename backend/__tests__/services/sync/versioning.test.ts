import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import { VaultBlob } from '../../../src/database/models.js';
import * as syncService from '../../../src/services/syncService.js';
import mongoose from 'mongoose';

describe('SyncService - Versioning Logic Integration Tests', () => {

    // DB cleanup handled by jest.setup.ts

    it('pullVaults: should respect version filter when provided', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const deviceId = 'requesting-device';
        const lastVersion = 5;

        console.log(`Test Case 1: Pulling vaults newer than v${lastVersion}`);

        // Setup: Create older and newer blobs
        await VaultBlob.create({
            userId,
            deviceId: 'other',
            ciphertext: 'v4',
            version: 4,
            salt: 's',
            iv: 'i',
            authTag: 't',
            timestamp: Date.now(),
            nonce: 'n4'
        });

        await VaultBlob.create({
            userId,
            deviceId: 'other',
            ciphertext: 'v6',
            version: 6,
            salt: 's',
            iv: 'i',
            authTag: 't',
            timestamp: Date.now(),
            nonce: 'n6'
        });

        await VaultBlob.create({
            userId,
            deviceId: 'other',
            ciphertext: 'v7',
            version: 7,
            salt: 's',
            iv: 'i',
            authTag: 't',
            timestamp: Date.now(),
            nonce: 'n7'
        });

        const result = await syncService.pullVaults(userId, deviceId, lastVersion);

        console.log(`[Output] Retrieved ${result.vaults?.length} vaults`);

        expect(result.success).toBe(true);
        expect(result.vaults).toHaveLength(2);
        expect(result.vaults?.[0].version).toBe(7);
        expect(result.vaults?.[1].version).toBe(6);

        console.log('Result: Success - Versions filtered correctly.');
    });

    it('pullVaults: should retrieve all vaults if lastVersion is not provided', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const deviceId = 'requesting-device';

        await VaultBlob.create({
            userId,
            deviceId: 'other',
            ciphertext: 'v1',
            version: 1,
            salt: 's',
            iv: 'i',
            authTag: 't',
            timestamp: Date.now(),
            nonce: 'na'
        });

        console.log(`Test Case 2: Pulling all vaults (no version filter)`);

        const result = await syncService.pullVaults(userId, deviceId);

        expect(result.success).toBe(true);
        expect(result.vaults).toHaveLength(1);
        expect(result.vaults?.[0].version).toBe(1);

        console.log('Result: Success - All vaults retrieved when no version constraint.');
    });
});
