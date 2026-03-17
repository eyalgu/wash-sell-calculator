import type { CalculationResult, Form8949Row } from '@wash-sale/core'

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function decimalToString(val: { toString: () => string }): string {
  return val.toString()
}

function serializeForm8949Rows(rows: readonly Form8949Row[]): string {
  const headers = [
    'description',
    'dateAcquired',
    'dateSold',
    'proceeds',
    'costBasis',
    'adjustmentCode',
    'adjustmentAmount',
    'gainOrLoss',
    'term',
  ]
  const headerLine = headers.join(',')

  const dataLines = rows.map((row) => {
    const cells = [
      escapeCsvValue(row.description),
      escapeCsvValue(row.dateAcquired),
      escapeCsvValue(row.dateSold),
      decimalToString(row.proceeds),
      decimalToString(row.costBasis),
      row.adjustmentCode ?? '',
      row.adjustmentAmount ? decimalToString(row.adjustmentAmount) : '',
      decimalToString(row.gainOrLoss),
      escapeCsvValue(row.term),
    ]
    return cells.join(',')
  })

  return [headerLine, ...dataLines].join('\n')
}

/**
 * Convert CalculationResult to CSV text for Form 8949 export.
 * Produces two sections: short-term and long-term.
 */
export function toCsv(result: CalculationResult): string {
  const { form8949Data } = result
  const sections: string[] = []

  if (form8949Data.shortTermRows.length > 0) {
    sections.push('=== Short-term ===')
    sections.push(serializeForm8949Rows(form8949Data.shortTermRows))
  }

  if (form8949Data.longTermRows.length > 0) {
    sections.push('=== Long-term ===')
    sections.push(serializeForm8949Rows(form8949Data.longTermRows))
  }

  if (form8949Data.exportNotes.length > 0) {
    sections.push('=== Notes ===')
    sections.push(form8949Data.exportNotes.map((note) => escapeCsvValue(note)).join('\n'))
  }

  if (sections.length === 0) {
    return 'description,dateAcquired,dateSold,proceeds,costBasis,adjustmentCode,adjustmentAmount,gainOrLoss,term'
  }

  return sections.join('\n\n')
}
