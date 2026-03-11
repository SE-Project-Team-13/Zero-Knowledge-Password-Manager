/** @type {import('ts-jest').JestConfigWithTsJest} */
// Force mongodb-memory-server to use a project-local cache and a pinned version.
// This avoids a ~700MB re-download every time the system AppData cache is cleared.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.14';
process.env.MONGOMS_DOWNLOAD_DIR = process.env.MONGOMS_DOWNLOAD_DIR || './.mongo-cache';

module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: {
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                },
            },
        ],
    },
    // Global setup: spin up MongoMemoryServer, connect Mongoose, clean up after each test
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    // Force Jest to exit after all tests finish (prevents hanging on open DB handles)
    forceExit: true,
    // Allow time for in-memory MongoDB ops and async service calls
    testTimeout: 15000,
    // Run test suites serially to avoid MongoMemoryServer port conflicts
    maxWorkers: 1,
    // Enable verbose output for better test visibility
    verbose: true,
    // Ensure all tests run even if some fail
    bail: false,
    // Limit console output noise
    silent: false,
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
    ],
};
