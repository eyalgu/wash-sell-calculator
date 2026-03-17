import { calculate } from './calculator'
import { SequentialIdGenerator } from './id-generator'
import type { RowInput, CalculatorBuilder, CalculationResult, Ticker } from './types'

function deepFreeze<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      deepFreeze(value)
    }
  }
  return obj
}

class CalculatorBuilderImpl implements CalculatorBuilder {
  private readonly rows: RowInput[] = []
  private calculated = false

  constructor(private readonly ticker: Ticker) {}

  addRow(row: RowInput): CalculatorBuilder {
    if (this.calculated) {
      throw new Error('Cannot add rows after calculate() has been called. Create a new calculator.')
    }
    this.rows.push({ ...row })
    return this
  }

  addRows(rows: readonly RowInput[]): CalculatorBuilder {
    for (const row of rows) {
      this.addRow(row)
    }
    return this
  }

  calculate(): CalculationResult {
    if (this.calculated) {
      throw new Error('calculate() has already been called. Create a new calculator.')
    }
    this.calculated = true

    const idGen = new SequentialIdGenerator()
    const result = calculate(this.ticker, this.rows, idGen)

    return deepFreeze(result)
  }
}

export class AdjustedCostBasisCalculator {
  static forTicker(ticker: Ticker): CalculatorBuilder {
    return new CalculatorBuilderImpl(ticker)
  }
}
