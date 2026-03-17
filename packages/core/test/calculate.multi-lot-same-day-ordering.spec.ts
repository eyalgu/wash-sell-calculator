import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - multi-lot same-day ordering', () => {
  it('multiple lots sold on same day - ordered by acquisition date (FIFO)', () => {
    // Two lots bought different dates, single sale spans both
    // FIFO: oldest acquisition date first (Jan 10 before Feb 10)
    const rows: RowInput[] = [
      {
        date: '2025-01-10',
        action: 'BUY',
        source: 'Shareworks',
        shares: '50',
        pricePerShare: '10',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-10',
      },
      {
        date: '2025-02-10',
        action: 'BUY',
        source: 'Shareworks',
        shares: '50',
        pricePerShare: '12',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-02-10',
      },
      {
        date: '2025-03-15',
        action: 'SELL',
        source: 'Shareworks',
        shares: '80',
        pricePerShare: '15',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2025-03-15',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // No acquiredDate: FIFO by purchase date - Jan 10 lot first, then Feb 10
    // Takes 50 from Jan 10, 30 from Feb 10
    const saleProcessedEvents = result.auditLog.filter((e) => e.type === 'SALE_PROCESSED')
    expect(saleProcessedEvents.length).toBe(2) // 50 from first, 30 from second

    // Verify gains: 50*(15-10)=250, 30*(15-12)=90, total 340
    const totalGain = result.form8949Data.shortTermRows.reduce(
      (sum, r) => sum + r.gainOrLoss.toNumber(),
      0,
    )
    expect(totalGain).toBe(340)

    // Remaining: 20 shares from Feb 10 lot
    expect(result.remainingPositions).toHaveLength(1)
    expect(result.remainingPositions[0]!.sharesOpen.toNumber()).toBe(20)
  })
})
