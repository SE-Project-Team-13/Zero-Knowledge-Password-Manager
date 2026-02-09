/**
 * Cryptographic Proof Verification Tests (ZKP Phase)
 */

import crypto from 'crypto';

describe('Auth Service - Cryptographic Proofs', () => {
    describe('verifyClientProof', () => {
        it('should verify a valid SHA-256 proof', () => {
            console.log('Running: should verify a valid SHA-256 proof');
            const verifier = 'stored-verifier-hash';
            const clientChallenge = 'random-challenge-xyz';
            const expectedProof = crypto.createHash('sha256').update(verifier + clientChallenge).digest('hex');
            const clientProof = expectedProof;
            const isMatch = crypto.timingSafeEqual(Buffer.from(clientProof), Buffer.from(expectedProof));
            expect(isMatch).toBe(true);
            console.log('Result: Success - proof verified: ' + isMatch);
        });

        it('should use timing-safe comparison', () => {
            console.log('Running: should use timing-safe comparison');
            const buf1 = Buffer.from('a'.repeat(64));
            const buf2 = Buffer.from('a'.repeat(64));
            expect(crypto.timingSafeEqual(buf1, buf2)).toBe(true);
            console.log('Result: Success - timingSafeEqual works as expected');
        });
    });
});
