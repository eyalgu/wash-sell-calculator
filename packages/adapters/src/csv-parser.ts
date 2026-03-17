import type { Action, RowInput, Source, TransactionType } from '@wash-sale/core'

const REQUIRED_COLUMNS = [
  'date',
  'action',
  'source',
  'shares',
  'pricePerShare',
  'transactionType',
  'acquiredDate',
] as const
const OPTIONAL_COLUMNS = ['notes'] as const
const VALID_SOURCES: readonly Source[] = ['Shareworks', 'Computershare', 'Other']
const VALID_TRANSACTION_TYPES: readonly TransactionType[] = [
  'RSU_VEST',
  'SELL_TO_COVER',
  'IPO_SALE',
  'OPEN_MARKET_SALE',
  'ESPP_PURCHASE',
  'ESPP_SALE',
]

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const NUMERIC_REGEX = /^-?\d+(\.\d+)?$/

function unescapeCsvValue(val: string): string {
  // Only replace "" with " - we don't strip delimiters (parser omits them)
  return val.replace(/""/g, '"')
}

function parseCsvRows(csvText: string): string[][] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '""' // preserve "" so cell-splitting pass can decode escaped quote
        i++
      } else {
        inQuotes = !inQuotes
        current += char // preserve quotes so cell-splitting pass can handle them
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.length > 0) {
        lines.push(current)
        current = ''
      }
      if (char === '\r' && csvText[i + 1] === '\n') i++
    } else {
      current += char
    }
  }
  if (current.length > 0) lines.push(current)

  return lines.map((line) => {
    const cells: string[] = []
    let cell = ''
    inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (c === ',' && !inQuotes) {
        cells.push(unescapeCsvValue(cell))
        cell = ''
      } else {
        cell += c
      }
    }
    cells.push(unescapeCsvValue(cell))
    return cells
  })
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase()
}

function findColumnIndex(headers: string[], columns: readonly string[]): Map<string, number> {
  const normalized = headers.map(normalizeHeader)
  const map = new Map<string, number>()
  for (const col of columns) {
    const idx = normalized.indexOf(col.toLowerCase())
    if (idx >= 0) map.set(col, idx)
  }
  return map
}

function requireColumn(map: Map<string, number>, name: string, headers: string[]): number {
  const idx = map.get(name)
  if (idx === undefined) {
    throw new Error(
      `CSV parse error: missing required column "${name}". Found columns: ${headers.join(', ') || '(none)'}`,
    )
  }
  return idx
}

function validateIsoDate(val: string, field: string, rowNum: number): void {
  if (!val || !ISO_DATE_REGEX.test(val)) {
    throw new Error(`CSV parse error: row ${rowNum}: "${field}" must be YYYY-MM-DD, got "${val}"`)
  }
}

function validateAction(val: string, rowNum: number): Action {
  const upper = val.toUpperCase().trim()
  if (upper !== 'BUY' && upper !== 'SELL') {
    throw new Error(`CSV parse error: row ${rowNum}: "action" must be BUY or SELL, got "${val}"`)
  }
  return upper as Action
}

function validateSource(val: string, rowNum: number): Source {
  const trimmed = val.trim()
  if (!VALID_SOURCES.includes(trimmed as Source)) {
    throw new Error(
      `CSV parse error: row ${rowNum}: "source" must be Shareworks, Computershare, or Other, got "${val}"`,
    )
  }
  return trimmed as Source
}

function validateDecimalString(val: string, field: string, rowNum: number): string {
  const trimmed = val.trim()
  if (trimmed === '') {
    throw new Error(`CSV parse error: row ${rowNum}: "${field}" is required, got empty value`)
  }
  if (!NUMERIC_REGEX.test(trimmed)) {
    throw new Error(
      `CSV parse error: row ${rowNum}: "${field}" must be a valid number, got "${val}"`,
    )
  }
  return trimmed
}

function validateTransactionType(val: string, rowNum: number): TransactionType {
  const trimmed = val.trim()
  if (!trimmed) {
    throw new Error(
      `CSV parse error: row ${rowNum}: "transactionType" is required, got empty value`,
    )
  }
  if (!VALID_TRANSACTION_TYPES.includes(trimmed as TransactionType)) {
    throw new Error(
      `CSV parse error: row ${rowNum}: "transactionType" must be one of ${VALID_TRANSACTION_TYPES.join(', ')}, got "${val}"`,
    )
  }
  return trimmed as TransactionType
}

/**
 * Parse CSV text into RowInput[].
 * Required columns: date, action, source, shares, pricePerShare, transactionType, acquiredDate.
 * Optional columns: notes.
 */
export function parseRows(csvText: string): RowInput[] {
  const rows = parseCsvRows(csvText)
  if (rows.length === 0) return []

  const rawHeaders = rows[0]!
  const colMap = findColumnIndex(rawHeaders, [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS])

  for (const req of REQUIRED_COLUMNS) {
    requireColumn(colMap, req, rawHeaders)
  }

  const dateIdx = requireColumn(colMap, 'date', rawHeaders)
  const actionIdx = requireColumn(colMap, 'action', rawHeaders)
  const sourceIdx = requireColumn(colMap, 'source', rawHeaders)
  const sharesIdx = requireColumn(colMap, 'shares', rawHeaders)
  const pricePerShareIdx = requireColumn(colMap, 'pricePerShare', rawHeaders)
  const transactionTypeIdx = requireColumn(colMap, 'transactionType', rawHeaders)
  const acquiredDateIdx = requireColumn(colMap, 'acquiredDate', rawHeaders)
  const notesIdx = colMap.get('notes')

  const result: RowInput[] = []
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]!
    const rowNum = i + 1

    const dateVal = cells[dateIdx] ?? ''
    const actionVal = cells[actionIdx] ?? ''
    const sourceVal = cells[sourceIdx] ?? ''
    const sharesVal = cells[sharesIdx] ?? ''
    const priceVal = cells[pricePerShareIdx] ?? ''

    validateIsoDate(dateVal, 'date', rowNum)
    const action = validateAction(actionVal, rowNum)
    const source = validateSource(sourceVal, rowNum)
    const shares = validateDecimalString(sharesVal, 'shares', rowNum)
    const pricePerShare = validateDecimalString(priceVal, 'pricePerShare', rowNum)

    const transactionTypeVal = cells[transactionTypeIdx] ?? ''
    const acquiredDateVal = cells[acquiredDateIdx] ?? ''
    const transactionType = validateTransactionType(transactionTypeVal, rowNum)
    validateIsoDate(acquiredDateVal, 'acquiredDate', rowNum)

    const row: RowInput = {
      date: dateVal.trim(),
      action,
      source,
      shares,
      pricePerShare,
      transactionType,
      acquiredDate: acquiredDateVal.trim(),
    }
    if (notesIdx !== undefined) {
      const n = cells[notesIdx]?.trim()
      if (n) row.notes = n
    }

    result.push(row)
  }

  return result
}
