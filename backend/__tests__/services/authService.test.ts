
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import crypto from 'crypto';

// ------------------------------------------------------------------
// 1. Define Mock Variables
// ------------------------------------------------------------------
const mockUserSave = (jest.fn() as any).mockResolvedValue(true);
const mockUserFindOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn();

// Mock User Class Constructor
const MockUser = jest.fn().mockImplementation((data: any) => ({
    _id: 'mock-new-user-id',
    ...data,
    save: mockUserSave
}));
// Attach static methods to the Mock Class
(MockUser as any).findOne = mockUserFindOne;
(MockUser as any).findById = mockUserFindById;
(MockUser as any).findByIdAndUpdate = mockUserFindByIdAndUpdate;

const mockChallengeSave = (jest.fn() as any).mockResolvedValue(true);
const mockChallengeFindOne = jest.fn();
const mockChallengeDeleteOne = jest.fn();
const MockLoginChallenge = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: mockChallengeSave,
    deleteOne: mockChallengeDeleteOne // Instance method often used
}));
(MockLoginChallenge as any).findOne = mockChallengeFindOne;
(MockLoginChallenge as any).findOneAndUpdate = jest.fn();
(MockLoginChallenge as any).deleteOne = mockChallengeDeleteOne; // Static method sometimes used

const MockSession = jest.fn();
(MockSession as any).findOne = jest.fn();

const mockCheckEmailBreach = (jest.fn() as any).mockResolvedValue(false);
const mockSendOTP = (jest.fn() as any).mockResolvedValue({ success: true });

// ------------------------------------------------------------------
// 2. Register Unstable Mocks (Must be BEFORE imports)
// ------------------------------------------------------------------

jest.unstable_mockModule('../../src/database/models.js', () => ({
    User: MockUser,
    LoginChallenge: MockLoginChallenge,
    Session: MockSession,
    VaultBlob: jest.fn(),
    SyncMetadata: jest.fn(),
    SimpleVault: jest.fn(),
    OTP: jest.fn(),
    RecoveryKey: jest.fn()
}));

jest.unstable_mockModule('../../src/services/breachService.js', () => ({
    checkEmailBreach: mockCheckEmailBreach
}));

jest.unstable_mockModule('../../src/services/otpService.js', () => ({
    sendOTP: mockSendOTP,
    verifyOTP: jest.fn()
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('AuthService Integration Tests', () => {
    let authService: any;
    let registerUser: any;
    let authenticateUser: any;

    beforeAll(async () => {
        // Dynamic import of the service under test
        authService = await import('../../src/services/authService.js');
        registerUser = authService.registerUser;
        authenticateUser = authService.authenticateUser;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
        // Reset default mock behaviors
        mockUserSave.mockResolvedValue(true);
        mockCheckEmailBreach.mockResolvedValue(false);
    });

    it('registerUser: should create a new user and return user object', async () => {
        console.log('Test Case 1: Registering a new user');
        const input = {
            email: 'RegisterTest@example.com',
            fullName: 'Register Test User',
            salt: 'register-salt-123',
            verifier: 'register-verifier-456'
        };
        console.log('Input:', input);

        // User.findOne returns null (user does not exist)
        mockUserFindOne.mockResolvedValue(null as never);

        // Call the service
        const result = await registerUser(input.email, input.fullName, input.salt, input.verifier);
        
        console.log('[Output] Registered User:', result);
        
        expect(MockUser).toHaveBeenCalledTimes(1);
        expect(mockUserSave).toHaveBeenCalled(); // check save was called
        expect(result.email).toBe(input.email.toLowerCase());
        expect(result.fullName).toBe(input.fullName);
        console.log('Result: Success - User registration flow executed correctly.');
    });

    it('authenticateUser: should authenticate successfully with valid proof', async () => {
        console.log('Test Case 2: Authenticating a user with valid proof');
        
        const email = 'auth@example.com';
        const clientChallenge = 'server-challenge-123';
        const verifier = 'stored-verifier';
        
        // Generate valid proof
        // Note: verifyClientProof logic in authService uses crypto
        const validProof = crypto.createHash('sha256').update(verifier + clientChallenge).digest('hex');
        
        console.log(`[Test Setup] Generated Valid Proof: ${validProof}`);

        // Mock User.findOne to return our user
        const mockUserDoc = {
            _id: 'auth-user-id',
            email: email,
            fullName: 'Auth User',
            salt: 'auth-salt',
            verifier: verifier,
            save: mockUserSave
        };
        mockUserFindOne.mockResolvedValue(mockUserDoc as never);

        // Mock LoginChallenge.findOne to return valid challenge
        const mockChallengeDoc = {
            _id: 'challenge-id',
            challenge: clientChallenge,
            expiresAt: new Date(Date.now() + 10000).toISOString().replace('T', ' ').substring(0, 19),
            deleteOne: mockChallengeDeleteOne // Ensure method exists on doc
        };
        mockChallengeFindOne.mockResolvedValue(mockChallengeDoc as never);

        // Call the service
        const result = await authenticateUser(email, clientChallenge, validProof);

        console.log('[Output] Authentication Result:', result);

        expect(mockChallengeFindOne).toHaveBeenCalled();
        // Since deleteOne is called on the document found
        expect(mockChallengeDeleteOne).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        console.log('Result: Success - Authentication successful with valid proof.');
    });

    it('authenticateUser: should fail with invalid proof', async () => {
        console.log('Test Case 3: Authenticating with invalid proof');
        
        const email = 'fail@example.com';
        const clientChallenge = 'server-challenge-123';
        const invalidProof = 'invalid-proof-hash';

        mockUserFindOne.mockResolvedValue({
            email,
            verifier: 'stored-verifier'
        } as never);

        mockChallengeFindOne.mockResolvedValue({
            challenge: clientChallenge,
            expiresAt: new Date(Date.now() + 10000).toISOString().replace('T', ' ').substring(0, 19),
            deleteOne: mockChallengeDeleteOne
        } as never);

        const result = await authenticateUser(email, clientChallenge, invalidProof);

        console.log('[Output] Authentication Result:', result);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Authentication failed');
        console.log('Result: Success - Authentication correctly rejected invalid proof.');
    });
});
