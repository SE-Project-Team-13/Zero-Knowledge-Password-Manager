/**
 * Jest Global Setup File
 * - Starts an in-memory MongoDB instance before all tests.
 * - Connects Mongoose to that instance.
 * - Clears all collections after each test (isolation).
 * - Disconnects and stops the server after all tests.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Start MongoMemoryServer and connect Mongoose once before all tests in a suite.
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
}, 30000); // 30s timeout for the binary download (first run only)

// Drop all collections after each test for clean state.
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// Disconnect mongoose and stop server after all tests in a suite.
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});
