import { fetch } from 'undici';

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
 * Sends a transactional email via SendGrid's v3 REST API.
 * Uses port 443 (HTTPS) so it works on Render and bypasses SMTP port blocking.
 */
export async function sendEmail(options: MailOptions, contextInfo?: string): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
        throw new Error("SENDGRID_API_KEY missing")
    }

    const fromAddress = process.env.SMTP_FROM || 'ZeroKnowledge Vault <zeroauthpass@gmail.com>'
    // Parse "Name <email>" format
    const fromMatch = fromAddress.match(/^(.*?)\s*<(.+?)>$/)
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : 'ZeroKnowledge Vault'
    const fromEmail = fromMatch ? fromMatch[2].trim() : fromAddress.trim()

    const payload = {
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: fromEmail, name: fromName },
        reply_to: { email: fromEmail, name: fromName },
        subject: options.subject,
        content: [
            { type: 'text/plain', value: options.text },
            { type: 'text/html', value: options.html }
        ]
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })

    if (response.status !== 202) {
        const errorBody = await response.json().catch(() => ({})) as any
        console.error(`[VaultSync:${contextInfo || 'Email'}] SendGrid API Error:`, JSON.stringify(errorBody, null, 2))
        throw new Error(errorBody?.errors?.[0]?.message || `SendGrid error: ${response.status}`)
    }

    if (!isProduction || isDebug) {
        console.log(`[VaultSync:${contextInfo || 'Email'}] ✅ Sent OTP email to ${options.to} via SendGrid.`)
    }
}
