
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// ------------------------------------------------------------------
// 1. Define Mocks
// ------------------------------------------------------------------
const mockFind = jest.fn();

// We need an object that looks like the model class/object exported
const MockVaultBlob = { 
    find: mockFind 
};
// Attach other methods if needed, but for versioning test, find is key.
// However, pullVaults might use other methods?
// pullVaults calls VaultBlob.find(...).sort(...)

const MockSyncMetadata = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
};

// ------------------------------------------------------------------
// 2. Register Unstable Mocks
// ------------------------------------------------------------------
jest.unstable_mockModule('../../../src/database/models.js', () => ({
    VaultBlob: MockVaultBlob,
    SyncMetadata: MockSyncMetadata
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('SyncService - Versioning Logic', () => {
    let pullVaults: any;

    beforeAll(async () => {
        const syncService = await import('../../../src/services/syncService.js');
        pullVaults = syncService.pullVaults;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
    });

    it('pullVaults: should respect version filter when provided', async () => {
        const userId = 'user-v-1';
        const deviceId = 'device-v-1';
        const lastVersion = 5;
        
        console.log(`Test Case 1: Pulling vaults newer than v${lastVersion}`);
        
        // Mock returning newer vaults
        const mockVaults = [
            { _id: 'v6-id', version: 6, userId: 'user-v-1', ciphertext: 'v6' },
            { _id: 'v7-id', version: 7, userId: 'user-v-1', ciphertext: 'v7' }
        ];
        
        const mockQuery = {
            sort: (jest.fn() as any).mockResolvedValue(mockVaults.map(v => ({...v, userId: { toString: () => v.userId }})))
        };
        mockFind.mockReturnValue(mockQuery as never);

        const result = await pullVaults(userId, deviceId, lastVersion);
        
        console.log(`[Output] Retrieved ${result.vaults?.length} vaults`);
        
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({
            userId,
            version: { $gt: lastVersion }
        }));
        
        expect(result.vaults).toHaveLength(2);
        expect(result.vaults?.[0].version).toBe(6);
        console.log('Result: Success - Versions filtered correctly.');
    });

    it('pullVaults: should retrieve all vaults if logic (not tested here) expects so, or default behavior', async () => {
        const userId = 'user-v-2';
        const deviceId = 'device-v-2';
        
        console.log(`Test Case 2: Pulling all vaults (no version filter)`);
        
        const mockQuery = {
            sort: (jest.fn() as any).mockResolvedValue([])
        };
        mockFind.mockReturnValue(mockQuery as never);

        await pullVaults(userId, deviceId);
        
        // Check finding without version filter
        // If second arg is omitted, pullVaults(userId, deviceId) -> lastVersion undefined?
        // Implementation: pullVaults(userId, deviceId, lastVersion?)
        // If lastVersion is undefined, query should handle it
        expect(mockFind).toHaveBeenCalledWith({ userId });
        console.log('Result: Success - Query constructed without version constraint.');
    });
});
