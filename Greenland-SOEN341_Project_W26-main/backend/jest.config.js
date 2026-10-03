export default {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverage: true,
  collectCoverageFrom: [
    "**/*.js",
    "!node_modules/**",
    "!tests/**",
    "!jest.config.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json"],
  testTimeout: 10000,
  maxWorkers: 1,
};