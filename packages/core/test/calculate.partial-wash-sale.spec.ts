import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - partial wash sale (AC-2)', () => {
  it('sell 100 at loss, buy only 60 within window - 60 disallowed, 40 allowed', () => {
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
        shares: '60',
        pricePerShare: '9',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-02-25',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Loss: 100 * (8 - 10) = -200
    // Replacement: only 60 shares
    // Disallowed: 60 * 2 = 120
    // Allowed: 40 * 2 = 80
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(120)
    expect(result.summary.totalAllowedLosses.toNumber()).toBe(80)

    expect(result.form8949Data.shortTermRows).toHaveLength(1)
    const row = result.form8949Data.shortTermRows[0]!
    expect(row.adjustmentCode).toBe('W')
    expect(row.adjustmentAmount!.toNumber()).toBe(120)
    // gainOrLoss = proceeds - cost + adjustment = 800 - 1000 + 120 = -80
    expect(row.gainOrLoss.toNumber()).toBe(-80)

    // Remaining: 60 shares with basis 9 + 2 = 11
    expect(result.remainingPositions).toHaveLength(1)
    expect(result.remainingPositions[0]!.sharesOpen.toNumber()).toBe(60)
    expect(result.remainingPositions[0]!.basisPerShareAdjusted.toNumber()).toBe(11)
  })
})
