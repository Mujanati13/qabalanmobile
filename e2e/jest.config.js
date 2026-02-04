const { defaults: tsjPreset } = require('ts-jest/presets');

module.exports = {
  preset: 'react-native',
  testEnvironment: './e2e/environment',
  testRunner: '@jest/circus/runner',
  testTimeout: 120000,
  testRegex: '\\.e2e\\.(js|ts)$',
  verbose: true,
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'e2e/reports', outputName: 'junit.xml' }]
  ],
  globalSetup: './e2e/globalSetup.js',
  globalTeardown: './e2e/globalTeardown.js',
  setupFilesAfterEnv: ['./e2e/init.js'],
  transform: {
    '\\.[jt]sx?$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.js'
  ]
};
