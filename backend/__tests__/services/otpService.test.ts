
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';

// ------------------------------------------------------------------
// 1. Define Mocks
// ------------------------------------------------------------------
const mockOtpSave = (jest.fn() as any).mockResolvedValue(true);
const mockOtpFindOne = jest.fn();
const mockOtpDeleteMany = jest.fn();
const mockOtpCreate = jest.fn();

const MockOTP = jest.fn().mockImplementation((data: any) => ({
    ...data,
    save: mockOtpSave
}));
(MockOTP as any).findOne = mockOtpFindOne;
(MockOTP as any).deleteMany = mockOtpDeleteMany;
(MockOTP as any).create = mockOtpCreate;

const mockSendMail = (jest.fn() as any).mockImplementation(() => {
    console.log('[Mock] sendMail called');
    return Promise.resolve({ messageId: 'test-message-id' });
});
const mockCreateTransport = jest.fn().mockImplementation(() => {
    console.log('[Mock] createTransport called');
    return {
        sendMail: mockSendMail
    };
});

// ------------------------------------------------------------------
// 2. Register Unstable Mocks
// ------------------------------------------------------------------
jest.unstable_mockModule('../../src/database/models.js', () => ({
    OTP: MockOTP
}));

jest.unstable_mockModule('nodemailer', () => ({
    default: {
        createTransport: mockCreateTransport
    },
    createTransport: mockCreateTransport
}));

// ------------------------------------------------------------------
// 3. Test Suite
// ------------------------------------------------------------------
describe('OTPService Integration Tests', () => {
    let sendOTP: any;
    let verifyOTP: any;

    beforeAll(async () => {
        const otpService = await import('../../src/services/otpService.js');
        sendOTP = otpService.sendOTP;
        verifyOTP = otpService.verifyOTP;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        console.log('\n---------------------------------------------------');
        // Reset defaults
        process.env.SMTP_USER = 'test-user';
        process.env.SMTP_PASS = 'test-pass';
        
        mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
        mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
        mockOtpSave.mockResolvedValue(true);
    });

    it('sendOTP: should generate OTP, save to DB, and send email', async () => {
        const email = 'otp-test@example.com';
        console.log(`Test Case 1: Sending OTP to ${email}`);

        // Mock OTP.create implementation to log what it receives
        mockOtpCreate.mockImplementation(async (data: any) => {
             console.log('[MockDB] Creating OTP record:', { 
                 email: data.email, 
                 code: data.code, 
                 verified: data.verified 
            });
             return data;
        });

        const result = await sendOTP(email);

        console.log('[Output] sendOTP Result:', result);
        
        expect(mockOtpDeleteMany).toHaveBeenCalledWith({ email: email.toLowerCase() });
        expect(mockOtpCreate).toHaveBeenCalled();
        expect(mockSendMail).toHaveBeenCalled();
        
        // specific check on email arguments
        const mailOptions: any = mockSendMail.mock.calls[0][0];
        console.log(`[MockEmail] Destination: ${mailOptions.to}`);
        console.log(`[MockEmail] Subject: ${mailOptions.subject}`);
        
        expect(result.success).toBe(true);
        console.log('Result: Success - OTP generation and transmission flow verified.');
    });

    it('verifyOTP: should verify valid OTP and update status', async () => {
        const email = 'verify-test@example.com';
        const code = '123456';
        console.log(`Test Case 2: Verifying OTP ${code} for ${email}`);

        const mockOtpDoc = {
            email,
            code,
            verified: false,
            expiresAt: new Date(Date.now() + 100000).toISOString(),
            save: mockOtpSave
        };

        mockOtpFindOne.mockResolvedValue(mockOtpDoc as never);

        const result = await verifyOTP(email, code);

        console.log('[Output] verifyOTP Result:', result);
        
        expect(mockOtpFindOne).toHaveBeenCalled();
        expect(mockOtpSave).toHaveBeenCalled();
        // Since we are checking if the property was set on the object we returned
        // The service usually modifies the object returned by Mongoose
        expect(mockOtpDoc.verified).toBe(true);
        expect(result.success).toBe(true);
        console.log('Result: Success - OTP verified and marked as used.');
    });

    it('verifyOTP: should reject invalid OTP', async () => {
        const email = 'verify-test@example.com';
        const code = '000000';
        console.log(`Test Case 3: Verifying Invalid OTP ${code}`);

        mockOtpFindOne.mockResolvedValue(null as never);

        const result = await verifyOTP(email, code);

        console.log('[Output] verifyOTP Result:', result);
        expect(result.success).toBe(false);
        console.log('Result: Success - Invalid OTP correctly rejected.');
    });
});
