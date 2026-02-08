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
                const isBreached = await checkEmailBreach(user.email);

                if (isBreached && !user.isBreached) {
                    // New breach detected!
                    user.isBreached = true;
                    user.lastBreachCheck = new Date();
                    await user.save();
                    console.log(`[Cron] 🚨 Alert: User ${user.email} marked as breached.`);
                    breachCount++;
                } else if (!isBreached && user.isBreached) {
                    // Status cleared (e.g. false positive or DB update)
                    // Usually we don't auto-clear unless we are sure, but for demo:
                    // user.isBreached = false;
                    // await user.save();
                } else {
                    user.lastBreachCheck = new Date();
                    await user.save();
                }
            }

            console.log(`[Cron] Breach check complete. Scanned ${users.length} users. New breaches: ${breachCount}`);
        } catch (error) {
            console.error("[Cron] Error running breach detection job:", error);
        }
    });

    console.log("[Cron] Scheduled jobs started.");
}
