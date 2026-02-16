
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import crypto from 'crypto';

// ------------------------------------------------------------------
// 1. Define Mocks
// ------------------------------------------------------------------
const mockSave = (jest.fn() as any).mockResolvedValue(true);
const mockRecoveryKeyFindOne = jest.fn();
const mockRecoveryKeyUpdateMany = jest.fn();
const mockRecoveryKeyCountDocuments = jest.fn();

const MockRecoveryKey = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: mockSave
}));
(MockRecoveryKey as any).findOne = mockRecoveryKeyFindOne;
(MockRecoveryKey as any).updateMany = mockRecoveryKeyUpdateMany;
(MockRecoveryKey as any).countDocuments = mockRecoveryKeyCountDocuments;

const mockUserFindOne = (jest.fn() as any);
const MockUser = jest.fn();
(MockUser as any).findOne = mockUserFindOne;

// ------------------------------------------------------------------
// 2. Register Unstable Mocks
// ------------------------------------------------------------------
jest.unstable_mockModule('../../src/database/models.js', () => ({
    RecoveryKey: MockRecoveryKey,
    User: MockUser
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('RecoveryService Integration Tests', () => {
    let recoveryService: any;
    let generateRecoveryKey: any;
    let storeRecoveryKeyHash: any;
    let verifyRecoveryKey: any;

    const validUserId = '507f1f77bcf86cd799439011'; // Valid ObjectId hex

    beforeAll(async () => {
        recoveryService = await import('../../src/services/recoveryService.js');
        generateRecoveryKey = recoveryService.generateRecoveryKey;
        storeRecoveryKeyHash = recoveryService.storeRecoveryKeyHash;
        verifyRecoveryKey = recoveryService.verifyRecoveryKey;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
        mockSave.mockResolvedValue(true);
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
        const userId = validUserId;
        const keyHash = 'hashed-key-value';
        const encryptedVaultKey = 'encrypted-vault-key-abc';
        
        console.log(`Test Case 2: Storing Recovery Key for User ${userId}`);
        
        const result = await storeRecoveryKeyHash(userId, keyHash, encryptedVaultKey);
        
        console.log('[Output] Stored Record:', result);
        
        // Use expect.anything() because ObjectId comparison might differ
        expect(mockRecoveryKeyUpdateMany).toHaveBeenCalledWith(
            expect.objectContaining({ userId: expect.anything(), isRevoked: false }), 
            expect.objectContaining({ isRevoked: true })
        );
        expect(MockRecoveryKey).toHaveBeenCalledTimes(1);
        expect(mockSave).toHaveBeenCalled();
        console.log('Result: Recovery key stored securely (previous keys revoked).');
    });

    it('verifyRecoveryKey: should verify a valid key and return vault key', async () => {
        console.log('Test Case 3: Verifying Recovery Key');
        const email = 'recovery@test.com';
        const rawKey = generateRecoveryKey();
        
        const expectedHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const encryptedVaultKey = 'secret-vault-key';
        
        // Mock User
        mockUserFindOne.mockResolvedValue({ _id: validUserId, email });
        
        // Mock RecoveryKey findOne to match only if hash matches
        mockRecoveryKeyFindOne.mockImplementation(async (query: any) => {
             if (query.keyHash === expectedHash) {
                 return {
                     userId: validUserId,
                     keyHash: expectedHash,
                     encryptedVaultKey,
                     isRevoked: false,
                     save: (jest.fn() as any).mockResolvedValue(true)
                 };
             }
             return null;
        });

        console.log(`[Input] Verifying Key: ${rawKey.substring(0, 10)}... for ${email}`);
        
        const result = await verifyRecoveryKey(email, rawKey);
        
        console.log('[Output] Verification Result:', result);
        
        expect(mockUserFindOne).toHaveBeenCalledWith(expect.objectContaining({ email: email.toLowerCase() }));
        expect(result.success).toBe(true);
        expect(result.encryptedVaultKey).toBe(encryptedVaultKey);
        console.log('Result: Success - Valid recovery key accepted.');
    });
});
