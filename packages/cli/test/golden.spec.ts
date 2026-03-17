import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const EXPECTED_DIR = path.join(__dirname, 'expected')
const CLI_ENTRY = path.join(__dirname, '..', 'src', 'main.ts')
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..')
const DEV_TSCONFIG = path.join(PROJECT_ROOT, 'tsconfig.dev.json')

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

function runCli(csvPath: string, ticker = 'FIG'): string {
  const result = spawnSync(
    'npx',
    [
      'tsx',
      '--tsconfig',
      DEV_TSCONFIG,
      CLI_ENTRY,
      'calculate',
      '-i',
      csvPath,
      '-t',
      ticker,
      '--print-audit-log',
      '-f',
      'table',
    ],
    {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      env: { ...process.env, NO_COLOR: '1' },
    },
  )

  if (result.status !== 0) {
    throw new Error(
      `CLI exited with code ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    )
  }

  return stripAnsi(result.stdout).trimEnd()
}

function getFixtures(): string[] {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.csv'))
    .sort()
}

function fixtureLabel(filename: string): string {
  return filename.replace('.csv', '').replace(/-/g, ' ')
}

describe('golden CLI tests', () => {
  const fixtures = getFixtures()

  if (fixtures.length === 0) {
    it('should have fixture files', () => {
      throw new Error(`No .csv fixtures found in ${FIXTURES_DIR}`)
    })
    return
  }

  for (const csvFile of fixtures) {
    const baseName = csvFile.replace('.csv', '')

    it(fixtureLabel(csvFile), () => {
      const csvPath = path.join(FIXTURES_DIR, csvFile)
      const expectedPath = path.join(EXPECTED_DIR, `${baseName}.txt`)
      const actual = runCli(csvPath)

      if (process.env.UPDATE_GOLDEN === '1') {
        fs.mkdirSync(EXPECTED_DIR, { recursive: true })
        fs.writeFileSync(expectedPath, actual + '\n', 'utf-8')
        return
      }

      if (!fs.existsSync(expectedPath)) {
        fs.mkdirSync(EXPECTED_DIR, { recursive: true })
        fs.writeFileSync(expectedPath, actual + '\n', 'utf-8')
        console.log(`Created expected output: ${expectedPath}`)
        return
      }

      const expected = fs.readFileSync(expectedPath, 'utf-8').trimEnd()
      expect(actual).toBe(expected)
    })
  }
})
