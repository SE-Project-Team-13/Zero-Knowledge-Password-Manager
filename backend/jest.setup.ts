
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { jest, beforeAll, afterAll, afterEach } from '@jest/globals';

let mongoServer: MongoMemoryServer;

// Start in-memory MongoDB instance
beforeAll(async () => {
    jest.setTimeout(120000); // Allow time for download
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

// Clear data after each test
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// Stop server and disconnect
afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

// Mock console methods to reduce noise
global.console = {
    ...console,
    // error: jest.fn(), 
    // log: jest.fn(),
};
