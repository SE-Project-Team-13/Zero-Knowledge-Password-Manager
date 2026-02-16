
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// ------------------------------------------------------------------
// 1. Define Mocks
// ------------------------------------------------------------------
const mockSessionSave = (jest.fn() as any).mockResolvedValue(true);
const mockSessionFindOne = jest.fn();
const mockSessionDeleteOne = jest.fn();
const mockSessionUpdateOne = jest.fn(); // sometimes used

const MockSession = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: mockSessionSave
}));
(MockSession as any).findOne = mockSessionFindOne;
(MockSession as any).deleteOne = mockSessionDeleteOne;
(MockSession as any).updateOne = mockSessionUpdateOne;
(MockSession as any).deleteMany = jest.fn(); // mock deleteMany as well

const MockOther = jest.fn();
(MockOther as any).findOne = jest.fn();
(MockOther as any).deleteMany = jest.fn();

// ------------------------------------------------------------------
// 2. Register Unstable Mocks
// ------------------------------------------------------------------
jest.unstable_mockModule('../../../src/database/models.js', () => ({
    Session: MockSession,
    User: MockOther,
    VaultBlob: MockOther,
    SyncMetadata: MockOther,
    RecoveryKey: MockOther,
    SimpleVault: MockOther,
    OTP: MockOther,
    LoginChallenge: MockOther
}));

// Mock dependencies of authService
jest.unstable_mockModule('../../../src/services/breachService.js', () => ({
    checkEmailBreach: (jest.fn() as any)
}));
jest.unstable_mockModule('../../../src/services/otpService.js', () => ({
    sendOTP: jest.fn(),
    verifyOTP: jest.fn()
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('AuthService - Session Management Tests', () => {
    let generateSessionToken: any;
    let validateSessionToken: any;
    let invalidateSessionToken: any;

    beforeAll(async () => {
        const authService = await import('../../../src/services/authService.js');
        generateSessionToken = authService.generateSessionToken;
        validateSessionToken = authService.validateSessionToken;
        invalidateSessionToken = authService.invalidateSessionToken;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
        mockSessionSave.mockResolvedValue(true);
    });

    it('generateSessionToken: should create a new session and return token', async () => {
        const userId = 'user-session-1';
        const expirationMinutes = 60;

        console.log(`Test Case 1: Generating session for User ${userId}`);
        
        const result = await generateSessionToken(userId, expirationMinutes);
        
        console.log(`[Output] Generated Token: ${result}`);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        // Verify Session creation
        expect(MockSession).toHaveBeenCalledWith(expect.objectContaining({
            userId,
            // token: hashedToken 
        }));
        expect(mockSessionSave).toHaveBeenCalled();
        console.log('Result: Success - Session record created.');
    });

    it('validateSessionToken: should validate a correct token', async () => {
        const token = 'valid-token-123';
        console.log(`Test Case 2: Validating token ${token}`);
        
        // We assume logic hashes token using crypto.
        // But since we can't easily replicate hash without importing function, 
        // we'll rely on the fact that validateSessionToken hashes the input and queries DB.
        
        mockSessionFindOne.mockResolvedValue({
            userId: { toString: () => 'user-session-1' },
            token: 'hashed-token', // logic will compare this? No, logic queries by hashed token
            expiresAt: new Date(Date.now() + 100000).toISOString()
        } as never);
        
        const result = await validateSessionToken(token);
        
        console.log('[Output] Validation Result:', result);
        
        expect(mockSessionFindOne).toHaveBeenCalled();
        expect(result).not.toBeNull();
        if (result) {
            expect(result.userId.toString()).toBe('user-session-1');
        }
        console.log('Result: Success - Valid token confirmed.');
    });

    it('invalidateSessionToken: should delete the session', async () => {
        const token = 'token-to-delete';
        console.log(`Test Case 3: Invalidating token ${token}`);
        
        await invalidateSessionToken(token);
        
        // invalidateSessionToken likely hashes token then calls deleteOne
        expect(mockSessionDeleteOne).toHaveBeenCalled();
        console.log('Result: Success - Session invalidated.');
    });
});
