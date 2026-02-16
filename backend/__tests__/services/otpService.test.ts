
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import { OTP } from '../../src/database/models.js';

// Mock emailSender
const mockSendEmail = jest.fn().mockImplementation(() => Promise.resolve());

jest.unstable_mockModule('../../src/utils/emailSender.js', () => ({
    sendEmail: mockSendEmail
}));

describe('OTPService Integration Tests', () => {
    let sendOTP: any;
    let verifyOTP: any;

    beforeAll(async () => {
        // Setup mock env vars for email testing
        process.env.SMTP_USER = 'test_user';
        process.env.SMTP_PASS = 'test_pass';

        const otpService = await import('../../src/services/otpService.js');
        sendOTP = otpService.sendOTP;
        verifyOTP = otpService.verifyOTP;
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        // DB cleanup handled by jest.setup.js
    });

    it('sendOTP: should generate OTP, save to DB, and send email', async () => {
        const email = 'otp-test@example.com';
        console.log(`Test Case 1: Sending OTP to ${email}`);

        const result = await sendOTP(email);

        console.log('[Output] sendOTP Result:', result);

        expect(result.success).toBe(true);
        expect(result.success).toBe(true);
        expect(mockSendEmail).toHaveBeenCalled();

        // Verify in DB
        const storedOTP = await OTP.findOne({ email });
        expect(storedOTP).toBeDefined();
        expect(storedOTP?.code).toBeDefined();
        expect(storedOTP?.verified).toBe(false);
    });

    it('verifyOTP: should verify valid OTP and update status', async () => {
        const email = 'verify-test@example.com';
        const code = '123456';
        console.log(`Test Case 2: Verifying OTP ${code} for ${email}`);

        // Scaffolding: Create OTP in DB
        await OTP.create({
            email,
            code,
            expiresAt: new Date(Date.now() + 100000).toISOString(),
            verified: false
        });

        const result = await verifyOTP(email, code);

        console.log('[Output] verifyOTP Result:', result);

        expect(result.success).toBe(true);

        // Verify in DB
        const updatedOTP = await OTP.findOne({ email });
        expect(updatedOTP?.verified).toBe(true);
    });

    it('verifyOTP: should reject invalid OTP', async () => {
        const email = 'verify-test@example.com';
        const code = '000000';
        console.log(`Test Case 3: Verifying Invalid OTP ${code}`);

        // Ensure no OTP exists (handled by afterEach cleanup usually, but to be safe)
        // Calling verify without creating logic should fail or return false
        const result = await verifyOTP(email, code);
        expect(result.success).toBe(false);
    });
});
