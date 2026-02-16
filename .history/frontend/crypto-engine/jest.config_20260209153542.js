module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: [
    '**/test/**/*.(ts|js)',
    '**/*.(test|spec).(ts|js)'
  ],
  moduleDirectories: ['node_modules', 'src'],
};