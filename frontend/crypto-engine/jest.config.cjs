module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 30000,
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/test/**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@noble/hashes/(.*?)(\\.js)?$': '<rootDir>/../../node_modules/@noble/hashes/$1.js',
    '^@noble/ciphers/(.*?)(\\.js)?$': '<rootDir>/../../node_modules/@noble/ciphers/$1.js'
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
