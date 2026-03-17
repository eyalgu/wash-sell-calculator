import type {
  CalculationResult,
  AuditLogEntry,
  RemainingPosition,
  NormalizedRow,
  Form8949Row,
} from '@wash-sale/core'

export function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function padRight(s: string, width: number): string {
  if (s.length >= width) return s
  return s + ' '.repeat(width - s.length)
}

function formatForm8949Table(rows: readonly Form8949Row[]): string {
  if (rows.length === 0) return ''

  const cols = [
    (r: Form8949Row) => r.description,
    (r: Form8949Row) => r.dateAcquired,
    (r: Form8949Row) => r.dateSold,
    (r: Form8949Row) => r.proceeds.toFixed(2),
    (r: Form8949Row) => r.costBasis.toFixed(2),
    (r: Form8949Row) => r.adjustmentCode ?? '',
    (r: Form8949Row) => (r.adjustmentAmount != null ? r.adjustmentAmount.toFixed(2) : ''),
    (r: Form8949Row) => r.gainOrLoss.toFixed(2),
    (r: Form8949Row) => r.term,
  ]
  const headers = [
    'Description',
    'Acquired',
    'Sold',
    'Proceeds',
    'Basis',
    'Adj Code',
    'Adj Amount',
    'Gain/Loss',
    'Term',
  ]

  const widths = headers.map((h, i) => {
    let max = h.length
    for (const row of rows) {
      const val = cols[i]!(row)
      if (val.length > max) max = val.length
    }
    return max
  })

  const headerLine = headers.map((h, i) => padRight(h, widths[i]!)).join('  ')
  const sep = '-'.repeat(headerLine.length)
  const dataLines = rows.map((row) => cols.map((fn, i) => padRight(fn(row), widths[i]!)).join('  '))
  return [headerLine, sep, ...dataLines].join('\n')
}

function formatInputTable(rows: readonly NormalizedRow[]): string {
  if (rows.length === 0) return '(no input rows)'

  const headers = ['Date', 'Action', 'Source', 'Shares', 'Price/Share', 'Type', 'Acquired Date']
  const cols = [
    (r: NormalizedRow) => r.date,
    (r: NormalizedRow) => r.action,
    (r: NormalizedRow) => r.source,
    (r: NormalizedRow) => r.shares.toString(),
    (r: NormalizedRow) => r.pricePerShare.toFixed(2),
    (r: NormalizedRow) => r.transactionType ?? '',
    (r: NormalizedRow) => r.acquiredDate ?? '',
  ]

  const widths = headers.map((h, i) => {
    let max = h.length
    for (const row of rows) {
      const val = cols[i]!(row)
      if (val.length > max) max = val.length
    }
    return max
  })

  const headerLine = headers.map((h, i) => padRight(h, widths[i]!)).join('  ')
  const sep = '-'.repeat(headerLine.length)
  const dataLines = rows.map((row) => cols.map((fn, i) => padRight(fn(row), widths[i]!)).join('  '))
  return [headerLine, sep, ...dataLines].join('\n')
}

const DISCLAIMER_LINES = [
  'DISCLAIMER: This tool is for educational and computational purposes only. It does not constitute tax, legal,',
  'or financial advice. Wash sale rules (IRC §1091) have nuances including but not limited to: IRA acquisitions,',
  'options/contracts on substantially identical securities, spousal transactions, and state-specific rules.',
  'Always consult a qualified tax professional for your specific situation.',
]

function buildDisclaimer(): string {
  const maxVisible = DISCLAIMER_LINES.reduce((max, line) => Math.max(max, line.length), 0)
  const border = '='.repeat(maxVisible + 4)
  const padded = DISCLAIMER_LINES.map((line) => {
    const pad = maxVisible - line.length
    return `= ${line}${' '.repeat(pad)} =`
  })
  return [border, ...padded, border].join('\n')
}

function formatAuditTable(auditLog: readonly AuditLogEntry[]): string {
  if (auditLog.length === 0) return '(no audit entries)'

  const headers = ['#', 'Type', 'Date', 'Message']
  const cols = [
    (_e: AuditLogEntry, i: number) => String(i + 1),
    (e: AuditLogEntry) => e.type,
    (e: AuditLogEntry) => e.at,
    (e: AuditLogEntry) => e.message,
  ]

  const widths = headers.map((h, ci) => {
    let max = h.length
    for (let ri = 0; ri < auditLog.length; ri++) {
      const val = cols[ci]!(auditLog[ri]!, ri)
      if (val.length > max) max = val.length
    }
    return max
  })

  const headerLine = headers.map((h, i) => padRight(h, widths[i]!)).join('  ')
  const sep = '-'.repeat(headerLine.length)
  const dataLines = auditLog.map((entry, ri) =>
    cols.map((fn, ci) => padRight(fn(entry, ri), widths[ci]!)).join('  '),
  )
  return [headerLine, sep, ...dataLines].join('\n')
}

export interface FormatOptions {
  audit?: boolean
}

