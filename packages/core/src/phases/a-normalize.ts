import { Decimal } from '../decimal'
import { ValidationError } from '../errors'
import { AuditLog } from '../audit'
import type { RowInput, NormalizedRow, Ticker, Action, TransactionType } from '../types'

const VALID_TRANSACTION_TYPES: readonly TransactionType[] = [
  'RSU_VEST',
  'SELL_TO_COVER',
  'IPO_SALE',
  'OPEN_MARKET_SALE',
  'ESPP_PURCHASE',
  'ESPP_SALE',
]

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateDate(value: string, field: string, rowIdx: number): void {
  if (!ISO_DATE_RE.test(value)) {
    throw new ValidationError(
      `Invalid date "${value}" for field "${field}" in row ${rowIdx}. Expected YYYY-MM-DD.`,
      field,
      rowIdx,
    )
  }
  const d = new Date(value + 'T00:00:00Z')
  if (isNaN(d.getTime())) {
    throw new ValidationError(
      `Invalid date "${value}" for field "${field}" in row ${rowIdx}.`,
      field,
      rowIdx,
    )
  }
}

function validateDecimalString(value: string, field: string, rowIdx: number): Decimal {
  try {
    const dec = new Decimal(value)
    if (!dec.isFinite()) {
      throw new Error('not finite')
    }
    return dec
  } catch {
    throw new ValidationError(
      `Invalid number "${value}" for field "${field}" in row ${rowIdx}.`,
      field,
      rowIdx,
    )
  }
}

function actionPrecedence(action: Action): number {
  return action === 'BUY' ? 0 : 1
}

export function normalizeRows(
  ticker: Ticker,
  rows: readonly RowInput[],
  audit: AuditLog,
): NormalizedRow[] {
  if (!ticker || ticker.trim().length === 0) {
    throw new ValidationError('Ticker must be a non-empty string.', 'ticker')
  }

  if (rows.length === 0) {
    throw new ValidationError('At least one row is required.', 'rows')
  }

  const validated = rows.map((row, idx) => {
    validateDate(row.date, 'date', idx)
    validateDate(row.acquiredDate, 'acquiredDate', idx)

    if (!VALID_TRANSACTION_TYPES.includes(row.transactionType)) {
      throw new ValidationError(
        `Invalid transactionType "${row.transactionType}" in row ${idx}. Must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}.`,
        'transactionType',
        idx,
      )
    }

    if (row.action !== 'BUY' && row.action !== 'SELL') {
      throw new ValidationError(
        `Invalid action "${row.action}" in row ${idx}. Must be "BUY" or "SELL".`,
        'action',
        idx,
      )
    }

    const shares = validateDecimalString(row.shares, 'shares', idx)
    if (shares.lte(0)) {
      throw new ValidationError(
        `Shares must be positive in row ${idx}, got "${row.shares}".`,
        'shares',
        idx,
      )
    }

    const pricePerShare = validateDecimalString(row.pricePerShare, 'pricePerShare', idx)
    if (pricePerShare.lt(0)) {
      throw new ValidationError(
        `Price per share must be non-negative in row ${idx}, got "${row.pricePerShare}".`,
        'pricePerShare',
        idx,
      )
    }

    return {
      ...row,
      _shares: shares,
      _pricePerShare: pricePerShare,
      _originalIndex: idx,
    }
  })

  // Sort: date ASC, then BUY before SELL, then original index
  const sorted = [...validated].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    if (dateCmp !== 0) return dateCmp
    const actionCmp = actionPrecedence(a.action) - actionPrecedence(b.action)
    if (actionCmp !== 0) return actionCmp
    return a._originalIndex - b._originalIndex
  })

  // Generate rowKeys: per (date, action) pair, assign sequential index
  const groupCounts = new Map<string, number>()
  const normalized: NormalizedRow[] = sorted.map((row) => {
    const groupKey = `${row.date}_${row.action.toLowerCase()}`
    const idx = groupCounts.get(groupKey) ?? 0
    groupCounts.set(groupKey, idx + 1)

    const rowKey = `${row.date}_${row.action.toLowerCase()}_${idx}`
    const sortKey = `${row.date}_${actionPrecedence(row.action)}_${String(idx).padStart(4, '0')}`

    const normalizedRow: NormalizedRow = {
      rowKey,
      ticker,
      date: row.date,
      action: row.action,
      source: row.source,
      shares: row._shares,
      pricePerShare: row._pricePerShare,
      transactionType: row.transactionType,
      acquiredDate: row.acquiredDate,
      sortKey,
    }

    audit.emit('ROW_NORMALIZED', row.date, `Normalized row ${rowKey}`, {
      rowKey,
      payload: {
        action: row.action,
        shares: row._shares.toString(),
        pricePerShare: row._pricePerShare.toString(),
        source: row.source,
        transactionType: row.transactionType,
      },
    })

    return normalizedRow
  })

  return normalized
}
