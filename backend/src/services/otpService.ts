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
      subject: "🔐 Your Vault Access Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
            .header { text-align: center; padding-bottom: 20px; }
            .otp-code { font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 5px; color: #4f46e5; margin: 20px 0; }
            .footer { font-size: 12px; color: #888; text-align: center; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Vault Access</h1></div>
            <p>Verification Code:</p>
            <div class="otp-code">${code}</div>
            <p>Valid for 10 minutes.</p>
            <div class="footer">&copy; ${new Date().getFullYear()} Password Manager</div>
          </div>
        </body>
        </html>
      `,
      text: `Your Vault Access Code: ${code}\nValid for 10 minutes.`,
    }

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await emailSender(mailOptions, "OTP")
    } else if (!isProduction || isDebug) {
      // In local/dev we allow OTP without SMTP and log the code for manual testing.
      console.log(`[VaultSync:OTP] Dev mode OTP for ${normalizedEmail}: ${code}`)
    } else {
      // In production, OTP must not report success when email service is not configured.
      const errorMsg = "SMTP credentials (SMTP_USER, SMTP_PASS) are missing in production environment. OTP cannot be sent."
      console.error(`[VaultSync:OTP] ${errorMsg}`)
      return { success: false, message: errorMsg }
    }

    return { success: true, message: "OTP sent successfully" }
  } catch (error) {
    console.error("[VaultSync:OTP] Error sending OTP:", error)
    return { success: false, message: "Failed to send OTP" }
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
