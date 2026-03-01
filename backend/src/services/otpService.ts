import crypto from "crypto"
import { OTP } from "../database/models.js"
import { sendGmail } from "./gmailService.js"

const isProduction = process.env.NODE_ENV === "production"
const isDebug = process.env.DEBUG === "true"

// Rate limiting state (In-memory)
const otpAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_TIME = 15 * 60 * 1000 // 15 minutes

/**
 * Generate a cryptographically secure 6-digit OTP code.
 */
function generateOTPCode(): string {
  return crypto.randomInt(100000, 999999).toString()
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
export async function sendOTP(email: string, otpModel = OTP, emailSender = sendGmail): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    await otpModel.deleteMany({ email: normalizedEmail })

    const code = generateOTPCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19)

    await otpModel.create({
      email: normalizedEmail,
      code,
      expiresAt,
      verified: false,
    })

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
        <body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:48px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
                  <!-- Header -->
                  <tr>
                    <td style="padding:40px 40px 0;text-align:center;">
                      <div style="margin-bottom:24px;">
                        <span style="font-size:32px;display:inline-block;margin-bottom:8px;">🔐</span>
                        <h1 style="margin:0;font-size:24px;color:#1e293b;font-weight:700;letter-spacing:-0.025em;">ZeroPass</h1>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding:0 40px 40px;">
                      <h2 style="margin:0 0 12px;font-size:18px;color:#334155;font-weight:600;text-align:center;">Verification Required</h2>
                      <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#64748b;text-align:center;">
                        To secure your encrypted vault, please use the following one-time code to complete your sign-in:
                      </p>
                      
                      <!-- OTP Code Box -->
                      <div style="background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:32px;text-align:center;margin-bottom:32px;">
                        <span style="font-size:42px;font-weight:800;color:#0284c7;letter-spacing:8px;font-family:monospace;display:block;">${code}</span>
                      </div>
                      
                      <div style="text-align:center;margin-bottom:32px;">
                        <p style="margin:0;font-size:14px;color:#94a3b8;display:flex;align-items:center;justify-content:center;">
                          ⏱ Expires in 10 minutes
                        </p>
                      </div>
                      
                      <hr style="border:0;border-top:1px solid #f1f5f9;margin:32px 0;">
                      
                      <div style="background-color:#fff7ed;border-radius:8px;padding:16px;border:1px solid #ffedd5;">
                        <p style="margin:0;font-size:13px;line-height:1.5;color:#9a3412;">
                          <strong>Security Note:</strong> If you did not request this code, your vault remains encrypted and secure. You can safely ignore this email.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding:0 40px 40px;text-align:center;">
                      <p style="margin:0;font-size:12px;color:#cbd5e1;">
                        &copy; ${new Date().getFullYear()} ZeroPass. End-to-end encrypted password management.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `ZeroPass Verification Code: ${code}\n\nTo access your encrypted vault, please use this one-time code: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, you can safely ignore this email — your vault remains secure.`,
    }

    const isMockEmail = process.env.MOCK_EMAIL === "true"

    if (!isMockEmail) {
      // Send via Gmail API (Primary and only production method)
      await emailSender(mailOptions, "OTP")
    } else {
      // In mock mode, log the OTP code to the console
      console.log('--------------------------------------------------');
      console.log(`[VaultSync:OTP] 🔐 MOCK MODE ACCESS CODE`);
      console.log(`[VaultSync:OTP] EMAIL: ${normalizedEmail}`);
      console.log(`[VaultSync:OTP] CODE:  ${code}`);
      console.log('--------------------------------------------------');

      if (isProduction) {
        return { success: true, message: `OTP sent (MOCK MODE: ${code})` }
      }
    }

    return { success: true, message: "OTP sent successfully" }
  } catch (error: any) {
    console.error("[VaultSync:OTP] Error sending OTP:", error)
    return { success: false, message: error.message || "Failed to send OTP" }
  }
}

/**
 * Verify OTP code with rate limiting.
 * @param email User's email
 * @param code OTP code
 * @param otpModel Optional OTP model for dependency injection (testing)
 */
export async function verifyOTP(email: string, code: string, otpModel = OTP): Promise<{ success: boolean; message: string; code?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase()

    // Check rate limit
    const attempts = otpAttempts.get(normalizedEmail)
    if (attempts && attempts.count >= MAX_ATTEMPTS && Date.now() - attempts.lastAttempt < LOCKOUT_TIME) {
      return {
        success: false,
        message: "Too many failed attempts. Please try again in 15 minutes.",
        code: "RATE_LIMIT_EXCEEDED"
      }
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19)
    const otp = await otpModel.findOne({
      email: normalizedEmail,
      code,
      verified: false,
      expiresAt: { $gt: now },
    })

    if (!otp) {
      const current = attempts || { count: 0, lastAttempt: Date.now() }
      otpAttempts.set(normalizedEmail, {
        count: current.count + 1,
        lastAttempt: Date.now()
      })
      return { success: false, message: "Invalid or expired OTP" }
    }

    otp.verified = true
    await otp.save()
    otpAttempts.delete(normalizedEmail)

    if (!isProduction || isDebug) {
      console.log(`[VaultSync:OTP] Verified OTP for ${normalizedEmail}`)
    }

    return { success: true, message: "OTP verified successfully" }
  } catch (error) {
    console.error("[VaultSync:OTP] Error verifying OTP:", error)
    return { success: false, message: "Failed to verify OTP" }
  }
}

/**
 * Clean up expired OTPs.
 * @param otpModel Optional OTP model for dependency injection (testing)
 */
export async function cleanupExpiredOTPs(otpModel = OTP): Promise<void> {
  try {
    const now = new Date().toISOString().replace("T", " ").substring(0, 19)
    const result = await otpModel.deleteMany({ expiresAt: { $lt: now } })
    if (result.deletedCount > 0) {
      console.log(`[VaultSync:OTP] Cleaned up ${result.deletedCount} expired OTPs`)
    }
  } catch (error) {
    console.error("[VaultSync:OTP] Error cleaning up OTPs:", error)
  }
}
