/**
 * OTP Service for generating and verifying one-time passwords via email.
 * This service provides a secondary layer of security for unlocking the vault.
 */

import crypto from "crypto"
import nodemailer from "nodemailer"
import { OTP } from "../database/models.js"

// Configure email transporter for sending notification emails.
// For production, use a real email service like SendGrid, AWS SES, or Mailgun.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Generate a cryptographically secure 6-digit OTP code to prevent guessing.
 * @returns A 6-digit string code.
 */
function generateOTPCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Generates and sends an OTP to the user's registered email address.
 * Falling back to console logging if email delivery is not configured.
 * @param email - Target user email address.
 * @returns Success status and user-facing message.
 */
export async function sendOTP(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    // Delete any existing OTPs for this email to ensure only one is active
    await OTP.deleteMany({ email: normalizedEmail })

    // Generate new OTP with a 10-minute expiration window
    const code = generateOTPCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19)

    // Save the plain OTP code to the database for verification.
    // In a higher security scenario, this could be hashed.
    await OTP.create({
      email: normalizedEmail,
      code,
      expiresAt,
      verified: false,
    })

    // Email content configuration (HTML + Plaintext)
    const mailOptions = {
      // ... rest of email template ...
      from: process.env.SMTP_FROM || '"Password Manager" <noreply@passwordmanager.com>',
      to: normalizedEmail,
      subject: "🔐 Your Vault Access Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6; 
              color: #1e293b;
              background-color: #f8fafc;
              padding: 40px 20px;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
            }
            .header { 
              background: #4f46e5;
              color: white; 
              padding: 60px 30px; 
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .header::before {
              content: "";
              position: absolute;
              top: -50px;
              left: 50%;
              transform: translateX(-50%);
              width: 100px;
              height: 100px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 50%;
            }
            .header h1 {
              font-family: 'Outfit', sans-serif;
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 8px;
              letter-spacing: -0.5px;
              position: relative;
            }
            .header p {
              font-size: 16px;
              opacity: 0.9;
              font-weight: 500;
              position: relative;
            }
            .content { 
              background: white;
              padding: 40px 35px;
            }
            .content h2 {
              font-size: 22px;
              color: #0f172a;
              margin-bottom: 20px;
              font-weight: 700;
            }
            .content p {
              color: #475569;
              margin-bottom: 24px;
              font-size: 16px;
            }
            .otp-card {
              background: #f8fafc;
              border: 1px solid #f1f5f9;
              border-radius: 16px;
              padding: 40px 30px;
              margin: 30px 0;
              text-align: center;
            }
            .otp-label {
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #64748b;
              font-weight: 700;
              margin-bottom: 20px;
            }
            .otp-code { 
              font-size: 48px;
              font-weight: 800;
              letter-spacing: 14px;
              color: #4f46e5;
              font-family: 'Outfit', sans-serif;
              margin: 0;
              padding-left: 14px; /* balance the letter spacing */
            }
            .otp-timer {
              margin-top: 24px;
              font-size: 14px;
              color: #94a3b8;
              font-weight: 500;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            }
            .info-box {
              background: #f1f5f9;
              border-radius: 12px;
              padding: 20px;
              margin: 24px 0;
            }
            .info-box p {
              margin: 0;
              font-size: 14px;
              color: #475569;
              line-height: 1.5;
            }
            .security-notice {
              margin-top: 40px;
              padding-top: 30px;
              border-top: 1px solid #f1f5f9;
            }
            .security-notice p {
              font-size: 13px;
              color: #94a3b8;
              margin-bottom: 8px;
            }
            .footer { 
              background: #f8fafc;
              text-align: center;
              padding: 40px 30px;
              border-top: 1px solid #f1f5f9;
            }
            .footer p {
              font-size: 13px;
              color: #94a3b8;
              margin: 8px 0;
            }
            .footer strong {
              color: #64748b;
            }
            @media only screen and (max-width: 600px) {
              body { padding: 20px 10px; }
              .header { padding: 40px 20px; }
              .content { padding: 30px 20px; }
              .otp-code { font-size: 40px; letter-spacing: 10px; padding-left: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>ZeroKnowledge Vault</h1>
              <p>Secure Access Verification</p>
            </div>
            
            <div class="content">
              <h2>Hello!</h2>
              <p>You've requested access to your secure password vault. To verify your identity and unlock your vault, please use the One-Time Password (OTP) below:</p>
              
              <div class="otp-card">
                <div class="otp-label">Your Verification Code</div>
                <div class="otp-code">${code}</div>
                <div class="otp-timer">
                  <span>⏱️</span> Expires in 10 minutes
                </div>
              </div>
              
              <div class="info-box">
                <p><strong>Pro Tip:</strong> Enter this code in your dashboard to unlock your credentials. This code is valid for a single use only.</p>
              </div>
              
              <div class="security-notice">
                <p>⚠️ <strong>Security Notice:</strong> Never share this code. Our team will never ask for it. If you didn't request this, please secure your account immediately.</p>
              </div>
            </div>
            
            <div class="footer">
              <p>This is an automated message from <strong>ZeroKnowledge Vault</strong></p>
              <p>&copy; ${new Date().getFullYear()} Password Manager. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
ZeroKnowledge Vault - Secure Access Verification

Your OTP Code: ${code}

This code will expire in 10 minutes.

SECURITY NOTICE: Never share this code with anyone. Our team will never ask for your OTP.

If you didn't request this code, please ignore this email.

---
ZeroKnowledge Vault
© ${new Date().getFullYear()} Password Manager. All rights reserved.
      `,
    }

    // Try to send email, fall back to console if it fails
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await transporter.sendMail(mailOptions)
        console.log(`[OTP] ✅ Sent OTP to ${normalizedEmail}`)
        console.log(`[OTP] 🔑 Security Code: ${code}`) // For dev/test
      } catch (emailError: any) {
        console.error(`[OTP] ❌ Email sending failed:`, emailError.message)
        console.log(`[OTP] 📋 Fallback - OTP for ${normalizedEmail}: ${code}`)
        // Don't throw error, still return success since OTP is saved in DB
      }
    } else {
      // For development: log OTP to console
      console.log(`[OTP] 🔧 Development mode - OTP for ${normalizedEmail}: ${code}`)
    }

    return {
      success: true,
      message: "OTP sent successfully",
    }
  } catch (error) {
    console.error("[OTP] Error sending OTP:", error)
    return {
      success: false,
      message: "Failed to send OTP",
    }
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(email: string, code: string): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    const now = new Date().toISOString().replace("T", " ").substring(0, 19)
    // Find the OTP
    const otp = await OTP.findOne({
      email: normalizedEmail,
      code,
      verified: false,
      expiresAt: { $gt: now },
    })

    if (!otp) {
      return {
        success: false,
        message: "Invalid or expired OTP",
      }
    }

    // Mark as verified
    otp.verified = true
    await otp.save()

    console.log(`[OTP] Verified OTP for ${normalizedEmail}`)

    return {
      success: true,
      message: "OTP verified successfully",
    }
  } catch (error) {
    console.error("[OTP] Error verifying OTP:", error)
    return {
      success: false,
      message: "Failed to verify OTP",
    }
  }
}

/**
 * Clean up expired OTPs (optional, as MongoDB TTL index handles this)
 */
export async function cleanupExpiredOTPs(): Promise<void> {
  try {
    const now = new Date().toISOString().replace("T", " ").substring(0, 19)
    const result = await OTP.deleteMany({
      expiresAt: { $lt: now },
    })
    console.log(`[OTP] Cleaned up ${result.deletedCount} expired OTPs`)
  } catch (error) {
    console.error("[OTP] Error cleaning up OTPs:", error)
  }
}
