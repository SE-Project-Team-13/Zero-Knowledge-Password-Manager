import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import { VaultBlob, SyncMetadata } from '../../src/database/models.js';
import * as syncService from '../../src/services/syncService.js';
import mongoose from 'mongoose';

describe('SyncService Integration Tests', () => {

    // DB cleanup handled by jest.setup.ts

    it('pushVault: should save encrypted blob and update sync metadata', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const deviceId = 'device-1';
        const vaultData = {
            ciphertext: 'encrypted-data-blob',
            salt: 'salt-val',
            iv: 'iv-val',
            authTag: 'tag-val',
            version: 1,
            timestamp: Date.now(),
            nonce: 'unique-nonce'
        };

        console.log(`Test Case 1: Pushing new vault version ${vaultData.version} from ${deviceId}`);

        const result = await syncService.pushVault(userId, deviceId, vaultData);

        console.log('[Output] pushVault Result:', result);

        expect(result.success).toBe(true);
        expect(result.vaultId).toBeDefined();

        // Verify VaultBlob creation in DB
        const blob = await VaultBlob.findById(result.vaultId);
        expect(blob).not.toBeNull();
        expect(blob?.userId.toString()).toBe(userId);
        expect(blob?.version).toBe(vaultData.version);

        // Verify SyncMetadata update in DB
        const meta = await SyncMetadata.findOne({ userId, deviceId });
        expect(meta).not.toBeNull();
        expect(meta?.vaultVersion).toBe(vaultData.version);
        expect(meta?.nonce).toBe(vaultData.nonce);

        console.log('Result: Success - Vault pushed and metadata updated.');
    });

    it('pullVaults: should retrieve vault blobs filtered by version', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        const deviceId = 'requesting-device';

        // Setup: Create some older and newer blobs
        await VaultBlob.create({
            userId,
            deviceId: 'other-device',
            ciphertext: 'v1-data',
            salt: 's',
            iv: 'i',
            authTag: 't',
            version: 1,
            timestamp: Date.now() - 10000,
            nonce: 'n1'
        });

        await VaultBlob.create({
            userId,
            deviceId: 'other-device',
            ciphertext: 'v2-data',
            salt: 's',
            iv: 'i',
            authTag: 't',
            version: 2,
            timestamp: Date.now(),
            nonce: 'n2'
        });

        console.log(`Test Case 2: Pulling vaults for User ${userId} newer than v1`);

        // Execute function
        const result = await syncService.pullVaults(userId, deviceId, 1);

        console.log('[Output] pullVaults found:', result.vaults?.length, 'vaults');

        expect(result.success).toBe(true);
        expect(result.vaults).toHaveLength(1);
        expect(result.vaults?.[0].version).toBe(2);
        expect(result.vaults?.[0].ciphertext).toBe('v2-data');

        console.log('Result: Success - Retrieved correct vault versions.');
    });
});
