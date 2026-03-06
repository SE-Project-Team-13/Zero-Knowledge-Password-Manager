import crypto from "crypto";
import { OTP } from "../database/models.js";
import { sendGmail } from "./gmailService.js";

const isProduction = process.env.NODE_ENV === "production";
const isDebug = process.env.DEBUG === "true";

// Rate limiting state (In-memory)
const otpAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// Log active email mode at startup
const isMockEmailMode = process.env.MOCK_EMAIL === "true";
if (isMockEmailMode) {
  console.warn(
    "[VaultSync:OTP] ⚠️  MOCK EMAIL MODE IS ACTIVE — OTPs will be logged to console, NOT emailed.",
  );
} else {
  const hasGmailCredentials =
    !!process.env.GMAIL_CLIENT_ID &&
    !!process.env.GMAIL_CLIENT_SECRET &&
    !!process.env.GMAIL_REFRESH_TOKEN &&
    !!process.env.GMAIL_USER_EMAIL;
  if (hasGmailCredentials) {
    console.log(
      `[VaultSync:OTP] ✅ Real Gmail API mode active — emails will be sent from ${process.env.GMAIL_USER_EMAIL}`,
    );
  } else {
    console.error(
      "[VaultSync:OTP] ❌ MISSING Gmail credentials! Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL in .env",
    );
  }
}

/**
 * Generate a cryptographically secure 6-digit OTP code.
 */
function generateOTPCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Define email options type
interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Generates and sends an OTP to the user's registered email address.
 * @param email User's email
 * @param otpModel Optional OTP model for dependency injection (testing)
 * @param emailSender Optional email sender function for dependency injection (testing)
 */
export async function sendOTP(
  email: string,
  otpModel = OTP,
  emailSender = sendGmail,
): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    await otpModel.deleteMany({ email: normalizedEmail });

    const code = generateOTPCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await otpModel.create({
      email: normalizedEmail,
      code,
      expiresAt,
      verified: false,
    });

    // ... (keep surrounding code)

    const mailOptions = {
      to: normalizedEmail,
      subject: `Verification Code: ${code}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="margin:0;padding:20px;background-color:#FFFFFF;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#333333;line-height:1.6;">
          <div style="max-width:600px;margin:0 auto;">
            <p style="font-size:18px;font-weight:600;margin-bottom:16px;">Zenith Vault Verification</p>
            <p>To secure your encrypted vault, please use the following one-time code to complete your sign-in:</p>
            
            <p style="font-size:32px;font-weight:bold;letter-spacing:4px;margin:24px 0;color:#1a1a1a;">${code}</p>
            
            <p style="font-size:14px;color:#666666;">This code expires in 10 minutes.</p>
            
            <p style="margin-top:32px;font-size:13px;color:#888888;border-top:1px solid #eeeeee;padding-top:16px;">
              <strong>Security Note:</strong> If you did not request this code, your vault remains encrypted and secure. You can safely ignore this email.
            </p>
            <p style="font-size:12px;color:#999999;">
              &copy; ${new Date().getFullYear()} Zenith Vault. End-to-end encrypted password management.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Zenith Vault Verification Code: ${code}\n\nTo access your encrypted vault, please use this one-time code: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, you can safely ignore this email — your vault remains secure.`,
    };

    const isMockEmail = process.env.MOCK_EMAIL === "true";

    if (!isMockEmail) {
      // Send via Gmail API (real email delivery)
      try {
        await emailSender(mailOptions, "OTP");
      } catch (gmailError: any) {
        console.error(
          "[VaultSync:OTP] ❌ Gmail API failed to send OTP:",
          gmailError.message,
        );
        // Clean up the stored OTP since email failed
        await otpModel.deleteMany({ email: normalizedEmail });
        return {
          success: false,
          message: `Failed to send OTP email: ${gmailError.message}`,
        };
      }
    } else {
      // In mock mode, log the OTP code to the console
      console.log("--------------------------------------------------");
      console.log(`[VaultSync:OTP] 🔐 MOCK MODE ACCESS CODE (MOCK_EMAIL=true)`);
      console.log(`[VaultSync:OTP] EMAIL: ${normalizedEmail}`);
      console.log(`[VaultSync:OTP] CODE:  ${code}`);
      console.log("--------------------------------------------------");
    }

    return { success: true, message: "OTP sent successfully" };
  } catch (error: any) {
    console.error("[VaultSync:OTP] Error sending OTP:", error);
    return { success: false, message: error.message || "Failed to send OTP" };
  }
}

/**
 * Verify OTP code with rate limiting.
 * @param email User's email
 * @param code OTP code
 * @param otpModel Optional OTP model for dependency injection (testing)
 */
export async function verifyOTP(
  email: string,
  code: string,
  otpModel = OTP,
): Promise<{ success: boolean; message: string; code?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limit
    const attempts = otpAttempts.get(normalizedEmail);
    if (
      attempts &&
      attempts.count >= MAX_ATTEMPTS &&
      Date.now() - attempts.lastAttempt < LOCKOUT_TIME
    ) {
      return {
        success: false,
        message: "Too many failed attempts. Please try again in 15 minutes.",
        code: "RATE_LIMIT_EXCEEDED",
      };
    }

    const otp = await otpModel.findOne({
      email: normalizedEmail,
      code,
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) {
      const current = attempts || { count: 0, lastAttempt: Date.now() };
      otpAttempts.set(normalizedEmail, {
        count: current.count + 1,
        lastAttempt: Date.now(),
      });
      return { success: false, message: "Invalid or expired OTP" };
    }

    otp.verified = true;
    await otp.save();
    otpAttempts.delete(normalizedEmail);

    if (!isProduction || isDebug) {
      console.log(`[VaultSync:OTP] Verified OTP for ${normalizedEmail}`);
    }

    return { success: true, message: "OTP verified successfully" };
  } catch (error) {
    console.error("[VaultSync:OTP] Error verifying OTP:", error);
    return { success: false, message: "Failed to verify OTP" };
  }
}

/**
 * Clean up expired OTPs.
 * @param otpModel Optional OTP model for dependency injection (testing)
 */
export async function cleanupExpiredOTPs(otpModel = OTP): Promise<void> {
  try {
    const result = await otpModel.deleteMany({ expiresAt: { $lt: new Date() } });
    if (result.deletedCount > 0) {
      console.log(
        `[VaultSync:OTP] Cleaned up ${result.deletedCount} expired OTPs`,
      );
    }
  } catch (error) {
    console.error("[VaultSync:OTP] Error cleaning up OTPs:", error);
  }
}
