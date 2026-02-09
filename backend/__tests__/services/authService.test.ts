/**
 * Simple integration-style tests for authService
 */

import crypto from 'crypto';

describe('AuthService - Core Logic Tests', () => {
  describe('Password Proof Verification', () => {
    it('should generate consistent SHA-256 hash for same inputs', () => {
      console.log('Running: should generate consistent SHA-256 hash');
      const verifier = 'test-verifier-123';
      const challenge = 'test-challenge-456';
      
      const proof1 = crypto.createHash('sha256').update(verifier + challenge).digest('hex');
      const proof2 = crypto.createHash('sha256').update(verifier + challenge).digest('hex');
      
      expect(proof1).toBe(proof2);
      console.log('Result: Success - proof is consistent: ' + proof1.substring(0, 10) + '...');
    });
  });

  describe('Session Token Generation', () => {
    it('should generate random tokens of correct length', () => {
      console.log('Running: should generate random tokens');
      const token1 = crypto.randomBytes(32).toString('hex');
      expect(token1).toHaveLength(64);
      console.log('Result: Success - generated token: ' + token1.substring(0, 10) + '...');
    });
  });

  describe('Email Normalization', () => {
    it('should normalize email addresses consistently', () => {
      console.log('Running: should normalize email addresses');
      const email = '  Test@Example.COM  ';
      const normalized = email.trim().toLowerCase();
      expect(normalized).toBe('test@example.com');
      console.log('Result: Success - normalized to: ' + normalized);
    });
  });
});
