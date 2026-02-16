
import { jest } from '@jest/globals';
import { verifyClientProof } from '../../../src/services/authService.js';
import crypto from 'crypto';

describe('AuthService - Proof Verification Tests', () => {
    it('verifyClientProof: should return true for valid proof', () => {
        console.log('Test Case 1: Verifying generated proof');
        
        const verifier = 'verifier-hash-123';
        const clientChallenge = 'server-challenge-xyz-456';
        
        // Generate expected proof manually using the same logic the client uses
        // Protocol: SHA256(verifier + challenge)
        const expectedProof = crypto.createHash('sha256').update(verifier + clientChallenge).digest('hex');
        
        console.log(`[Input] Verifier: ${verifier}`);
        console.log(`[Input] Challenge: ${clientChallenge}`);
        console.log(`[Input] Client Proof: ${expectedProof}`);
        
        const isValid = verifyClientProof(verifier, clientChallenge, expectedProof);
        
        console.log(`[Output] Verification Result: ${isValid}`);
        
        expect(isValid).toBe(true);
        console.log('Result: Success - Valid proof accepted.');
    });

    it('verifyClientProof: should return false for invalid proof', () => {
        console.log('Test Case 2: Rejecting invalid proof');
        
        const verifier = 'verifier-hash-123';
        const clientChallenge = 'server-challenge-xyz-456';
        const invalidProof = 'invalid-fake-proof';
        
        const isValid = verifyClientProof(verifier, clientChallenge, invalidProof);
        
        console.log(`[Output] Verification Result: ${isValid}`);
        
        expect(isValid).toBe(false);
        console.log('Result: Success - Invalid proof rejected.');
    });
});
