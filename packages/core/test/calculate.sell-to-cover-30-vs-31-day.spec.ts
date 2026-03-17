import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - sell-to-cover timing (AC-4 vs AC-5)', () => {
  it('vest at exactly 30 days after sell-to-cover - triggers wash sale', () => {
    // Sell-to-cover on Jan 1 (from vest that day)
    // Next vest Jan 31 = exactly 30 days after
    const rows: RowInput[] = [
      {
        date: '2025-01-01',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '20',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-01',
      },
      {
        date: '2025-01-01',
        action: 'SELL',
        source: 'Shareworks',
        shares: '20',
        pricePerShare: '15',
        transactionType: 'SELL_TO_COVER',
        acquiredDate: '2025-01-01',
      },
      {
        date: '2025-01-31',
        action: 'BUY',
        source: 'Shareworks',
        shares: '50',
        pricePerShare: '18',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-31',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Sell-to-cover: 20 shares sold at 15, basis 20, loss $5/share = $100
    // Jan 31 vest is exactly 30 days after Jan 1 - in window
    // 20 of 50 replacement shares match
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(100)
    expect(result.form8949Data.shortTermRows).toHaveLength(1)
    expect(result.form8949Data.shortTermRows[0]!.adjustmentAmount!.toNumber()).toBe(100)

    // AC-4: Adjusted acq = Jan 31 - 0 days (bought and sold same day) = Jan 31
    // Replacement shares: 20 from Jan 31 vest get +$5 basis = $23
    const replacementPos = result.remainingPositions.find(
      (p) => p.basisPerShareAdjusted.toNumber() === 23,
    )
    expect(replacementPos).toBeDefined()
    expect(replacementPos!.acquisitionDateAdjusted).toBe('2025-01-31')
  })

  it('vest at 31 days after sell-to-cover - does NOT trigger wash sale', () => {
    const rows: RowInput[] = [
      {
        date: '2025-01-01',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '20',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-01',
      },
      {
        date: '2025-01-01',
        action: 'SELL',
        source: 'Shareworks',
        shares: '20',
        pricePerShare: '15',
        transactionType: 'SELL_TO_COVER',
        acquiredDate: '2025-01-01',
      },
      {
        date: '2025-02-01',
        action: 'BUY',
        source: 'Shareworks',
        shares: '50',
        pricePerShare: '18',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-02-01',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Feb 1 is 31 days after Jan 1 - outside window
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(0)
    expect(result.form8949Data.shortTermRows[0]!.adjustmentCode).toBeUndefined()
    expect(result.summary.totalAllowedLosses.toNumber()).toBe(100)
  })
})
