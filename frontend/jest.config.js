const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^uuid$': require.resolve('uuid'),
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/crypto-engine/',
  ],
  transformIgnorePatterns: [
      '/node_modules/(?!(@noble|uuid|@password-manager)/)',
  ],
  transform: {
      '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  // Run tests sequentially for cleaner output
  maxWorkers: 1,
  // Enable verbose output for better test visibility
  verbose: true,
  // Ensure all tests run even if some fail
  bail: false,
  // Limit console output noise
  silent: false,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
