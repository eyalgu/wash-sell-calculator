import type { Config } from 'jest'

const config: Config = {
  projects: [
    '<rootDir>/packages/core',
    '<rootDir>/packages/adapters',
    '<rootDir>/packages/test-kit',
    '<rootDir>/packages/cli',
  ],
}

export default config
