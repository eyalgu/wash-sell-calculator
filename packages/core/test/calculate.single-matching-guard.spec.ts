import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - single-matching guard (AC-9)', () => {
  it('two loss sales compete for same replacement pool; matching in loss-disposition order', () => {
    // PRD AC-9: Lot A sold Jan 20 (60 @ $40, basis $50), Lot B sold Jan 25 (60 @ $35, basis $50)
    // Replacement: 100 shares Jan 10 (only lot in window for both). First loss consumes 60, second gets 40.
    // Lot B acquired Dec 15 so it's outside the 30-day-before window for Jan 20 sale.
    const rows: RowInput[] = [
      {
        date: '2025-01-05',
        action: 'BUY',
        source: 'Shareworks',
        shares: '60',
        pricePerShare: '50',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-05',
      },
      {
        date: '2024-12-15',
        action: 'BUY',
        source: 'Shareworks',
        shares: '60',
        pricePerShare: '50',
        transactionType: 'RSU_VEST',
        acquiredDate: '2024-12-15',
      },
      {
        date: '2025-01-10',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '50',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-10',
      },
      {
        date: '2025-01-20',
        action: 'SELL',
        source: 'Shareworks',
        shares: '60',
        pricePerShare: '40',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2025-01-05',
      },
      {
        date: '2025-01-25',
        action: 'SELL',
        source: 'Shareworks',
        shares: '60',
        pricePerShare: '35',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2024-12-15',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // First loss (Jan 20): 60 × $10 = $600, all 60 matched → $600 disallowed
    // Second loss (Jan 25): 60 × $15 = $900, only 40 matched → $600 disallowed, $300 allowed
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(1200)
    expect(result.summary.totalAllowedLosses.toNumber()).toBe(300)

    // Replacement lot split: 60 shares @ $60 (50+10), 40 shares @ $65 (50+15)
    expect(result.remainingPositions).toHaveLength(2)
    const byBasis = [...result.remainingPositions].sort(
      (a, b) => a.basisPerShareAdjusted.toNumber() - b.basisPerShareAdjusted.toNumber(),
    )
    expect(byBasis[0]!.sharesOpen.toNumber()).toBe(60)
    expect(byBasis[0]!.basisPerShareAdjusted.toNumber()).toBe(60)
    expect(byBasis[1]!.sharesOpen.toNumber()).toBe(40)
    expect(byBasis[1]!.basisPerShareAdjusted.toNumber()).toBe(65)
  })
})
