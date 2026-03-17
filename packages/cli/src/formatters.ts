import {
  formatResultTable as sharedFormatResultTable,
  formatAuditCsv,
  formatPositionsCsv,
} from '@wash-sale/adapters'
import type { FormatOptions } from '@wash-sale/adapters'

const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const DISCLAIMER_LINES = [
  `${RED}${BOLD}DISCLAIMER:${RESET}${BOLD} This tool is for educational and computational purposes only. It does not constitute tax, legal,`,
  'or financial advice. Wash sale rules (IRC §1091) have nuances including but not limited to: IRA acquisitions,',
  'options/contracts on substantially identical securities, spousal transactions, and state-specific rules.',
  `Always consult a qualified tax professional for your specific situation.${RESET}`,
]

function buildAnsiDisclaimer(): string {
  const maxVisible = DISCLAIMER_LINES.reduce((max, line) => {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '')
    return Math.max(max, stripped.length)
  }, 0)
  const border = '='.repeat(maxVisible + 4)
  const padded = DISCLAIMER_LINES.map((line) => {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '')
    const pad = maxVisible - stripped.length
    return `= ${line}${' '.repeat(pad)} =`
  })
  return [border, ...padded, border].join('\n')
}

export function formatResultTable(
  result: Parameters<typeof sharedFormatResultTable>[0],
  opts?: FormatOptions,
): string {
  return sharedFormatResultTable(result, {
    ...opts,
    disclaimerOverride: buildAnsiDisclaimer(),
  })
}

export { formatAuditCsv, formatPositionsCsv }
export type { FormatOptions }
