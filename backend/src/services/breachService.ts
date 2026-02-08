import crypto from "crypto";
import { MockBreachDB } from "./mockBreachDb.js"; // Note the .js extension for ESM

/**
 * Checks if an email exists in the breach database using k-anonymity.
 * 
 * Privacy Protocol:
 * 1. Hash the email (SHA-256).
 * 2. Send only the first 5 characters (prefix) to the external service.
 * 3. Receive a list of suffixes.
 * 4. Check locally if our full hash matches any returned suffix.
 * 
 * This ensures the external service never sees the full email or hash.
 * 
 * @param email - The email to check.
 * @returns true if breached, false otherwise.
 */
export async function checkEmailBreach(email: string): Promise<boolean> {
    try {
        // 1. Hash the email
        const hash = crypto
            .createHash("sha256")
            .update(email.trim().toLowerCase()) // Normalize email
            .digest("hex");

        // 2. Extract prefix (k-anonymity)
        const prefix = hash.substring(0, 5);
        const suffix = hash.substring(5);

        // 3. Query external service with ONLY the prefix
        const suffixes = await MockBreachDB.getSuffixes(prefix);

        // 4. Check for match locally
        const isBreached = suffixes.includes(suffix.toUpperCase()) || suffixes.includes(suffix.toLowerCase());

        if (isBreached) {
            console.log(`[BreachService] ⚠️ BREACH DETECTED for email: ${email} (Hash Prefix: ${prefix})`);
        }

        return isBreached;
    } catch (error) {
        console.error(`[BreachService] Error checking breach status for ${email}:`, error);
        return false; // Fail safe
    }
}
