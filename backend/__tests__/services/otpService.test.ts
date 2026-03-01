import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// 1. Define explicit mock functions
const mockDeleteMany = jest.fn().mockImplementation(() => Promise.resolve({}));
const mockCreate = jest.fn().mockImplementation(() => Promise.resolve({}));
const mockFindOne = jest.fn().mockImplementation(() => Promise.resolve({
    email: 'otp-test@example.com',
    code: '123456',
    verified: false,
    save: jest.fn().mockImplementation(function(this: any) { 
        this.verified = true;
        return Promise.resolve(this); 
    })
}));

const mockOTPModel = {
    deleteMany: mockDeleteMany,
    create: mockCreate,
    findOne: mockFindOne
};

const mockSendGmail = jest.fn().mockImplementation(() => Promise.resolve());

describe('OTPService Integration Tests', () => {
    let sendOTP: any;
    let verifyOTP: any;

    beforeAll(async () => {
        // 3. Import modules straightforwardly
        const otpServiceModule = await import('../../src/services/otpService.js');

        sendOTP = otpServiceModule.sendOTP;
        verifyOTP = otpServiceModule.verifyOTP;
    });

    beforeEach(async () => {
        jest.clearAllMocks();
    });

    it('sendOTP: should generate OTP, save to DB, and send email via Gmail API', async () => {
        const email = 'otp-test@example.com';
        const result = await sendOTP(email, mockOTPModel as any, mockSendGmail as any);

        expect(result.success).toBe(true);
        expect(mockSendGmail).toHaveBeenCalled();

        // Verify in DB mock call
        expect(mockDeleteMany).toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalled();
    });

    it('verifyOTP: should verify valid OTP and update status', async () => {
        const email = 'otp-test@example.com';
        const code = '123456';

        const result = await verifyOTP(email, code, mockOTPModel as any);

        expect(result.success).toBe(true);
        expect(mockFindOne).toHaveBeenCalled();
    });

    it('verifyOTP: should reject invalid OTP', async () => {
        // Setup mock to return null for invalid OTP
        mockFindOne.mockImplementationOnce(() => Promise.resolve(null));

        const email = 'otp-test@example.com';
        const code = '000000';
        
        const result = await verifyOTP(email, code, mockOTPModel as any);
        expect(result.success).toBe(false);
    });
});
