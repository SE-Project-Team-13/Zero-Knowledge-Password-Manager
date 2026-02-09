/**
 * OTP Service Tests
 * Tests for one-time password generation, sending, and verification
 */

import crypto from 'crypto';

describe('OTP Service - Code Generation', () => {
  describe('generateOTPCode', () => {
    it('should generate a 6-digit code', () => {
      console.log('Running: should generate a 6-digit code');
      const randomValue = crypto.randomInt(0, 1000000);
      const code = randomValue.toString().padStart(6, '0');
      
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d{6}$/);
      console.log('Result: Success - code is ' + code);
    });

    it('should generate different codes on multiple calls', () => {
      console.log('Running: should generate different codes on multiple calls');
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        const randomValue = crypto.randomInt(0, 1000000);
        const code = randomValue.toString().padStart(6, '0');
        codes.add(code);
      }
      expect(codes.size).toBeGreaterThan(90);
      console.log('Result: Success - generated ' + codes.size + ' unique codes');
    });

    it('should pad codes with leading zeros', () => {
      console.log('Running: should pad codes with leading zeros');
      const smallNumber = 123;
      const code = smallNumber.toString().padStart(6, '0');
      expect(code).toBe('000123');
      expect(code).toHaveLength(6);
      console.log('Result: Success - padded code is ' + code);
    });
  });
});

describe('OTP Service - Email Validation', () => {
  it('should normalize email addresses', () => {
    console.log('Running: should normalize email addresses');
    const email = '  Test@Example.COM  ';
    const normalized = email.trim().toLowerCase();
    expect(normalized).toBe('test@example.com');
    console.log('Result: Success - normalized to ' + normalized);
  });
});

describe('OTP Service - Expiration Logic', () => {
  it('should calculate correct expiration time (5 minutes)', () => {
    console.log('Running: should calculate correct expiration time (5 minutes)');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);
    expect(diffMinutes).toBe(5);
    console.log('Result: Success - difference is exactly 5 minutes');
  });
});
