import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - cross-brokerage scenarios', () => {
  describe('AC-6: Computershare loss + Shareworks vest replacement', () => {
    it('partial cross-brokerage wash: 500 sold, 200 replacement - PRD exact values', () => {
      // PRD AC-6: SELL 500 @ $30 via Computershare Jul 31, sold lot basis $33/share
      // VEST 200 @ $115 via Shareworks Aug 1
      // Disallowed: $3/share × 200 = $600. Allowed: $3/share × 300 = $900
      const rows: RowInput[] = [
        {
          date: '2025-07-31',
          action: 'BUY',
          source: 'Computershare',
          shares: '500',
          pricePerShare: '33',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-07-31',
          // Lot being sold - IPO shares acquired Jul 31
        },
        {
          date: '2025-07-31',
          action: 'SELL',
          source: 'Computershare',
          shares: '500',
          pricePerShare: '30',
          transactionType: 'IPO_SALE',
          acquiredDate: '2025-07-31',
        },
        {
          date: '2025-08-01',
          action: 'BUY',
          source: 'Shareworks',
          shares: '200',
          pricePerShare: '115',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-08-01',
        },
      ]

      const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

      // Loss: $3/share × 500 = $1500 total. 200 replacement → $600 disallowed, 300 → $900 allowed
      expect(result.summary.totalDisallowedLosses.toNumber()).toBe(600)
      expect(result.summary.totalAllowedLosses.toNumber()).toBe(900)

      expect(result.form8949Data.shortTermRows).toHaveLength(1)
      const formRow = result.form8949Data.shortTermRows[0]!
      expect(formRow.adjustmentCode).toBe('W')
      expect(formRow.adjustmentAmount!.toNumber()).toBe(600)
      expect(formRow.gainOrLoss.toNumber()).toBe(-900)

      // Remaining: 200 shares @ $118/share adjusted basis ($115 + $3)
      expect(result.remainingPositions).toHaveLength(1)
      expect(result.remainingPositions[0]!.source).toBe('Shareworks')
      expect(result.remainingPositions[0]!.sharesOpen.toNumber()).toBe(200)
      expect(result.remainingPositions[0]!.basisPerShareAdjusted.toNumber()).toBe(118)
    })
  })
})
