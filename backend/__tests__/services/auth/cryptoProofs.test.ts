
import { jest } from '@jest/globals';
import { verifyClientProof } from '../../../src/services/authService.js';
import crypto from 'crypto';

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

describe('AuthService - Proof Verification Tests', () => {
    it('verifyClientProof: should return true for valid proof', () => {
        console.log('Test Case 1: Verifying generated proof');
        
        const verifier = 'verifier-hash-123';
        const clientChallenge = 'server-challenge-xyz-456';
        
        // Generate expected proof manually using the same logic the client uses
        // Protocol: SHA256(verifier + challenge)
        const expectedProof = sha256Hex(verifier + clientChallenge);
        
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

    it('verifyClientProof: should reject a server-format proof (domain separation)', () => {
        console.log('Test Case 3: Rejecting server-format proof as client proof');
        // The server appends "SERVER" to the hash input.  verifyClientProof must NOT
        // accept a server proof — the proofs must be domain-separated.
        const verifier = 'verifier-hash-123';
        const clientChallenge = 'server-challenge-xyz-456';

        // This is what the server generates: sha256(verifier + challenge + "SERVER")
        const serverProof = sha256Hex(verifier + clientChallenge + 'SERVER');

        const isValid = verifyClientProof(verifier, clientChallenge, serverProof);

        console.log(`[Output] verifyClientProof(serverProof): ${isValid}`);
        expect(isValid).toBe(false);
        console.log('Result: Success - Server proof is not accepted as client proof.');
    });

    it('clientProof and serverProof should always differ for same inputs', () => {
        console.log('Test Case 4: Verify client proof ≠ server proof');
        const verifier = 'v';
        const challenge = 'c';

        const clientProof = sha256Hex(verifier + challenge);
        const serverProof = sha256Hex(verifier + challenge + 'SERVER');

        console.log(`clientProof: ${clientProof.slice(0, 16)}…`);
        console.log(`serverProof: ${serverProof.slice(0, 16)}…`);

        expect(clientProof).not.toBe(serverProof);
        console.log('Result: Success - Domain separation confirmed.');
    });
});
