import type { Config } from 'jest'

const config: Config = {
  displayName: 'core',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@wash-sale/core$': '<rootDir>/src',
    '^@wash-sale/core/(.*)$': '<rootDir>/src/$1',
    '^@wash-sale/test-kit$': '<rootDir>/../test-kit/src',
    '^@wash-sale/test-kit/(.*)$': '<rootDir>/../test-kit/src/$1',
  },
}

export default config
