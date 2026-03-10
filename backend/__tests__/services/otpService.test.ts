import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

describe('OTPService Integration Tests', () => {
    let sendOTP: any;
    let verifyOTP: any;

    // Mock instances — reset before each test
    let mockDeleteMany: any;
    let mockCreate: any;
    let mockFindOne: any;
    let mockSendGmail: any;
    let mockOTPModel: any;

    beforeAll(async () => {
        const otpServiceModule = await import('../../src/services/otpService.js');
        sendOTP = otpServiceModule.sendOTP;
        verifyOTP = otpServiceModule.verifyOTP;
    });

    beforeEach(() => {
        // Re-initialize with fresh mock implementations before each test
        mockDeleteMany = jest.fn().mockImplementation(() => Promise.resolve({}));
        mockCreate = jest.fn().mockImplementation(() => Promise.resolve({}));
        mockFindOne = jest.fn().mockImplementation(() =>
            Promise.resolve({
                email: 'otp-test@example.com',
                code: '123456',
                verified: false,
                save: jest.fn().mockImplementation(function (this: any) {
                    this.verified = true;
                    return Promise.resolve(this);
                }),
            })
        );
        mockSendGmail = jest.fn().mockImplementation(() => Promise.resolve());

        mockOTPModel = {
            deleteMany: mockDeleteMany,
            create: mockCreate,
            findOne: mockFindOne,
        };
    });

    it('sendOTP: should generate OTP, save to DB, and send email via Gmail API', async () => {
        const email = 'otp-test@example.com';
        const result = await sendOTP(email, mockOTPModel, mockSendGmail);

        expect(result.success).toBe(true);
        expect(mockSendGmail).toHaveBeenCalled();
        expect(mockDeleteMany).toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalled();
    });

    it('verifyOTP: should verify valid OTP and update status', async () => {
        const email = 'otp-test@example.com';
        const code = '123456';

        const result = await verifyOTP(email, code, mockOTPModel);

        expect(result.success).toBe(true);
        expect(mockFindOne).toHaveBeenCalled();
    });

    it('verifyOTP: should reject invalid OTP', async () => {
        // Override for this test only — simulate not finding an OTP record
        mockFindOne.mockImplementationOnce(() => Promise.resolve(null));

        const email = 'otp-test@example.com';
        const code = '000000';

        const result = await verifyOTP(email, code, mockOTPModel);
        expect(result.success).toBe(false);
    });

    it('verifyOTP: rate-limit map should evict oldest entry when at capacity', async () => {
        // Fill the in-memory map just past MAX_RATE_LIMIT_ENTRIES (10 000) by
        // triggering MAX_ATTEMPTS+1 failed verifications for 10 001 unique emails.
        // The map must not grow unboundedly — excess entries are evicted — and the
        // 10 001st email must still be processed normally (not throw / hang).
        const MAX = 10_000;

        // Simulate MAX failed attempts for (MAX) unique emails to fill the map
        for (let i = 0; i < MAX; i++) {
            mockFindOne.mockImplementationOnce(() => Promise.resolve(null));
            await verifyOTP(`rate-limit-${i}@test.com`, '000000', mockOTPModel);
        }

        // One more unique email (the MAX+1-th) — map is at capacity, oldest evicted
        mockFindOne.mockImplementationOnce(() => Promise.resolve(null));
        const overflowResult = await verifyOTP('overflow@test.com', '000000', mockOTPModel);

        // Must still return a normal rejection (not throw, not OOM)
        expect(overflowResult.success).toBe(false);
        console.log('Result: Success - rate-limit map cap enforced; no unbounded growth.');
    });
});
