import cron from "node-cron";
import { User } from "../database/models.js";
import { checkEmailBreach } from "./breachService.js";

interface CronProvider {
    schedule: (cronExpression: string, func: () => void, options?: any) => any;
}

/**
 * Breach Detection Job Logic
 * Checks all users against the breach database (privacy-preserving).
 * @param breachChecker - Optional checkEmailBreach function for testing.
 */
export async function runBreachDetectionJob(breachChecker = checkEmailBreach) {
    console.log("[VaultSync:Cron] Running scheduled Breach Detection check...");
    try {
        const users = await User.find({});
        let breachCount = 0;

        for (const user of users) {
            // Check if email is in breach database (privacy-preserving)
            if (!user.email) continue;

            const isBreached = await breachChecker(user.email);

            if (isBreached && !user.isBreached) {
                // New breach detected!
                await User.updateOne(
                    { _id: user._id },
                    {
                        isBreached: true,
                        lastBreachCheck: new Date()
                    },
                    { runValidators: false }
                );
                console.log(`[VaultSync:Cron] 🚨 Alert: User ${user.email} marked as breached.`);
                breachCount++;
            } else {
                // Update check timestamp
                await User.updateOne(
                    { _id: user._id },
                    { lastBreachCheck: new Date() },
                    { runValidators: false }
                );
            }
        }

        console.log(`[VaultSync:Cron] Breach check complete. Scanned ${users.length} users. New breaches: ${breachCount}`);
    } catch (error) {
        console.error("[VaultSync:Cron] Error running breach detection job:", error);
    }
}

/**
 * Cleanup Job Logic
 * Removes expired sessions, OTPs, and login challenges.
 */
export async function runCleanupJob() {
    console.log("[VaultSync:Cron] Running scheduled Cleanup job...");
    try {
        // Dynamic import to avoid circular dependencies if any (though models usually safe)
        const { Session, OTP, LoginChallenge } = await import("../database/models.js");

        // Cleanup expired sessions
        const sessionResult = await Session.deleteMany({ expiresAt: { $lt: new Date() } });
        if (sessionResult.deletedCount > 0) {
            console.log(`[VaultSync:Cron] Cleaned up ${sessionResult.deletedCount} expired sessions.`);
        }

        // Cleanup expired OTPs
        const otpResult = await OTP.deleteMany({ expiresAt: { $lt: new Date() } });
        if (otpResult.deletedCount > 0) {
            console.log(`[VaultSync:Cron] Cleaned up ${otpResult.deletedCount} expired OTPs.`);
        }

        // Cleanup expired login challenges
        const challengeResult = await LoginChallenge.deleteMany({ expiresAt: { $lt: new Date() } });
        if (challengeResult.deletedCount > 0) {
            console.log(`[VaultSync:Cron] Cleaned up ${challengeResult.deletedCount} expired login challenges.`);
        }
    } catch (error) {
        console.error("[VaultSync:Cron] Error running cleanup job:", error);
    }
}

/**
 * Initializes the scheduled jobs.
 * @param cronProvider - Optional cron provider for testing.
 */
export function initScheduledJobs(cronProvider: CronProvider | typeof cron = cron) {
    console.log("[VaultSync:Cron] Initializing scheduled jobs...");

    // Breach Detection Job
    // Schedule: Every week on Sunday at midnight (0 0 * * 0)
    cronProvider.schedule("0 0 * * 0", () => runBreachDetectionJob());

    // Cleanup Job
    // Schedule: Daily at 2:00 AM
    cronProvider.schedule("0 2 * * *", runCleanupJob);

    console.log("[VaultSync:Cron] Scheduled jobs started.");
}
