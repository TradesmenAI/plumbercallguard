const nextJest = require("next/jest")

const createJestConfig = nextJest({ dir: "./" })

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.js"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
}

module.exports = createJestConfig(customConfig)
