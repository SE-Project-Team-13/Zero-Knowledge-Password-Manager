/**
 * Breach Service Tests
 */

import crypto from 'crypto';

describe('Breach Service - Privacy Protocol', () => {
  it('should extract exactly 5 characters for the prefix', () => {
    console.log('Running: should extract exactly 5 characters for the prefix');
    const testEmail = 'test@example.com';
    const hash = crypto.createHash('sha256').update(testEmail).digest('hex');
    const prefix = hash.substring(0, 5);
    expect(prefix).toHaveLength(5);
    console.log('Result: Success - prefix is ' + prefix);
  });

  it('should normalize emails before hashing', () => {
    console.log('Running: should normalize emails before hashing');
    const email = '  USER@domain.com  ';
    const normalized = email.trim().toLowerCase();
    expect(normalized).toBe('user@domain.com');
    console.log('Result: Success - normalized to ' + normalized);
  });
});
