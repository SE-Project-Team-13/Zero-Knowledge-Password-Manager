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
});
