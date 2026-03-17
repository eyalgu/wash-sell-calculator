import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'
import { Decimal } from 'decimal.js'

/**
 * AC-8: HIFO Sublot Depletion for Ambiguous Sell-to-Cover
 *
 * PRD scenario:
 * - VEST 100 shares @ $90 on Oct 1
 * - SELL_TO_COVER 40 shares on Oct 1
 * - VEST 100 shares @ $80 on Nov 1
 * - SELL_TO_COVER 40 shares on Nov 1
 * - SELL remaining shares (60 + 60 = 120) @ $70 on Nov 15 (two lots)
 * - VEST 100 shares @ $60 on Dec 1
 * - SELL_TO_COVER 40 shares on Dec 1
 *
 * Expected: Nov 15 creates two loss sub-sales. Dec 1 replacement shares create
 * two sublots (60 @ $80, 40 @ $70). Dec 1 sell-to-cover uses HIFO: deplete
 * from $80 sublot first.
 */
describe('calculate - HIFO sublot depletion (AC-8)', () => {
  const rows: RowInput[] = [
    {
      date: '2024-10-01',
      action: 'BUY',
      source: 'Shareworks',
      shares: '100',
      pricePerShare: '90',
      transactionType: 'RSU_VEST',
      acquiredDate: '2024-10-01',
    },
    {
      date: '2024-10-01',
      action: 'SELL',
      source: 'Shareworks',
      shares: '40',
      pricePerShare: '90',
      transactionType: 'SELL_TO_COVER',
      acquiredDate: '2024-10-01',
    },
    {
      date: '2024-11-01',
      action: 'BUY',
      source: 'Shareworks',
      shares: '100',
      pricePerShare: '80',
      transactionType: 'RSU_VEST',
      acquiredDate: '2024-11-01',
    },
    {
      date: '2024-11-01',
      action: 'SELL',
      source: 'Shareworks',
      shares: '40',
      pricePerShare: '80',
      transactionType: 'SELL_TO_COVER',
      acquiredDate: '2024-11-01',
    },
    {
      date: '2024-11-15',
      action: 'SELL',
      source: 'Shareworks',
      shares: '60',
      pricePerShare: '70',
      transactionType: 'OPEN_MARKET_SALE',
      acquiredDate: '2024-10-01',
    },
    {
      date: '2024-11-15',
      action: 'SELL',
      source: 'Shareworks',
      shares: '60',
      pricePerShare: '70',
      transactionType: 'OPEN_MARKET_SALE',
      acquiredDate: '2024-11-01',
    },
    {
      date: '2024-12-01',
      action: 'BUY',
      source: 'Shareworks',
      shares: '100',
      pricePerShare: '60',
      transactionType: 'RSU_VEST',
      acquiredDate: '2024-12-01',
    },
    {
      date: '2024-12-01',
      action: 'SELL',
      source: 'Shareworks',
      shares: '40',
      pricePerShare: '60',
      transactionType: 'SELL_TO_COVER',
      acquiredDate: '2024-12-01',
    },
  ]

  it('Nov 15 wash sale: 100 Dec 1 shares match losses creating two sublots (60 @ $80, 40 @ $70)', () => {
    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Nov 15: 60 Oct shares loss $20/share, 60 Nov shares loss $10/share
    // Replacement: 60 Dec shares get +$20 → $80, 40 Dec shares get +$10 → $70
    // Total disallowed = 60*20 + 40*10 = $1,600
    // Nov 15 allowed loss = 20 Nov shares * $10 = $200 (no replacement for remaining 20)
    // Dec 1 allowed loss = $800 (40 shares * $20, no replacement within 30 days)
    // Total allowed = 200 + 800 = $1,000
    const nov15Rows = result.form8949Data.shortTermRows.filter((r) => r.dateSold === '2024-11-15')
    expect(nov15Rows).toHaveLength(2) // Oct lot + Nov lot

    const totalDisallowedNov15 = nov15Rows.reduce(
      (sum, r) => sum.plus(r.adjustmentAmount ?? 0),
      new Decimal(0),
    )
    expect(totalDisallowedNov15.toNumber()).toBe(1600)

    expect(result.summary.totalAllowedLosses.toNumber()).toBe(1000)
  })

  it('Dec 1 sell-to-cover: HIFO depletes from $80 sublot first, realizing $800 loss', () => {
    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Dec 1 lot has sublots: 60 @ $80, 40 @ $70
    // HIFO: sell 40 from $80 sublot first
    // 40 * ($60 - $80) = -$800 loss
    const dec1Row = result.form8949Data.shortTermRows.find((r) => r.dateSold === '2024-12-01')
    expect(dec1Row).toBeDefined()
    expect(dec1Row!.gainOrLoss.toNumber()).toBe(-800)
  })

  it('Remaining positions: 20 @ $80 and 40 @ $70', () => {
    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    expect(result.remainingPositions).toHaveLength(2)

    const pos80 = result.remainingPositions.find(
      (p) => p.basisPerShareAdjusted.eq(80) && p.sharesOpen.eq(20),
    )
    const pos70 = result.remainingPositions.find(
      (p) => p.basisPerShareAdjusted.eq(70) && p.sharesOpen.eq(40),
    )

    expect(pos80).toBeDefined()
    expect(pos70).toBeDefined()
    expect(pos80!.purchaseDateActual).toBe('2024-12-01')
    expect(pos70!.purchaseDateActual).toBe('2024-12-01')
  })
})
