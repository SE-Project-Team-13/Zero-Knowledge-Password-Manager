
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// ------------------------------------------------------------------
// 1. Define Mocks
// ------------------------------------------------------------------
const mockUserFindOne = jest.fn();
const mockUserSave = (jest.fn() as any).mockResolvedValue(true);

const MockUser = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: mockUserSave
}));
(MockUser as any).findOne = mockUserFindOne;

const MockOther = jest.fn();
(MockOther as any).findOne = jest.fn();
(MockOther as any).deleteMany = jest.fn();

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

// Must mock dependencies of authService to ensure clean import
jest.unstable_mockModule('../../../src/services/breachService.js', () => ({
    checkEmailBreach: (jest.fn() as any).mockResolvedValue(false)
}));
jest.unstable_mockModule('../../../src/services/otpService.js', () => ({
    sendOTP: jest.fn(),
    verifyOTP: jest.fn()
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('AuthService - Registration Helper Tests', () => {
    let checkUserExists: any;
    let getUserSalt: any;

    beforeAll(async () => {
        const authService = await import('../../../src/services/authService.js');
        checkUserExists = authService.checkUserExists;
        getUserSalt = authService.getUserSalt;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
    });

    it('checkUserExists: should return true for existing user', async () => {
        const email = 'check@test.com';
        console.log(`Test Case 1: Checking if user ${email} exists`);
        
        mockUserFindOne.mockResolvedValue({ email } as never);
        
        const exists = await checkUserExists(email);
        
        console.log(`[Output] Exists: ${exists}`);
        
        expect(mockUserFindOne).toHaveBeenCalledWith({ email: email.toLowerCase() });
        expect(exists).toBe(true);
        console.log('Result: Success - User existence detected.');
    });

    it('checkUserExists: should return false for non-existent user', async () => {
        const email = 'new-user@test.com';
        console.log(`Test Case 2: Checking if user ${email} exists (should not)`);
        
        mockUserFindOne.mockResolvedValue(null as never);
        
        const exists = await checkUserExists(email);
        
        console.log(`[Output] Exists: ${exists}`);
        
        expect(exists).toBe(false);
        console.log('Result: Success - User absence detected.');
    });

    it('getUserSalt: should return salt for existing user', async () => {
        const email = 'salt@test.com';
        const expectedSalt = 'random-salt-value-123';
        console.log(`Test Case 3: Fetching salt for ${email}`);
        
        mockUserFindOne.mockResolvedValue({ email, salt: expectedSalt } as never);
        
        const result = await getUserSalt(email);
        
        console.log(`[Output] Salt: ${result}`);
        
        expect(result).toBe(expectedSalt);
        console.log('Result: Success - Salt retrieved correctly.');
    });
});
