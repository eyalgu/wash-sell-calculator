import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'
import { serializeForSnapshot } from './serialize'

describe('determinism', () => {
  it('produces byte-identical JSON output across 10 runs for wash sale scenario', () => {
    const rows: RowInput[] = [
      {
        date: '2025-01-15',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '10',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-15',
      },
      {
        date: '2025-02-10',
        action: 'SELL',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '8',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2025-01-15',
      },
      {
        date: '2025-02-25',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '9',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-02-25',
      },
    ]

    const outputs: string[] = []
    const iterations = 10

    for (let i = 0; i < iterations; i++) {
      const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()
      const serialized = serializeForSnapshot(result)
      outputs.push(JSON.stringify(serialized))
    }

    const first = outputs[0]!
    for (let i = 1; i < iterations; i++) {
      expect(outputs[i]).toBe(first)
    }
  })
})
