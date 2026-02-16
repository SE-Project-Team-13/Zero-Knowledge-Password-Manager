
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// ------------------------------------------------------------------
// 1. Define Mocks
// ------------------------------------------------------------------
const mockSave = (jest.fn() as any).mockResolvedValue(true);
const mockVaultFind = jest.fn();
const mockVaultCreate = jest.fn();
const mockSyncFindOne = jest.fn();
const mockSyncFindOneAndUpdate = jest.fn();

const MockVaultBlob = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: mockSave,
    _id: 'mock-vault-id',
    userId: { toString: () => 'user-sync-1' },
    deviceId: 'device-1', // Default mock value if not overridden
    ciphertext: 'data',
    salt: 's',
    iv: 'i',
    authTag: 't',
    version: 1,
    timestamp: 123456789,
    nonce: 'n',
    createdAt: new Date(),
    updatedAt: new Date()
}));
(MockVaultBlob as any).find = mockVaultFind;
(MockVaultBlob as any).create = mockVaultCreate;

const MockSyncMetadata = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: mockSave
}));
(MockSyncMetadata as any).findOneAndUpdate = mockSyncFindOneAndUpdate;
(MockSyncMetadata as any).findOne = mockSyncFindOne;

// ------------------------------------------------------------------
// 2. Register Unstable Mocks
// ------------------------------------------------------------------
jest.unstable_mockModule('../../src/database/models.js', () => ({
    VaultBlob: MockVaultBlob,
    SyncMetadata: MockSyncMetadata
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('SyncService Integration Tests', () => {
    let pushVault: any;
    let pullVaults: any;

    beforeAll(async () => {
        const syncService = await import('../../src/services/syncService.js');
        pushVault = syncService.pushVault;
        pullVaults = syncService.pullVaults;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
        mockSave.mockResolvedValue(true);
    });

    it('pushVault: should save encrypted blob and update sync metadata', async () => {
        const userId = 'user-sync-1';
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
        
        const result = await pushVault(userId, deviceId, vaultData);
        
        console.log('[Output] pushVault Result:', result);
        
        // Verify VaultBlob creation
        expect(MockVaultBlob).toHaveBeenCalledWith(expect.objectContaining({
            userId,
            deviceId,
            ciphertext: vaultData.ciphertext,
            version: vaultData.version
        }));
        
        // Verify SyncMetadata update
        expect(mockSyncFindOneAndUpdate).toHaveBeenCalledWith(
            { userId, deviceId },
            expect.objectContaining({ vaultVersion: 1, nonce: vaultData.nonce }),
            expect.objectContaining({ upsert: true })
        );
        
        expect(result.success).toBe(true);
        expect(result.vaultId).toBe('mock-vault-id');
        console.log('Result: Success - Vault pushed and metadata updated.');
    });

    it('pullVaults: should retrieve vault blobs filtered by version', async () => {
        const userId = 'user-sync-1';
        const deviceId = 'device-2';
        const lastVersion = 1;

        console.log(`Test Case 2: Pulling vaults for User ${userId} newer than v${lastVersion}`);
        
        const mockBlobs = [
            {
                _id: 'blob-2',
                userId: userId,
                deviceId: 'device-1',
                ciphertext: 'newer-data',
                version: 2,
                salt: 's',
                iv: 'i',
                authTag: 't',
                timestamp: Date.now(),
                nonce: 'n2',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        
        // Mock DB find().sort() chain properly
        const mockQuery = {
            sort: (jest.fn() as any).mockResolvedValue(mockBlobs.map(b => ({
                ...b,
                userId: { toString: () => b.userId } // Mock ObjectId behavior
            })))
        };
        mockVaultFind.mockReturnValue(mockQuery as never);

        // Execute function
        const result = await pullVaults(userId, deviceId, lastVersion);
        
        console.log('[Output] pullVaults found:', result.vaults?.length, 'vaults');
        
        expect(mockVaultFind).toHaveBeenCalledWith(expect.objectContaining({
            userId,
            version: { $gt: lastVersion }
        }));
        expect(result.success).toBe(true);
        expect(result.vaults).toHaveLength(1);
        expect(result.vaults?.[0].version).toBe(2);
        console.log('Result: Success - Retrieved correct vault versions.');
    });
});
