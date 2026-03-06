import { Session, User } from '../../../src/database/models.js';
import * as authService from '../../../src/services/authService.js';
import mongoose from 'mongoose';

describe('AuthService - Session Management Integration Tests', () => {

    // DB cleanup is handled by jest.setup.ts

    it('generateSessionToken: should create a new session and return token', async () => {
        const userId = new mongoose.Types.ObjectId().toString(); // Valid ObjectId
        const expirationMinutes = 60;

        console.log(`Test Case 1: Generating session for User ${userId}`);
        
        // Ensure user exists for population
        await User.create({ _id: userId, email: 'session-test@example.com', fullName: 'Session Test', salt: 's', verifier: 'v' });

        const token = await authService.generateSessionToken(userId, expirationMinutes);

        console.log(`[Output] Generated Token: ${token}`);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);

        // Verify Session creation in DB
        const session = await Session.findOne({ userId });
        expect(session).not.toBeNull();
        expect(session?.userId.toString()).toBe(userId);
        expect(session?.token).not.toBe(token); // Should be hashed

        console.log('Result: Success - Session record created.');
    });

    it('validateSessionToken: should validate a correct token', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        // Ensure user exists for population in validateSessionToken
        await User.create({ _id: userId, email: 'validate-test@example.com', fullName: 'Validate Test', salt: 's', verifier: 'v' });
        // We first generate a real session to get a valid token and hash in DB
        const token = await authService.generateSessionToken(userId);

        console.log(`Test Case 2: Validating token ${token}`);

        const result = await authService.validateSessionToken(token);

        console.log('[Output] Validation Result:', result);

        expect(result.valid).toBe(true);
        expect(result.userId).toBe(userId);

        console.log('Result: Success - Valid token confirmed.');
    });

    it('validateSessionToken: should reject invalid token', async () => {
        const token = 'invalid-token-xyz';
        console.log(`Test Case 2b: Validating invalid token`);

        const result = await authService.validateSessionToken(token);
        expect(result.valid).toBe(false);
    });

    it('invalidateSessionToken: should delete the session', async () => {
        const userId = new mongoose.Types.ObjectId().toString();
        // Ensure user exists
        await User.create({ _id: userId, email: 'invalidate-test@example.com', fullName: 'Invalidate Test', salt: 's', verifier: 'v' });
        const token = await authService.generateSessionToken(userId);

        console.log(`Test Case 3: Invalidating token ${token}`);

        // Confirm it exists first
        let session = await Session.findOne({ userId });
        expect(session).not.toBeNull();

        await authService.invalidateSessionToken(token);

        // Verify deletion
        session = await Session.findOne({ userId });
        expect(session).toBeNull();

        console.log('Result: Success - Session invalidated.');
    });
});
