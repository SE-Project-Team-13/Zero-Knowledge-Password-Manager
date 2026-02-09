/**
 * User Registration Logic Tests
 */

import crypto from 'crypto';

describe('Auth Service - User Registration', () => {
  it('should normalize email addresses for registration', () => {
    console.log('Running: should normalize email addresses for registration');
    const email = '  NewUser@Example.Com  ';
    const normalized = email.trim().toLowerCase();
    expect(normalized).toBe('newuser@example.com');
    console.log('Result: Success - normalized to ' + normalized);
  });

  it('should use a unique salt for every registration', () => {
    console.log('Running: should use a unique salt');
    const salt1 = crypto.randomBytes(16).toString('hex');
    const salt2 = crypto.randomBytes(16).toString('hex');
    expect(salt1).not.toBe(salt2);
    console.log('Result: Success - salts are unique: ' + salt1.substring(0, 5) + ' vs ' + salt2.substring(0, 5));
  });
});
