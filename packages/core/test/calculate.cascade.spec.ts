import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

/**
 * AC-7: Multi-Lot November Loss Sale + December Replacement
 *
 * PRD scenario: Three vest lots (Sep, Oct, Nov), sell-to-cover on each vest day,
 * then sell remaining 180 shares @ $70 on Nov 15, then vest 100 @ $60 on Dec 1.
 * Replacement must match in acquisition order: first 60 Dec shares absorb Sep loss,
 * next 40 absorb Oct loss. Result: disallowed = $2,600; allowed = $1,000.
 */
describe('calculate - cascade / chain scenarios', () => {
  describe('AC-7: multi-lot November pattern (PRD exact scenario)', () => {
    it('matches replacement in acquisition order: 60+40 from Dec absorb Sep+Oct losses', () => {
      const rows: RowInput[] = [
        {
          date: '2025-09-01',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '100',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-09-01',
        },
        {
          date: '2025-09-01',
          action: 'SELL',
          source: 'Shareworks',
          shares: '40',
          pricePerShare: '100',
          transactionType: 'SELL_TO_COVER',
          acquiredDate: '2025-09-01',
        },
        {
          date: '2025-10-01',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '90',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-10-01',
        },
        {
          date: '2025-10-01',
          action: 'SELL',
          source: 'Shareworks',
          shares: '40',
          pricePerShare: '90',
          transactionType: 'SELL_TO_COVER',
          acquiredDate: '2025-10-01',
        },
        {
          date: '2025-11-01',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '80',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-11-01',
        },
        {
          date: '2025-11-01',
          action: 'SELL',
          source: 'Shareworks',
          shares: '40',
          pricePerShare: '80',
          transactionType: 'SELL_TO_COVER',
          acquiredDate: '2025-11-01',
        },
        // Nov 15: SELL 60 from Sep lot, 60 from Oct lot, 60 from Nov lot @ $70
        {
          date: '2025-11-15',
          action: 'SELL',
          source: 'Shareworks',
          shares: '60',
          pricePerShare: '70',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2025-09-01',
        },
        {
          date: '2025-11-15',
          action: 'SELL',
          source: 'Shareworks',
          shares: '60',
          pricePerShare: '70',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2025-10-01',
        },
        {
          date: '2025-11-15',
          action: 'SELL',
          source: 'Shareworks',
          shares: '60',
          pricePerShare: '70',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2025-11-01',
        },
        {
          date: '2025-12-01',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '60',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-12-01',
        },
      ]

      const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

      // Disallowed: 60*30 (Sep) + 40*20 (Oct) = 1800 + 800 = 2600
      expect(result.summary.totalDisallowedLosses.toNumber()).toBe(2600)

      // Allowed loss on Nov 15: 20 Oct shares * $20 + 60 Nov shares * $10 = 400 + 600 = 1000
      expect(result.summary.totalAllowedLosses.toNumber()).toBe(1000)

      // Form 8949: Nov 15 creates three loss sub-sales; Sep and (partial) Oct have wash adjustments
      const nov15Rows = result.form8949Data.shortTermRows.filter((r) => r.dateSold === '2025-11-15')
      expect(nov15Rows.length).toBeGreaterThanOrEqual(1)

      const totalNov15Adjustment = nov15Rows.reduce(
        (sum, r) => sum + (r.adjustmentAmount?.toNumber() ?? 0),
        0,
      )
      expect(totalNov15Adjustment).toBe(2600)

      // At least one Nov 15 row should have wash sale code
      const withWash = nov15Rows.filter((r) => r.adjustmentCode === 'W')
      expect(withWash.length).toBeGreaterThan(0)

      // Remaining: Dec 1 lot split into sublots (AC-8): 60 @ $90, 40 @ $80
      expect(result.remainingPositions).toHaveLength(2)
      const totalRemaining = result.remainingPositions.reduce(
        (s, p) => s + p.sharesOpen.toNumber(),
        0,
      )
      expect(totalRemaining).toBe(100)
      expect(result.remainingPositions.every((p) => p.purchaseDateActual === '2025-12-01')).toBe(
        true,
      )
      const pos90 = result.remainingPositions.find((p) => p.basisPerShareAdjusted.eq(90))
      const pos80 = result.remainingPositions.find((p) => p.basisPerShareAdjusted.eq(80))
      expect(pos90?.sharesOpen.toNumber()).toBe(60)
      expect(pos80?.sharesOpen.toNumber()).toBe(40)
    })
  })

  describe('chain: loss -> wash adjustment -> subsequent sale at loss -> new wash sale', () => {
    it('full cascade chain when replacement exists for second loss', () => {
      // Buy 100 @ 20 on Oct 1
      // Sell 100 @ 15 (loss) on Nov 1
      // Buy 100 @ 16 on Nov 15 (replacement)
      // Sell 100 @ 14 on Nov 20 (loss on adjusted lot)
      // Buy 100 @ 13 on Nov 25 (replacement for Nov 20 loss - within 30 days after)
      const rows: RowInput[] = [
        {
          date: '2025-10-01',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '20',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-10-01',
        },
        {
          date: '2025-11-01',
          action: 'SELL',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '15',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2025-10-01',
        },
        {
          date: '2025-11-15',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '16',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-11-15',
        },
        {
          date: '2025-11-20',
          action: 'SELL',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '14',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2025-11-15',
        },
        {
          date: '2025-11-25',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '13',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-11-25',
        },
      ]

      const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

      // Cascade: Nov 1 loss -> Nov 15 lot (basis 16+5=21)
      // Nov 20 sells adjusted lot: basis 21, proceeds 14, loss $7/share
      // Nov 25 replaces Nov 20 loss -> second wash
      expect(result.summary.totalDisallowedLosses.toNumber()).toBe(1200) // 500 + 700
      expect(result.form8949Data.shortTermRows).toHaveLength(2)

      const nov1Row = result.form8949Data.shortTermRows.find((r) => r.dateSold === '2025-11-01')!
      expect(nov1Row.adjustmentAmount!.toNumber()).toBe(500)

      const nov20Row = result.form8949Data.shortTermRows.find((r) => r.dateSold === '2025-11-20')!
      expect(nov20Row.adjustmentCode).toBe('W')
      expect(nov20Row.adjustmentAmount!.toNumber()).toBe(700) // 100 * 7

      // Remaining: 100 shares from Nov 25 with basis 13 + 7 = 20
      expect(result.remainingPositions).toHaveLength(1)
      expect(result.remainingPositions[0]!.basisPerShareAdjusted.toNumber()).toBe(20)
    })
  })
})
