import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // dónde están tus tests
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],

  moduleFileExtensions: ['ts', 'js', 'json'],

  // transforma TS con ts-jest (aquí va la config que tenías en "globals")
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', isolatedModules: true }],
  },

  // setup global para mocks/env
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],

  // cobertura
  collectCoverage: true,
  collectCoverageFrom: [
    'src/controllers/**/*.ts',
    // agrega más patrones si quieres cubrir servicios, modelos, etc.
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',

  // higiene útil
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // si usas paths en tsconfig (opcional):
  // moduleNameMapper: {
  //   '^@src/(.*)$': '<rootDir>/src/$1',
  // },
};

export default config;
