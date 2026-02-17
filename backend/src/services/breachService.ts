import crypto from "crypto";
import { MockBreachDB } from "./mockBreachDb.js"; // Note the .js extension for ESM

/**
 * Checks if an email exists in the breach database using k-anonymity.
 * ...
 * @param email - The email to check.
 * @param breachDB - Optional breach DB provider for testing.
 * @returns true if breached, false otherwise.
 */
export async function checkEmailBreach(email: string, breachDB = MockBreachDB): Promise<boolean> {
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
        const suffixes = await breachDB.getSuffixes(prefix);

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
