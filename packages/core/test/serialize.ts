import type { CalculationResult } from '@wash-sale/core'
import type Decimal from 'decimal.js'

function isDecimal(value: unknown): value is Decimal {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as Decimal).toNumber === 'function'
  )
}

function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }
  if (isDecimal(value)) {
    return value.toString()
  }
  if (Array.isArray(value)) {
    return value.map(toPlain)
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = toPlain(v)
    }
    return out
  }
  return value
}

/**
 * Serializes a CalculationResult to a plain JSON-serializable object.
 * Converts all Decimal instances to strings for deterministic snapshots.
 */
export function serializeForSnapshot(result: CalculationResult): unknown {
  return toPlain(result)
}
