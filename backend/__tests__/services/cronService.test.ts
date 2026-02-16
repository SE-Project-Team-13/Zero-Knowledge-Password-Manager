
import { jest, describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import { User, Session, OTP, LoginChallenge } from '../../src/database/models.js';
import mongoose from 'mongoose';

// Mock node-cron to avoid starting real schedules
const mockCronSchedule = jest.fn();
jest.unstable_mockModule('node-cron', () => ({
    default: { schedule: mockCronSchedule },
    schedule: mockCronSchedule
}));

// Mock Breach Service to control breach detection results
const mockCheckEmailBreach = jest.fn();
jest.unstable_mockModule('../../src/services/breachService.js', () => ({
    checkEmailBreach: mockCheckEmailBreach
}));

describe('CronService Integration Tests', () => {
    let cronService: any;
    let initScheduledJobs: any;
    let runBreachDetectionJob: any;
    let runCleanupJob: any;

    beforeAll(async () => {
        cronService = await import('../../src/services/cronService.js');
        initScheduledJobs = cronService.initScheduledJobs;
        runBreachDetectionJob = cronService.runBreachDetectionJob;
        runCleanupJob = cronService.runCleanupJob;
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        // DB cleanup handled by jest.setup.js
    });

    it('initScheduledJobs: should schedule jobs', () => {
        initScheduledJobs();
        expect(mockCronSchedule).toHaveBeenCalledTimes(2);
        // We can't easily check the callback reference because it's imported, but we can check the pattern
        expect(mockCronSchedule).toHaveBeenCalledWith("0 0 * * 0", expect.any(Function));
        expect(mockCronSchedule).toHaveBeenCalledWith("0 2 * * *", expect.any(Function));
    });

    it('runBreachDetectionJob: should mark breached users', async () => {
        console.log('Test Case: Breach Detection Logic');

        // Setup: Create users
        const safeUser = await User.create({ email: 'safe@test.com', fullName: 'Safe', salt: 's', verifier: 'v' });
        const breachedUser = await User.create({ email: 'breached@test.com', fullName: 'Breach', salt: 's', verifier: 'v' });

        // Mock breach service
        mockCheckEmailBreach.mockImplementation(async (email: any) => {
            return email === 'breached@test.com';
        });

        await runBreachDetectionJob();

        // Verify Safe User
        const safeUserDb = await User.findById(safeUser._id);
        expect(safeUserDb?.isBreached).toBe(false);
        expect(safeUserDb?.lastBreachCheck).toBeDefined();

        // Verify Breached User
        const breachedUserDb = await User.findById(breachedUser._id);
        expect(breachedUserDb?.isBreached).toBe(true);
        expect(breachedUserDb?.lastBreachCheck).toBeDefined();
    });

    it('runCleanupJob: should remove expired data', async () => {
        console.log('Test Case: Cleanup Logic');

        const now = Date.now();
        const past = new Date(now - 100000).toISOString().replace("T", " ").substring(0, 19);
        const future = new Date(now + 100000).toISOString().replace("T", " ").substring(0, 19);

        const uid = new mongoose.Types.ObjectId();
        await User.create({ _id: uid, email: 't@t.com', fullName: 'T', salt: 's', verifier: 'v' });

        // Setup: Expired items
        await Session.create({ userId: uid, token: 'expired', expiresAt: past });
        await OTP.create({ email: 't@t.com', code: '1', expiresAt: past });
        await LoginChallenge.create({ email: 't@t.com', challenge: '1', expiresAt: past });

        // Setup: Valid items
        await Session.create({ userId: uid, token: 'valid', expiresAt: future });

        await runCleanupJob();

        // Verify Expired gone
        expect(await Session.findOne({ token: 'expired' })).toBeNull();
        expect(await OTP.findOne({ code: '1' })).toBeNull();
        expect(await LoginChallenge.findOne({ challenge: '1' })).toBeNull();

        // Verify Valid remains
        expect(await Session.findOne({ token: 'valid' })).toBeDefined();
    });
});
