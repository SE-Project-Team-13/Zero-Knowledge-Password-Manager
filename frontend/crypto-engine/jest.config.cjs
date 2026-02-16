module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 30000,
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/test/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@noble)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
};
