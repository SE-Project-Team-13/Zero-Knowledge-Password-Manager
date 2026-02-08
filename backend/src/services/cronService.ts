import cron from "node-cron";
import { User } from "../database/models.js";
import { checkEmailBreach } from "./breachService.js";

/**
 * Initializes the scheduled jobs.
 */
export function initScheduledJobs() {
    console.log("[Cron] Initializing scheduled jobs...");

    // Breach Detection Job
    // Schedule: Every week on Sunday at midnight (0 0 * * 0)
    // FOR DEV: Running every minute (*/1 * * * *) to demonstrate functionality
    cron.schedule("*/1 * * * *", async () => {
        console.log("[Cron] Running scheduled Breach Detection check...");
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
                    console.log(`[Cron] 🚨 Alert: User ${user.email} marked as breached.`);
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

            console.log(`[Cron] Breach check complete. Scanned ${users.length} users. New breaches: ${breachCount}`);
        } catch (error) {
            console.error("[Cron] Error running breach detection job:", error);
        }
    });

    console.log("[Cron] Scheduled jobs started.");

    // Cleanup Job
    // Schedule: Every hour (0 * * * *)
    // FOR DEV: Every 5 minutes (*/5 * * * *)
    cron.schedule("*/5 * * * *", async () => {
        console.log("[Cron] Running scheduled Cleanup job...");
        try {
            const { Session, OTP } = await import("../database/models.js");
            const now = new Date().toISOString().replace("T", " ").substring(0, 19);
            
            // Cleanup expired sessions
            const sessionResult = await Session.deleteMany({ expiresAt: { $lt: now } });
            if (sessionResult.deletedCount > 0) {
                 console.log(`[Cron] Cleaned up ${sessionResult.deletedCount} expired sessions.`);
            }

            // Cleanup expired OTPs
            const otpResult = await OTP.deleteMany({ expiresAt: { $lt: now } });
            if (otpResult.deletedCount > 0) {
                console.log(`[Cron] Cleaned up ${otpResult.deletedCount} expired OTPs.`);
            }
        } catch (error) {
            console.error("[Cron] Error running cleanup job:", error);
        }
    });
}
