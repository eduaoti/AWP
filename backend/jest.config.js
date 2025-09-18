/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",            
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts", "**/?(*.)+(spec|test).ts"], // busca tests
  moduleFileExtensions: ["ts", "js", "json"]
};
