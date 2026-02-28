import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
const isProduction = process.env.NODE_ENV === "production"
const isDebug = process.env.DEBUG === "true"

export interface MailOptions {
    from?: string;
    to: string;
    subject: string;
    html: string;
    text: string;
}

export async function sendEmail(options: MailOptions, contextInfo?: string): Promise<void> {
    if (process.env.RESEND_API_KEY) {
        try {
            const { data, error } = await resend.emails.send({
                from: process.env.SMTP_FROM || 'ZeroKnowledge Vault <noreply@zeroknowledge.dev>',
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            });

            if (error) {
                console.error(`[VaultSync:${contextInfo || 'Email'}] Resend API Error:`, error);
                throw new Error(error.message);
            }

            if (!isProduction || isDebug) {
                console.log(`[VaultSync:${contextInfo || 'Email'}] ✅ Sent OTP email to ${options.to} via Resend. ID: ${data?.id}`);
            }
        } catch (emailError: unknown) {
            const errorMessage = emailError instanceof Error ? emailError.message : "Unknown Resend error";
            console.error(`[VaultSync:${contextInfo || 'Email'}] Email failed:`, errorMessage);
            throw emailError;
        }
    } else {
        console.warn(`[VaultSync:${contextInfo || 'Email'}] Dev mode fallback triggered: RESEND_API_KEY is not defined. Logging OTP to console rather than sending.`);
        throw new Error("RESEND_API_KEY missing");
    }
}
