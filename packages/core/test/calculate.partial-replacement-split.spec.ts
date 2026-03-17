import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('calculate - partial replacement split (AC-10)', () => {
  it('80 shares matched out of 100 share fragment - splits into adjusted and unadjusted', () => {
    // Sell 80 at loss
    // Buy 100 within window - only 80 match
    // Fragment splits: 80 adjusted, 20 unadjusted
    const rows: RowInput[] = [
      {
        date: '2025-01-15',
        action: 'BUY',
        source: 'Shareworks',
        shares: '80',
        pricePerShare: '20',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-15',
      },
      {
        date: '2025-02-10',
        action: 'SELL',
        source: 'Shareworks',
        shares: '80',
        pricePerShare: '15',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2025-01-15',
      },
      {
        date: '2025-02-20',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '18',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-02-20',
      },
    ]

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()

    // Loss: 80 * 5 = 400. 80 of 100 replacement shares match.
    expect(result.summary.totalDisallowedLosses.toNumber()).toBe(400)

    // Remaining: split - 80 shares with basis 18+5=23, 20 shares with basis 18
    expect(result.remainingPositions).toHaveLength(2)
    const adjustedPos = result.remainingPositions.find(
      (p) => p.basisPerShareAdjusted.toNumber() === 23,
    )!
    const unadjustedPos = result.remainingPositions.find(
      (p) => p.basisPerShareAdjusted.toNumber() === 18,
    )!
    expect(adjustedPos.sharesOpen.toNumber()).toBe(80)
    expect(unadjustedPos.sharesOpen.toNumber()).toBe(20)
  })
})
