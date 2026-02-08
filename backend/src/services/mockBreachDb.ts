/**
 * Mock Breach Database Service
 * Simulates an external API like HaveIBeenPwned.
 * Implements k-anonymity by accepting a prefix and returning matching suffixes.
 */

// List of breached hash suffixes map (Prefix -> Array of Suffixes)
// We use a Map for O(1) lookup of prefix
// Real API would query a massive DB.
const BREACH_DATABASE: Record<string, string[]> = {
    // Hash for 'breached@example.com'
    // Full: 0f0ae2941993d90015c3f92523b961e3c3ef5ea1e31f1b9ff8357af0795064f7
    // Prefix: 0f0ae
    "0f0ae": [
        "2941993d90015c3f92523b961e3c3ef5ea1e31f1b9ff8357af0795064f7",
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF", // Fake collision 1
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // Fake collision 2
    ],
    // Some random other prefixes for realism
    "abcde": ["1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
    "12345": ["fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"],
};

export const MockBreachDB = {
    /**
     * Simulates querying the breach database with k-anonymity.
     * @param prefix - The first 5 characters of the SHA-256 hash of the email.
     * @returns A list of suffixes that match the prefix, or empty array if none.
     */
    getSuffixes: async (prefix: string): Promise<string[]> => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Return suffixes or empty list
        // In a real API, this would return many suffixes for a 5-char prefix
        return BREACH_DATABASE[prefix] || [];
    },
};
