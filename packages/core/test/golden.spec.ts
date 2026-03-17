import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import type { RowInput } from '@wash-sale/core'
import { serializeForSnapshot } from './serialize'

function runAndSerialize(ticker: string, rows: RowInput[]): unknown {
  const result = AdjustedCostBasisCalculator.forTicker(ticker).addRows(rows).calculate()
  return serializeForSnapshot(result)
}

describe('golden snapshot tests', () => {
  describe('AC-1: simple wash sale - full disallowed loss', () => {
    it('matches golden snapshot', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-2: partial wash sale', () => {
    it('matches golden snapshot', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-3: MS PDF example - 79 sold, 82 bought, lot split', () => {
    it('matches golden snapshot', () => {
      const rows: RowInput[] = [
        {
          date: '2025-02-26',
          action: 'BUY',
          source: 'Shareworks',
          shares: '79',
          pricePerShare: '10',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-02-26',
        },
        {
          date: '2025-08-24',
          action: 'SELL',
          source: 'Shareworks',
          shares: '79',
          pricePerShare: '5',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2025-02-26',
        },
        {
          date: '2025-09-01',
          action: 'BUY',
          source: 'Shareworks',
          shares: '82',
          pricePerShare: '6',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-09-01',
        },
      ]
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-4: sell-to-cover 30-day trigger', () => {
    it('vest at exactly 30 days triggers wash sale', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-5: sell-to-cover 31-day non-trigger', () => {
    it('vest at 31 days does NOT trigger wash sale', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-6: cross-brokerage Computershare + Shareworks', () => {
    it('matches golden snapshot', () => {
      const rows: RowInput[] = [
        {
          date: '2025-07-31',
          action: 'BUY',
          source: 'Computershare',
          shares: '500',
          pricePerShare: '33',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-07-31',
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-7: cascade - multi-lot November pattern', () => {
    it('matches golden snapshot', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-8: HIFO sublot depletion', () => {
    it('matches golden snapshot', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-9: single-matching guard', () => {
    it('matches golden snapshot', () => {
      const rows: RowInput[] = [
        {
          date: '2025-01-05',
          action: 'BUY',
          source: 'Shareworks',
          shares: '60',
          pricePerShare: '50',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-01-05',
        },
        {
          date: '2024-12-15',
          action: 'BUY',
          source: 'Shareworks',
          shares: '60',
          pricePerShare: '50',
          transactionType: 'RSU_VEST',
          acquiredDate: '2024-12-15',
        },
        {
          date: '2025-01-10',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '50',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-01-10',
        },
        {
          date: '2025-01-20',
          action: 'SELL',
          source: 'Shareworks',
          shares: '60',
          pricePerShare: '40',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2025-01-05',
        },
        {
          date: '2025-01-25',
          action: 'SELL',
          source: 'Shareworks',
          shares: '60',
          pricePerShare: '35',
          transactionType: 'OPEN_MARKET_SALE',
          acquiredDate: '2024-12-15',
        },
      ]
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-10: partial replacement split', () => {
    it('matches golden snapshot', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-11: sell-to-cover self-trigger exclusion', () => {
    it('same-day vest excluded as replacement for its own sell-to-cover', () => {
      const rows: RowInput[] = [
        {
          date: '2025-01-15',
          action: 'BUY',
          source: 'Shareworks',
          shares: '100',
          pricePerShare: '20',
          transactionType: 'RSU_VEST',
          acquiredDate: '2025-01-15',
        },
        {
          date: '2025-01-15',
          action: 'SELL',
          source: 'Shareworks',
          shares: '20',
          pricePerShare: '15',
          transactionType: 'SELL_TO_COVER',
          acquiredDate: '2025-01-15',
        },
      ]
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })

  describe('AC-12: partial lot sale — same-lot remainder excluded from replacement', () => {
    it('matches golden snapshot', () => {
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
      const serialized = runAndSerialize('FIG', rows)
      expect(serialized).toMatchSnapshot()
    })
  })
})
