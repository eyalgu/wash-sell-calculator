import type { Argv } from 'yargs'
import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import { parseRows, toCsv, nodeFileSystem } from '@wash-sale/adapters'
import { formatResultTable, formatAuditCsv, formatPositionsCsv } from '../formatters'

interface CalculateArgs {
  input: string
  ticker: string
  output?: string
  auditFile?: string
  printAuditLog: boolean
  positions?: string
  format: 'table' | 'csv'
}

export function calculateCommand(yargsInstance: Argv): Argv {
  return yargsInstance.command({
    command: 'calculate',
    describe: 'Run wash-sale cost basis calculation',
    builder: (cmd) =>
      cmd
        .option('input', {
          alias: 'i',
          type: 'string',
          demandOption: true,
          describe: 'Path to input CSV file',
        })
        .option('ticker', {
          alias: 't',
          type: 'string',
          demandOption: true,
          describe: 'Stock ticker symbol',
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          describe: 'Path to write Form 8949 CSV output',
        })
        .option('audit-file', {
          alias: 'a',
          type: 'string',
          describe: 'Path to write audit log CSV',
        })
        .option('print-audit-log', {
          type: 'boolean',
          default: false,
          describe: 'Include audit log in stdout output',
        })
        .option('positions', {
          alias: 'p',
          type: 'string',
          describe: 'Path to write remaining positions CSV',
        })
        .option('format', {
          alias: 'f',
          type: 'string',
          choices: ['table', 'csv'] as const,
          default: 'table' as const,
          describe: 'Output format when printing to stdout',
        }),
    handler: async (argv) => {
      const args = argv as CalculateArgs
      const csvText = await nodeFileSystem.readText(args.input)
      const rows = parseRows(csvText)
      const result = AdjustedCostBasisCalculator.forTicker(args.ticker).addRows(rows).calculate()

      if (args.output != null) {
        await nodeFileSystem.writeText(args.output, toCsv(result))
      }
      if (args.auditFile != null) {
        await nodeFileSystem.writeText(args.auditFile, formatAuditCsv(result.auditLog))
      }
      if (args.positions != null) {
        await nodeFileSystem.writeText(
          args.positions,
          formatPositionsCsv(result.remainingPositions),
        )
      }

      const hasFileFlags = args.output != null || args.auditFile != null || args.positions != null
      if (!hasFileFlags) {
        if (args.format === 'table') {
          console.log(formatResultTable(result, { audit: args.printAuditLog }))
        } else {
          console.log(toCsv(result))
        }
      }
    },
  })
}
