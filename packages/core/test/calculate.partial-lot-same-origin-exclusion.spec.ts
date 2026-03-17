import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - partial lot same-origin exclusion (AC-12)', () => {
  it('AC-12: partial lot sale — same-lot remainder excluded from replacement', () => {
    // Sell 50 of 100 from Jan 15 at loss; Jan 16 bought 20 within window.
    // Same-origin remainder (50 unsold from Jan 15) must NOT count as replacement.
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
        date: '2025-01-16',
        action: 'BUY',
        source: 'Shareworks',
        shares: '20',
        pricePerShare: '12',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-16',
      },
      {
        date: '2025-02-01',
        action: 'SELL',
        source: 'Shareworks',
        shares: '50',
        pricePerShare: '8',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2025-01-15',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Loss: 50 * (8 - 10) = -100
    // Replacement: only 20 shares (Jan 16), NOT the 50 unsold from Jan 15
    // Disallowed: 20 * 2 = 40
    // Allowed: 30 * 2 = 60
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(40)
    expect(result.summary.totalAllowedLosses.toNumber()).toBe(60)

    expect(result.form8949Data.shortTermRows).toHaveLength(1)
    const row = result.form8949Data.shortTermRows[0]!
    expect(row.adjustmentCode).toBe('W')
    expect(row.adjustmentAmount!.toNumber()).toBe(40)
    // gainOrLoss = proceeds - cost + adjustment = 400 - 500 + 40 = -60
    expect(row.gainOrLoss.toNumber()).toBe(-60)

    // Remaining: 50 shares @ $10 (Jan 15 unsold remainder), 20 shares @ $14 (Jan 16, fully adjusted)
    expect(result.remainingPositions).toHaveLength(2)
    const pos50 = result.remainingPositions.find((p) => p.basisPerShareAdjusted.toNumber() === 10)!
    const pos20 = result.remainingPositions.find((p) => p.basisPerShareAdjusted.toNumber() === 14)!
    expect(pos50.sharesOpen.toNumber()).toBe(50)
    expect(pos20.sharesOpen.toNumber()).toBe(20)
  })
})
