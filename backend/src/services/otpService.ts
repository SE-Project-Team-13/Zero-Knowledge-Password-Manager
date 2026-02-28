import crypto from "crypto"
import { OTP } from "../database/models.js"
import { sendEmail } from "./emailService.js"

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

// Define email sender type matches the imported function signature
type EmailSender = typeof sendEmail;

/**
 * Generates and sends an OTP to the user's registered email address.
 * @param email User's email
 * @param emailSender Optional email sender function for dependency injection (testing)
 */
export async function sendOTP(email: string, emailSender: EmailSender = sendEmail): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    await OTP.deleteMany({ email: normalizedEmail })

    const code = generateOTPCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19)

    await OTP.create({
      email: normalizedEmail,
      code,
      expiresAt,
      verified: false,
    })

    // ... (keep surrounding code)

    const mailOptions = {
      to: normalizedEmail,
      subject: `${code} is your verification code`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <p>Hello,</p>
          <p>Use the following code to verify your account login:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">${code}</p>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #888; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `Your verification code is: ${code}\n\nValid for 10 minutes.\n\nIf you didn't request this, ignore this email.`,
    }

    const isMockEmail = process.env.MOCK_EMAIL === "true"

    if (process.env.SENDGRID_API_KEY && !isMockEmail) {
      // Production: send via SendGrid HTTP API (works on Render, bypasses SMTP blocks)
      await emailSender(mailOptions, "OTP")
    } else if (!isProduction || isDebug || isMockEmail) {
      // In local/dev or mock mode, log the OTP code to the console for manual testing.
      console.log('--------------------------------------------------');
      console.log(`[VaultSync:OTP] 🔐 ${isMockEmail ? 'MOCK' : 'Dev'} MODE ACCESS CODE`);
      console.log(`[VaultSync:OTP] EMAIL: ${normalizedEmail}`);
      console.log(`[VaultSync:OTP] CODE:  ${code}`);
      console.log('--------------------------------------------------');

      if (isMockEmail && isProduction) {
        return { success: true, message: `OTP sent (MOCK MODE: ${code})` }
      }
    } else {
      // In production without SendGrid configured, fail clearly.
      const errorMsg = "SENDGRID_API_KEY is missing. Please configure it in your environment variables or Render dashboard."
      console.error(`[VaultSync:OTP] ${errorMsg}`)
      return { success: false, message: errorMsg }
    }

    return { success: true, message: "OTP sent successfully" }
  } catch (error: any) {
    console.error("[VaultSync:OTP] Error sending OTP:", error)
    return { success: false, message: error.message || "Failed to send OTP" }
  }
}

/**
 * Verify OTP code with rate limiting.
 */
export async function verifyOTP(email: string, code: string): Promise<{ success: boolean; message: string; code?: string }> {
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
    const otp = await OTP.findOne({
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
 */
export async function cleanupExpiredOTPs(): Promise<void> {
  try {
    const now = new Date().toISOString().replace("T", " ").substring(0, 19)
    const result = await OTP.deleteMany({ expiresAt: { $lt: now } })
    if (result.deletedCount > 0) {
      console.log(`[VaultSync:OTP] Cleaned up ${result.deletedCount} expired OTPs`)
    }
  } catch (error) {
    console.error("[VaultSync:OTP] Error cleaning up OTPs:", error)
  }
}
