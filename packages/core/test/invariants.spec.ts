import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'

describe('invariants', () => {
  function runCalculation(ticker: string, rows: RowInput[]) {
    return AdjustedCostBasisCalculator.forTicker(ticker).addRows(rows).calculate()
  }

  describe('share conservation: total bought = total sold + total remaining', () => {
    it('holds for simple wash sale (AC-1)', () => {
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
          shares: '100',
          pricePerShare: '9',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-02-25',
        },
      ]
      const result = runCalculation('FIG', rows)

      const totalBought = rows
        .filter((r) => r.action === 'BUY')
        .reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalSold = rows
        .filter((r) => r.action === 'SELL')
        .reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalRemaining = result.remainingPositions.reduce(
        (s, p) => s + p.sharesOpen.toNumber(),
        0,
      )

      expect(totalBought).toBe(totalSold + totalRemaining)
    })

    it('holds for partial wash sale (AC-2)', () => {
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
      const result = runCalculation('FIG', rows)

      const totalBought = rows
        .filter((r) => r.action === 'BUY')
        .reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalSold = rows
        .filter((r) => r.action === 'SELL')
        .reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalRemaining = result.remainingPositions.reduce(
        (s, p) => s + p.sharesOpen.toNumber(),
        0,
      )

      expect(totalBought).toBe(totalSold + totalRemaining)
    })

    it('holds for cascade scenario (AC-7)', () => {
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
      const result = runCalculation('FIG', rows)

      const totalBought = rows
        .filter((r) => r.action === 'BUY')
        .reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalSold = rows
        .filter((r) => r.action === 'SELL')
        .reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalRemaining = result.remainingPositions.reduce(
        (s, p) => s + p.sharesOpen.toNumber(),
        0,
      )

      expect(totalBought).toBe(totalSold + totalRemaining)
    })
  })

  describe('loss conservation: sum(Form8949 gainOrLoss) - totalDisallowedLosses = economic gain/loss', () => {
    it('holds for simple wash sale (AC-1)', () => {
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
          shares: '100',
          pricePerShare: '9',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-02-25',
        },
      ]
      const result = runCalculation('FIG', rows)

      const sum8949 = [
        ...result.form8949Data.shortTermRows,
        ...result.form8949Data.longTermRows,
      ].reduce((s, r) => s + r.gainOrLoss.toNumber(), 0)
      // gainOrLoss = proceeds - costBasis + adjustment; economic = proceeds - costBasis = gainOrLoss - adjustment
      const economic = sum8949 - result.summary.totalDisallowedLosses.toNumber()

      // Economic: 100 * (8 - 10) = -200
      expect(economic).toBe(-200)
    })

    it('holds for partial wash sale (AC-2)', () => {
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
      const result = runCalculation('FIG', rows)

      const sum8949 = [
        ...result.form8949Data.shortTermRows,
        ...result.form8949Data.longTermRows,
      ].reduce((s, r) => s + r.gainOrLoss.toNumber(), 0)
      const economic = sum8949 - result.summary.totalDisallowedLosses.toNumber()

      expect(economic).toBe(-200)
    })

    it('holds for cascade scenario (AC-7)', () => {
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
      const result = runCalculation('FIG', rows)

      const sum8949 = [
        ...result.form8949Data.shortTermRows,
        ...result.form8949Data.longTermRows,
      ].reduce((s, r) => s + r.gainOrLoss.toNumber(), 0)
      const economic = sum8949 - result.summary.totalDisallowedLosses.toNumber()

      // First sale economic: -500. Second sale (wash-adj basis 21): -700. Total: -1200
      expect(economic).toBe(-1200)
    })
  })
})
