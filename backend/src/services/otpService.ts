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
      subject: "🔐 Your ZeroPass Vault Access Code",
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ZeroPass Vault Access Code</title>
        </head>
        <body style="margin:0;padding:0;background-color:#0c0d14;font-family:'Helvetica Neue',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0d14;min-height:100vh;padding:40px 16px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                  <!-- Header with logo -->
                  <tr>
                    <td align="center" style="padding-bottom:32px;">
                      <div style="display:inline-flex;align-items:center;gap:10px;">
                        <span style="font-size:28px;">🔐</span>
                        <span style="font-size:22px;font-weight:700;color:#e0f2fe;letter-spacing:-0.5px;">ZeroPass</span>
                      </div>
                    </td>
                  </tr>

                  <!-- Main card -->
                  <tr>
                    <td style="background-color:#111827;border:1px solid #1e3a5f;border-radius:16px;padding:40px 40px 32px;box-shadow:0 0 40px rgba(34,211,238,0.07);">

                      <!-- Title -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding-bottom:8px;">
                            <p style="margin:0;font-size:13px;font-weight:600;color:#22d3ee;text-transform:uppercase;letter-spacing:2px;">Authentication Required</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom:24px;">
                            <h1 style="margin:0;font-size:26px;font-weight:700;color:#f0f9ff;line-height:1.3;">Your Verification Code</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom:28px;">
                            <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.7;">
                              You attempted to access your encrypted vault. Use the code below to complete verification. Never share this code with anyone.
                            </p>
                          </td>
                        </tr>

                        <!-- OTP Code box -->
                        <tr>
                          <td style="padding-bottom:28px;">
                            <div style="background:linear-gradient(135deg,#0f1e3a,#0c1929);border:1px solid #22d3ee;border-radius:12px;padding:28px 20px;text-align:center;box-shadow:0 0 20px rgba(34,211,238,0.1);">
                              <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">One-Time Code</p>
                              <span style="font-size:44px;font-weight:800;color:#22d3ee;letter-spacing:12px;font-family:'Courier New',monospace;">${code}</span>
                            </div>
                          </td>
                        </tr>

                        <!-- Expiry warning -->
                        <tr>
                          <td style="padding-bottom:32px;">
                            <table cellpadding="0" cellspacing="0" style="background-color:#1a1200;border:1px solid #ca8a04;border-radius:8px;padding:12px 16px;width:100%;">
                              <tr>
                                <td>
                                  <p style="margin:0;font-size:13px;color:#fde68a;">
                                    ⏱ &nbsp;This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Divider -->
                        <tr><td style="border-top:1px solid #1e293b;padding-bottom:24px;"></td></tr>

                        <!-- Security note -->
                        <tr>
                          <td>
                            <p style="margin:0;font-size:13px;color:#475569;line-height:1.7;">
                              If you didn't request this code, someone may be attempting to access your vault. Your data remains encrypted and safe. No action is required.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding-top:28px;">
                      <p style="margin:0;font-size:12px;color:#334155;">
                        &copy; ${new Date().getFullYear()} ZeroPass &mdash; Zero-Knowledge Password Manager
                      </p>
                      <p style="margin:6px 0 0;font-size:11px;color:#1e293b;">
                        Your vault is end-to-end encrypted. We never see your passwords.
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
      text: `ZeroPass Vault Access Code\n\nYour one-time verification code is: ${code}\n\nValid for 10 minutes. Do not share this code.\n\nIf you didn't request this, ignore this email — your vault remains secure.`,
    }

    const isMockEmail = process.env.MOCK_EMAIL === "true"

    if (process.env.RESEND_API_KEY && !isMockEmail) {
      // Production: send via Resend HTTP API (works on Render, bypasses SMTP blocks)
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
      // In production without Resend configured, fail clearly.
      const errorMsg = "RESEND_API_KEY is missing. Please configure it in your environment variables or Render dashboard."
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
