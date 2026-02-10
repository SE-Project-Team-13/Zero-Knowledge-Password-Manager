import cron from "node-cron";
import { User } from "../database/models.js";
import { checkEmailBreach } from "./breachService.js";

/**
 * Initializes the scheduled jobs.
 */
export function initScheduledJobs() {
    console.log("[VaultSync:Cron] Initializing scheduled jobs...");

    // Breach Detection Job
    // Schedule: Every week on Sunday at midnight (0 0 * * 0)
    cron.schedule("0 0 * * 0", async () => {
        console.log("[VaultSync:Cron] Running scheduled Breach Detection check...");
        try {
            const users = await User.find({});
            let breachCount = 0;

            for (const user of users) {
                // Check if email is in breach database (privacy-preserving)
                if (!user.email) continue;
                
                const isBreached = await checkEmailBreach(user.email);

                if (isBreached && !user.isBreached) {
                    // New breach detected!
                    // Use updateOne to avoid validation errors on legacy documents (e.g. missing fullName)
                    await User.updateOne(
                        { _id: user._id },
                        { 
                            isBreached: true,
                            lastBreachCheck: new Date().toISOString().replace("T", " ").substring(0, 19)
                        },
                        { runValidators: false }
                    );
                    console.log(`[VaultSync:Cron] 🚨 Alert: User ${user.email} marked as breached.`);
                    breachCount++;
                } else if (!isBreached && user.isBreached) {
                    // Status cleared (e.g. false positive or DB update)
                    // Usually we don't auto-clear unless we are sure, but for demo:
                    // user.isBreached = false;
                    // await user.save();
                } else {
                    // Update check timestamp
                    await User.updateOne(
                        { _id: user._id },
                        { lastBreachCheck: new Date().toISOString().replace("T", " ").substring(0, 19) },
                        { runValidators: false }
                    );
                }
            }

            console.log(`[VaultSync:Cron] Breach check complete. Scanned ${users.length} users. New breaches: ${breachCount}`);
        } catch (error) {
            console.error("[VaultSync:Cron] Error running breach detection job:", error);
        }
    });

    console.log("[VaultSync:Cron] Scheduled jobs started.");

    // Cleanup Job
    // Schedule: Daily at 2:00 AM
    cron.schedule("0 2 * * *", async () => {
        console.log("[VaultSync:Cron] Running scheduled Cleanup job...");
        try {
            const { Session, OTP, LoginChallenge } = await import("../database/models.js");
            const now = new Date().toISOString().replace("T", " ").substring(0, 19);
            
            // Cleanup expired sessions
            const sessionResult = await Session.deleteMany({ expiresAt: { $lt: now } });
            if (sessionResult.deletedCount > 0) {
                 console.log(`[VaultSync:Cron] Cleaned up ${sessionResult.deletedCount} expired sessions.`);
            }

            // Cleanup expired OTPs
            const otpResult = await OTP.deleteMany({ expiresAt: { $lt: now } });
            if (otpResult.deletedCount > 0) {
                console.log(`[VaultSync:Cron] Cleaned up ${otpResult.deletedCount} expired OTPs.`);
            }

            // Cleanup expired login challenges
            const challengeResult = await LoginChallenge.deleteMany({ expiresAt: { $lt: now } });
            if (challengeResult.deletedCount > 0) {
                console.log(`[VaultSync:Cron] Cleaned up ${challengeResult.deletedCount} expired login challenges.`);
            }
        } catch (error) {
            console.error("[VaultSync:Cron] Error running cleanup job:", error);
        }
    });
}
