import { google } from "googleapis";

/**
 * Sends a transactional email via the official Gmail API (OAuth2).
 * This ensures 100% Inbox delivery for @gmail.com accounts without a domain.
 */
export async function sendGmail(
  options: { to: string; subject: string; text: string; html: string },
  contextInfo?: string,
): Promise<void> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const userEmail = process.env.GMAIL_USER_EMAIL;

  if (!clientId || !clientSecret || !refreshToken || !userEmail) {
    throw new Error(
      "Missing Gmail OAuth2 credentials in .env (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL)",
    );
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground",
  );
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Gmail API requires the email to be base64url encoded
    // Note: RFC 2822 strictly requires CRLF (\r\n) as the line separator
    const subject = options.subject;
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const messageParts = [
      `From: Zenith Vault <${userEmail}>`,
      `To: ${options.to}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      `Subject: ${utf8Subject}`,
      "",
      options.html,
    ];
    const message = messageParts.join("\r\n");

    // The body needs to be base64url encoded
    const encodedMessage = Buffer.from(message, 'utf-8')
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    const isProduction = process.env.NODE_ENV === "production";
    const isDebug = process.env.DEBUG === "true";

    if (!isProduction || isDebug) {
      console.log(
        `[VaultSync:${contextInfo || "Gmail"}] ✅ Sent OTP email to ${options.to}. MsgId: ${res.data.id}`,
      );
    }
  } catch (error: any) {
    console.error(
      `[VaultSync:${contextInfo || "Gmail"}] Gmail API Error:`,
      error.message,
    );
    throw new Error(`Gmail API failed: ${error.message}`);
  }
}