export function formatResultTable(
  result: CalculationResult,
  opts?: FormatOptions & { disclaimerOverride?: string },
): string {
  const sections: string[] = []

  const disclaimer = opts?.disclaimerOverride ?? buildDisclaimer()
  sections.push(disclaimer)
  sections.push('')

  sections.push('=== Input Transactions ===')
  sections.push(formatInputTable(result.normalizedRows))
  sections.push('')

  const s = result.summary
  sections.push('=== Summary ===')
  sections.push(`Realized Gain/Loss (Short-term):  ${s.realizedGainLossShortTerm.toFixed(2)}`)
  sections.push(`Realized Gain/Loss (Long-term):   ${s.realizedGainLossLongTerm.toFixed(2)}`)
  sections.push(`Total Disallowed Losses:          ${s.totalDisallowedLosses.toFixed(2)}`)
  sections.push(
    `Deferred (in remaining):           ${s.deferredLossesInRemainingHoldings.toFixed(2)}`,
  )
  sections.push(`Total Allowed Losses:             ${s.totalAllowedLosses.toFixed(2)}`)

  const { form8949Data } = result
  if (form8949Data.shortTermRows.length > 0) {
    sections.push('')
    sections.push('=== Form 8949 (Short-term) ===')
    sections.push(formatForm8949Table(form8949Data.shortTermRows))
  }
  if (form8949Data.longTermRows.length > 0) {
    sections.push('')
    sections.push('=== Form 8949 (Long-term) ===')
    sections.push(formatForm8949Table(form8949Data.longTermRows))
  }

  if (result.remainingPositions.length > 0) {
    sections.push('')
    sections.push('=== Remaining Positions ===')
    const posHeaders = [
      'Fragment ID',
      'Ticker',
      'Source',
      'Shares',
      'Purchase Date',
      'Adjusted Acq Date',
      'Original Basis/Share',
      'Adjusted Basis/Share',
    ]
    const posCols = [
      (p: RemainingPosition) => p.fragmentId,
      (p: RemainingPosition) => p.ticker,
      (p: RemainingPosition) => p.source,
      (p: RemainingPosition) => p.sharesOpen.toString(),
      (p: RemainingPosition) => p.purchaseDateActual,
      (p: RemainingPosition) => p.acquisitionDateAdjusted,
      (p: RemainingPosition) => p.originalBasisPerShare.toFixed(2),
      (p: RemainingPosition) => p.basisPerShareAdjusted.toFixed(2),
    ]
    const posWidths = posHeaders.map((h, i) => {
      let max = h.length
      for (const p of result.remainingPositions) {
        const val = posCols[i]!(p)
        if (val.length > max) max = val.length
      }
      return max
    })
    const posHeaderLine = posHeaders.map((h, i) => padRight(h, posWidths[i]!)).join('  ')
    const posSep = '-'.repeat(posHeaderLine.length)
    const posDataLines = result.remainingPositions.map((p) =>
      posCols.map((fn, i) => padRight(fn(p), posWidths[i]!)).join('  '),
    )
    sections.push(posHeaderLine)
    sections.push(posSep)
    sections.push(...posDataLines)
  }

  if (result.warnings.length > 0) {
    sections.push('')
    sections.push('=== Warnings ===')
    for (const w of result.warnings) {
      sections.push(`[${w.code}] ${w.message}`)
    }
  }

  if (opts?.audit) {
    sections.push('')
    sections.push('=== Audit Log ===')
    sections.push(formatAuditTable(result.auditLog))
  }

  return sections.join('\n')
}

export function formatAuditCsv(auditLog: readonly AuditLogEntry[]): string {
  const headers = [
    'eventId',
    'type',
    'at',
    'rowKey',
    'saleRowKey',
    'lotFragmentId',
    'relatedFragmentId',
    'message',
  ]
  const lines = auditLog.map((e) => {
    const cells = [
      escapeCsvValue(e.eventId),
      escapeCsvValue(e.type),
      escapeCsvValue(e.at),
      e.rowKey != null ? escapeCsvValue(e.rowKey) : '',
      e.saleRowKey != null ? escapeCsvValue(e.saleRowKey) : '',
      e.lotFragmentId != null ? escapeCsvValue(e.lotFragmentId) : '',
      e.relatedFragmentId != null ? escapeCsvValue(e.relatedFragmentId) : '',
      escapeCsvValue(e.message),
    ]
    return cells.join(',')
  })
  return [headers.join(','), ...lines].join('\n')
}

export function formatPositionsCsv(positions: readonly RemainingPosition[]): string {
  const headers = [
    'fragmentId',
    'ticker',
    'source',
    'sharesOpen',
    'purchaseDateActual',
    'acquisitionDateAdjusted',
    'originalBasisPerShare',
    'basisPerShareAdjusted',
  ]
  const lines = positions.map((p) => {
    const cells = [
      escapeCsvValue(p.fragmentId),
      escapeCsvValue(p.ticker),
      escapeCsvValue(p.source),
      p.sharesOpen.toString(),
      escapeCsvValue(p.purchaseDateActual),
      escapeCsvValue(p.acquisitionDateAdjusted),
      p.originalBasisPerShare.toFixed(2),
      p.basisPerShareAdjusted.toFixed(2),
    ]
    return cells.join(',')
  })
  return [headers.join(','), ...lines].join('\n')
}
