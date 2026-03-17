import type { Config } from 'jest'

const config: Config = {
  displayName: 'test-kit',
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
    '^@wash-sale/core$': '<rootDir>/../core/src',
    '^@wash-sale/core/(.*)$': '<rootDir>/../core/src/$1',
  },
}

export default config
