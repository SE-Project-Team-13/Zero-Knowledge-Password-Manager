/** @type {import('ts-jest').JestConfigWithTsJest} */
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
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
    ],
};
