import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput, CalculationResult } from '@wash-sale/core/types'

function calc(rows: RowInput[]): CalculationResult {
  const builder = AdjustedCostBasisCalculator.forTicker('FIG')
  for (const row of rows) builder.addRow(row)
  return builder.calculate()
}

function buy(
  date: string,
  shares: string,
  price: string,
  source: 'Shareworks' | 'Computershare' = 'Shareworks',
): RowInput {
  return {
    date,
    action: 'BUY',
    source,
    shares,
    pricePerShare: price,
    transactionType: 'RSU_VEST',
    acquiredDate: date,
  }
}

function sell(
  date: string,
  shares: string,
  price: string,
  acquiredDate: string,
  source: 'Shareworks' | 'Computershare' = 'Shareworks',
): RowInput {
  return {
    date,
    action: 'SELL',
    source,
    shares,
    pricePerShare: price,
    transactionType: 'OPEN_MARKET_SALE',
    acquiredDate,
  }
}

describe('Phase A - Normalize', () => {
  describe('sorting', () => {
    it('sorts rows by date ascending', () => {
      const result = calc([
        buy('2025-03-01', '50', '10'),
        buy('2025-01-01', '100', '10'),
        sell('2025-04-01', '100', '12', '2025-01-01'),
      ])

      expect(result.normalizedRows[0]!.date).toBe('2025-01-01')
      expect(result.normalizedRows[1]!.date).toBe('2025-03-01')
      expect(result.normalizedRows[2]!.date).toBe('2025-04-01')
    })

    it('places BUYs before SELLs on the same day', () => {
      const result = calc([
        sell('2025-01-15', '50', '12', '2025-01-15'),
        buy('2025-01-15', '100', '10'),
      ])

      expect(result.normalizedRows[0]!.action).toBe('BUY')
      expect(result.normalizedRows[1]!.action).toBe('SELL')
    })

    it('preserves original order for same date+action', () => {
      const result = calc([
        buy('2025-01-01', '50', '10'),
        buy('2025-01-01', '30', '12'),
        sell('2025-02-01', '80', '11', '2025-01-01'),
      ])

      const buys = result.normalizedRows.filter((r) => r.action === 'BUY')
      expect(buys[0]!.shares.toNumber()).toBe(50)
      expect(buys[1]!.shares.toNumber()).toBe(30)
    })
  })

  describe('rowKey generation', () => {
    it('generates deterministic rowKeys', () => {
      const result = calc([
        buy('2025-01-01', '100', '10'),
        sell('2025-02-01', '100', '12', '2025-01-01'),
      ])

      expect(result.normalizedRows[0]!.rowKey).toBe('2025-01-01_buy_0')
      expect(result.normalizedRows[1]!.rowKey).toBe('2025-02-01_sell_0')
    })

    it('increments index for same date+action', () => {
      const result = calc([
        buy('2025-01-01', '50', '10'),
        buy('2025-01-01', '30', '12'),
        sell('2025-02-01', '80', '11', '2025-01-01'),
      ])

      expect(result.normalizedRows[0]!.rowKey).toBe('2025-01-01_buy_0')
      expect(result.normalizedRows[1]!.rowKey).toBe('2025-01-01_buy_1')
    })
  })

  describe('audit log', () => {
    it('emits ROW_NORMALIZED for each row', () => {
      const result = calc([
        buy('2025-01-01', '100', '10'),
        sell('2025-02-01', '100', '8', '2025-01-01'),
      ])

      const normalizeEvents = result.auditLog.filter((e) => e.type === 'ROW_NORMALIZED')
      expect(normalizeEvents).toHaveLength(2)
    })
  })

  describe('numeric parsing', () => {
    it('parses decimal shares correctly', () => {
      const result = calc([
        buy('2025-01-01', '100.5', '10'),
        sell('2025-02-01', '100.5', '12', '2025-01-01'),
      ])

      expect(result.normalizedRows[0]!.shares.toNumber()).toBe(100.5)
    })

    it('parses decimal prices correctly', () => {
      const result = calc([
        buy('2025-01-01', '100', '10.50'),
        sell('2025-02-01', '100', '12.75', '2025-01-01'),
      ])

      expect(result.normalizedRows[0]!.pricePerShare.toNumber()).toBe(10.5)
      expect(result.normalizedRows[1]!.pricePerShare.toNumber()).toBe(12.75)
    })
  })
})
