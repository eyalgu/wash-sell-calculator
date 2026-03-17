import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - simple wash sale (AC-1)', () => {
  it('sell 100 at loss, buy 100 within 30 days - full disallowed loss', () => {
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
        date: '2025-02-20',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '9',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-02-20',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Loss: 100 * (8 - 10) = -200
    // Replacement: 100 shares bought Feb 20 (within 30 days after Feb 10)
    // Full disallowed
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(200)
    expect(result.summary.totalAllowedLosses.toNumber()).toBe(0)

    expect(result.form8949Data.shortTermRows).toHaveLength(1)
    const row = result.form8949Data.shortTermRows[0]!
    expect(row.adjustmentCode).toBe('W')
    expect(row.adjustmentAmount!.toNumber()).toBe(200)
    expect(row.gainOrLoss.toNumber()).toBe(0) // -200 loss + 200 adjustment = 0

    // Remaining: 100 shares with basis 9 + 2 = 11
    expect(result.remainingPositions).toHaveLength(1)
    expect(result.remainingPositions[0]!.sharesOpen.toNumber()).toBe(100)
    expect(result.remainingPositions[0]!.basisPerShareAdjusted.toNumber()).toBe(11)

    // AC-1: Adjusted acquisition date = replacement date - holding period
    // Holding period: Jan 15 to Feb 10 = 26 days. Adjusted acq = Feb 20 - 26 = Jan 25
    expect(result.remainingPositions[0]!.acquisitionDateAdjusted).toBe('2025-01-25')
  })
})
