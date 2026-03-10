/**
 * ZKP Auth Utility Tests
 *
 * Covers: generateVerifier, generateClientProof, verifyServerProof
 */

import { generateVerifier, generateClientProof, verifyServerProof } from '../src/auth';
import { sha256 } from '@noble/hashes/sha2.js';
import { TextEncoder, TextDecoder } from 'util';
import * as cryptoModule from 'crypto';

// Polyfill for Node environment
if (!global.crypto) {
  // @ts-ignore
  global.crypto = cryptoModule.webcrypto;
}
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

/** Helper: build the hex string from a sha256 of raw bytes */
function sha256Hex(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const hash = sha256(bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('Crypto Engine - ZKP Auth Utilities', () => {

  describe('generateVerifier', () => {
    it('should return a non-empty hex string from authKey', async () => {
      console.log('\n--- Test: generateVerifier basic output ---');
      const authKey = cryptoModule.getRandomValues(new Uint8Array(32));
      const verifier = await generateVerifier(authKey);
      console.log(`[Output] verifier (first 16 chars): ${verifier.slice(0, 16)}…`);
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBe(64); // sha256 → 32 bytes → 64 hex chars
      expect(/^[0-9a-f]+$/.test(verifier)).toBe(true);
      console.log('Result: Success – verifier is a valid 64-char hex string.');
    });

    it('should produce deterministic output for the same authKey', async () => {
      console.log('\n--- Test: generateVerifier determinism ---');
      const authKey = new Uint8Array(32).fill(0xab);
      const v1 = await generateVerifier(authKey);
      const v2 = await generateVerifier(authKey);
      expect(v1).toBe(v2);
      console.log('Result: Success – verifier is deterministic.');
    });

    it('should produce different verifiers for different authKeys', async () => {
      console.log('\n--- Test: generateVerifier uniqueness ---');
      const authKey1 = new Uint8Array(32).fill(0x01);
      const authKey2 = new Uint8Array(32).fill(0x02);
      const v1 = await generateVerifier(authKey1);
      const v2 = await generateVerifier(authKey2);
      expect(v1).not.toBe(v2);
      console.log('Result: Success – different authKeys produce different verifiers.');
    });
  });

  describe('generateClientProof', () => {
    it('should produce a hex string from verifier + challenge', async () => {
      console.log('\n--- Test: generateClientProof basic output ---');
      const verifier = 'aabbccdd';
      const challenge = '11223344';
      const proof = await generateClientProof(verifier, challenge);
      console.log(`[Output] clientProof (first 16 chars): ${proof.slice(0, 16)}…`);
      expect(typeof proof).toBe('string');
      expect(proof.length).toBe(64);
      expect(/^[0-9a-f]+$/.test(proof)).toBe(true);
      console.log('Result: Success – clientProof is a valid hex string.');
    });

    it('should match sha256(verifier + challenge)', async () => {
      console.log('\n--- Test: generateClientProof matches expected hash ---');
      const verifier = 'test-verifier-hex';
      const challenge = 'test-challenge-hex';
      const proof = await generateClientProof(verifier, challenge);
      const expected = sha256Hex(verifier + challenge);
      expect(proof).toBe(expected);
      console.log('Result: Success – clientProof matches sha256(verifier+challenge).');
    });
  });

  describe('verifyServerProof', () => {
    it('should return true for SHA256(verifier + challenge + "SERVER")', () => {
      console.log('\n--- Test: verifyServerProof – accepts correct server proof ---');
      const verifier = 'server-verify-test';
      const challenge = 'challenge-abc';
      // Build the proof the server generates
      const correctServerProof = sha256Hex(verifier + challenge + 'SERVER');
      const result = verifyServerProof(verifier, challenge, correctServerProof);
      console.log(`[Output] isServerAuthentic: ${result}`);
      expect(result).toBe(true);
      console.log('Result: Success – valid server proof accepted.');
    });

    it('should return false for a client proof (sha256 without "SERVER" suffix)', () => {
      console.log('\n--- Test: verifyServerProof – rejects client proof (MITM replay scenario) ---');
      const verifier = 'server-verify-test';
      const challenge = 'challenge-abc';
      // A MITM server would echo back the clientProof = sha256(verifier + challenge)
      const clientProof = sha256Hex(verifier + challenge);
      const result = verifyServerProof(verifier, challenge, clientProof);
      console.log(`[Output] isServerAuthentic (should be false): ${result}`);
      expect(result).toBe(false);
      console.log('Result: Success – client-format proof correctly rejected (prevents MITM replay).');
    });

    it('should return false for a tampered proof', () => {
      console.log('\n--- Test: verifyServerProof – rejects tampered proof ---');
      const verifier = 'server-verify-test';
      const challenge = 'challenge-abc';
      const result = verifyServerProof(verifier, challenge, 'deadbeef'.repeat(8));
      expect(result).toBe(false);
      console.log('Result: Success – tampered proof rejected.');
    });

    it('clientProof and serverProof should always differ for same inputs', async () => {
      console.log('\n--- Test: client proof ≠ server proof (domain separation) ---');
      const verifier = 'shared-verifier';
      const challenge = 'shared-challenge';
      const clientProof = await generateClientProof(verifier, challenge);
      const serverProof = sha256Hex(verifier + challenge + 'SERVER');
      expect(clientProof).not.toBe(serverProof);
      console.log(`clientProof: ${clientProof.slice(0, 16)}…`);
      console.log(`serverProof: ${serverProof.slice(0, 16)}…`);
      console.log('Result: Success – domain separation confirmed; proofs are always distinct.');
    });
  });
});
