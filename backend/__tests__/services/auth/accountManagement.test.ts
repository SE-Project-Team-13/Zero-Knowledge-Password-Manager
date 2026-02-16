
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// ------------------------------------------------------------------
// 1. Define Mocks
// ------------------------------------------------------------------
const mockDelete = jest.fn();
const mockUpdate = jest.fn();
const mockFindById = jest.fn();
const mockFindByIdAndUpdate = jest.fn();

const MockUser = jest.fn().mockImplementation((data: any) => ({ ...data }));
(MockUser as any).findById = mockFindById;
(MockUser as any).findByIdAndDelete = mockDelete;
(MockUser as any).findByIdAndUpdate = mockFindByIdAndUpdate;

const MockOther = jest.fn();
(MockOther as any).deleteMany = mockDelete;
(MockOther as any).findOneAndUpdate = jest.fn();
(MockOther as any).updateOne = jest.fn();

const mockRevokeKeys = jest.fn();

// ------------------------------------------------------------------
// 2. Register Unstable Mocks
// ------------------------------------------------------------------
jest.unstable_mockModule('../../../src/database/models.js', () => ({
    User: MockUser,
    Session: MockOther,
    VaultBlob: MockOther,
    SyncMetadata: MockOther,
    RecoveryKey: MockOther,
    SimpleVault: MockOther,
    OTP: MockOther,
    LoginChallenge: MockOther
}));

jest.unstable_mockModule('../../../src/services/recoveryService.js', () => ({
    revokeAllRecoveryKeys: mockRevokeKeys
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('AuthService - Account Management Tests', () => {
    let  deleteUserAccount: any;
    let updateUserCredentials: any;

    beforeAll(async () => {
        const authService = await import('../../../src/services/authService.js');
        deleteUserAccount = authService.deleteUserAccount;
        updateUserCredentials = authService.updateUserCredentials;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
    });

    it('deleteUserAccount: should delete all user data', async () => {
        const userId = 'user-to-delete-123';
        console.log(`Test Case 1: Deleting User ${userId}`);
        
        // Setup Mocks
        mockFindById.mockResolvedValue({ _id: userId, email: 'delete@test.com' } as never);
        
        await deleteUserAccount(userId);
        
        console.log('[Output] Deletion process completed.');
        
        expect(mockDelete).toHaveBeenCalledWith(userId); // User.findByIdAndDelete
        expect(mockDelete).toHaveBeenCalledWith({ userId }); // Other models deleteMany
        expect(mockDelete).toHaveBeenCalledWith({ email: 'delete@test.com' }); // OTP deleteMany
        
        console.log('Result: Success - All user data purged.');
    });

    it('updateUserCredentials: should update user record and revoke recovery keys', async () => {
        const userId = 'user-update-456';
        const salt = 'new-salt';
        const verifier = 'new-verifier';
        
        console.log(`Test Case 2: Updating credentials for User ${userId}`);
        
        // Mock User
        mockFindByIdAndUpdate.mockResolvedValue({ _id: userId } as never);
        
        await updateUserCredentials(userId, salt, verifier);
        
        console.log('[Output] User credentials updated.');
        
        expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(userId, { salt, verifier });
        expect(mockRevokeKeys).toHaveBeenCalledWith(userId);
        
        console.log('Result: Success - Credentials updated and recovery keys revoked.');
    });
});
