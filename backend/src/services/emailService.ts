
import nodemailer from "nodemailer"

const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10)
const smtpSecure = smtpPort === 465

// Configure email transporter for sending notification emails.
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: smtpPort,
    secure: smtpSecure,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
})

const isProduction = process.env.NODE_ENV === "production"
const isDebug = process.env.DEBUG === "true"

export interface MailOptions {
    from?: string;
    to: string;
    subject: string;
    html: string;
    text: string;
}

/**
 * Sends an email using the configured transporter.
 */
export async function sendEmail(options: MailOptions, contextInfo?: string): Promise<void> {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            await transporter.sendMail({
                from: process.env.SMTP_FROM || '"Password Manager" <noreply@passwordmanager.com>',
                ...options
            })
            if (!isProduction || isDebug) {
                console.log(`[VaultSync:${contextInfo || 'Email'}] ✅ Sent email to ${options.to}`)
            }
        } catch (emailError: unknown) {
            const errorMessage = emailError instanceof Error ? emailError.message : "Unknown SMTP error"
            console.error(`[VaultSync:${contextInfo || 'Email'}] Email failed:`, errorMessage)
            if (!isProduction || isDebug) {
                // Let the caller handle fallback logging if needed, or re-throw
                // For now we just log error but re-throw so caller knows it failed
                throw emailError;
            }
            throw emailError;
        }
    } else {
        // Dev mode: mimic failure or just log
        // Actually, if credentials are missing, we should probably not try to send or let the caller handle dev mode logic.
        // But the previous implementation had logic inside.
        // Let's return false or throw if not configured?
        // The original code handled "Dev mode" logging inside the block.
        // Let's keep it simple: this function SENDS email. If it can't, it throws or does nothing.
        // But for the test to work, we need to mock THIS function.

        // If we want to preserve the "Dev mode" logging when credentials are missing, we can do it here or in the caller.
        // Caller `otpService` handles dev mode logging if credentials are missing.
        // So this function should only run if credentials exist?  
        // No, `otpService` checks credentials first.

        // Wait, `otpService` creates transporter globally.
        // So we just need to export the transporter or a function that uses it.

        throw new Error("SMTP credentials missing");
    }
}
