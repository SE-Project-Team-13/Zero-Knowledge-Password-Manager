
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import crypto from 'crypto';
import { User, LoginChallenge, Session } from '../../src/database/models.js';

// Mock Breach Service
const mockCheckEmailBreach = (jest.fn() as any).mockResolvedValue(false);
jest.unstable_mockModule('../../src/services/breachService.js', () => ({
    checkEmailBreach: mockCheckEmailBreach
}));

// Mock OTP Service
const mockSendOTP = (jest.fn() as any).mockResolvedValue({ success: true });
jest.unstable_mockModule('../../src/services/otpService.js', () => ({
    sendOTP: mockSendOTP,
    verifyOTP: jest.fn()
}));

describe('AuthService Integration Tests', () => {
    let authService: any;
    let registerUser: any;
    let authenticateUser: any;

    beforeAll(async () => {
        authService = await import('../../src/services/authService.js');
        registerUser = authService.registerUser;
        authenticateUser = authService.authenticateUser;
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        mockCheckEmailBreach.mockResolvedValue(false);
        // DB cleanup handled by jest.setup.js
    });

    it('registerUser: should create a new user and return user object', async () => {
        console.log('Test Case 1: Registering a new user');
        const input = {
            email: 'RegisterTest@example.com',
            fullName: 'Register Test User',
            salt: 'register-salt-123',
            verifier: 'register-verifier-456'
        };

        const result = await registerUser(input.email, input.fullName, input.salt, input.verifier);

        console.log('[Output] Registered User:', result);

        expect(result.email).toBe(input.email.toLowerCase());
        expect(result.fullName).toBe(input.fullName);

        // Verify in DB
        const userInDb = await User.findOne({ email: input.email.toLowerCase() });
        expect(userInDb).toBeDefined();
        expect(userInDb?.fullName).toBe(input.fullName);
        console.log('Result: Success - User registration flow executed correctly.');
    });

    it('authenticateUser: should authenticate successfully with valid proof', async () => {
        console.log('Test Case 2: Authenticating a user with valid proof');

        const email = 'auth@example.com';
        const clientChallenge = 'server-challenge-123';
        const verifier = 'stored-verifier';

        // Setup: Create User
        const user = await User.create({
            email,
            fullName: 'Auth User',
            salt: 'auth-salt',
            verifier
        });

        // Setup: Create Challenge
        await LoginChallenge.create({
            email,
            challenge: clientChallenge,
            expiresAt: new Date(Date.now() + 10000).toISOString()
        });

        // Generate valid proof: hash(verifier + challenge)
        const validProof = crypto.createHash('sha256').update(verifier + clientChallenge).digest('hex');

        const result = await authenticateUser(email, clientChallenge, validProof);

        console.log('[Output] Authentication Result:', result);

        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();

        // Verify Challenge is deleted
        const challenge = await LoginChallenge.findOne({ email });
        expect(challenge).toBeNull();

        // Verify Session created
        const session = await Session.findOne({ userId: user._id });
        expect(session).toBeDefined();
        console.log('Result: Success - Authentication successful with valid proof.');
    });

    it('authenticateUser: should fail with invalid proof', async () => {
        console.log('Test Case 3: Authenticating with invalid proof');

        const email = 'fail@example.com';
        const clientChallenge = 'server-challenge-123';
        const invalidProof = 'invalid-proof-hash';

        // Setup: Create User
        await User.create({
            email,
            fullName: 'Auth User',
            salt: 'auth-salt',
            verifier: 'stored-verifier'
        });

        // Setup: Create Challenge
        await LoginChallenge.create({
            email,
            challenge: clientChallenge,
            expiresAt: new Date(Date.now() + 10000).toISOString()
        });

        const result = await authenticateUser(email, clientChallenge, invalidProof);

        console.log('[Output] Authentication Result:', result);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Authentication failed');
        console.log('Result: Success - Authentication correctly rejected invalid proof.');
    });
});
