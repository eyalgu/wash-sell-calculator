import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - sell-to-cover self-trigger exclusion (AC-11)', () => {
  it('same-day vest is excluded as replacement for its own sell-to-cover', () => {
    // RSU vest: 100 shares @ 20 on Jan 15
    // Sell-to-cover: 20 shares @ 15 (from that same vest)
    // The vest that generated the sell-to-cover does NOT count as replacement
    const rows: RowInput[] = [
      {
        date: '2025-01-15',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '20',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-15',
      },
      {
        date: '2025-01-15',
        action: 'SELL',
        source: 'Shareworks',
        shares: '20',
        pricePerShare: '15',
        transactionType: 'SELL_TO_COVER',
        acquiredDate: '2025-01-15',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Sell-to-cover: 20 shares, basis 20, proceeds 15, loss $100
    // Same-day vest is SELF - excluded per FR-2.5
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(0)
    expect(result.summary.totalAllowedLosses.toNumber()).toBe(100)
    expect(result.form8949Data.shortTermRows[0]!.adjustmentCode).toBeUndefined()
  })
})
