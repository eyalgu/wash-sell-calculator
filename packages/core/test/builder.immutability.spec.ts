import { AdjustedCostBasisCalculator } from '@wash-sale/core'
import { ValidationError } from '@wash-sale/core/errors'

describe('Builder API', () => {
  const validBuy = {
    date: '2025-01-15',
    action: 'BUY' as const,
    source: 'Shareworks' as const,
    shares: '100',
    pricePerShare: '10',
    transactionType: 'RSU_VEST' as const,
    acquiredDate: '2025-01-15',
  }

  const validSell = {
    date: '2025-02-10',
    action: 'SELL' as const,
    source: 'Shareworks' as const,
    shares: '100',
    pricePerShare: '8',
    transactionType: 'OPEN_MARKET_SALE' as const,
    acquiredDate: '2025-01-15',
  }

  describe('fluent chaining', () => {
    it('forTicker returns a builder', () => {
      const builder = AdjustedCostBasisCalculator.forTicker('FIG')
      expect(builder).toBeDefined()
      expect(typeof builder.addRow).toBe('function')
      expect(typeof builder.addRows).toBe('function')
      expect(typeof builder.calculate).toBe('function')
    })

    it('addRow returns the builder for chaining', () => {
      const builder = AdjustedCostBasisCalculator.forTicker('FIG')
      const returned = builder.addRow(validBuy)
      expect(returned).toBe(builder)
    })

    it('supports full fluent chain', () => {
      const result = AdjustedCostBasisCalculator.forTicker('FIG')
        .addRow(validBuy)
        .addRow(validSell)
        .calculate()
      expect(result).toBeDefined()
      expect(result.ticker).toBe('FIG')
    })
  })

  describe('immutability', () => {
    it('calculate() returns frozen objects', () => {
      const result = AdjustedCostBasisCalculator.forTicker('FIG')
        .addRow(validBuy)
        .addRow(validSell)
        .calculate()

      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.normalizedRows)).toBe(true)
      expect(Object.isFrozen(result.form8949Data)).toBe(true)
      expect(Object.isFrozen(result.summary)).toBe(true)
      expect(Object.isFrozen(result.auditLog)).toBe(true)
      expect(Object.isFrozen(result.warnings)).toBe(true)
    })

    it('cannot add rows after calculate()', () => {
      const builder = AdjustedCostBasisCalculator.forTicker('FIG')
        .addRow(validBuy)
        .addRow(validSell)

      builder.calculate()

      expect(() => builder.addRow(validBuy)).toThrow('Cannot add rows after calculate()')
    })

    it('cannot call calculate() twice', () => {
      const builder = AdjustedCostBasisCalculator.forTicker('FIG')
        .addRow(validBuy)
        .addRow(validSell)

      builder.calculate()

      expect(() => builder.calculate()).toThrow('calculate() has already been called')
    })
  })

  describe('input validation', () => {
    it('rejects empty ticker', () => {
      expect(() => AdjustedCostBasisCalculator.forTicker('').addRow(validBuy).calculate()).toThrow(
        ValidationError,
      )
    })

    it('rejects no rows', () => {
      expect(() => AdjustedCostBasisCalculator.forTicker('FIG').calculate()).toThrow(
        ValidationError,
      )
    })

    it('rejects invalid date format', () => {
      expect(() =>
        AdjustedCostBasisCalculator.forTicker('FIG')
          .addRow({ ...validBuy, date: '01/15/2025' })
          .addRow(validSell)
          .calculate(),
      ).toThrow(ValidationError)
    })

    it('rejects negative shares', () => {
      expect(() =>
        AdjustedCostBasisCalculator.forTicker('FIG')
          .addRow({ ...validBuy, shares: '-10' })
          .addRow(validSell)
          .calculate(),
      ).toThrow(ValidationError)
    })

    it('rejects zero shares', () => {
      expect(() =>
        AdjustedCostBasisCalculator.forTicker('FIG')
          .addRow({ ...validBuy, shares: '0' })
          .addRow(validSell)
          .calculate(),
      ).toThrow(ValidationError)
    })

    it('rejects non-numeric shares', () => {
      expect(() =>
        AdjustedCostBasisCalculator.forTicker('FIG')
          .addRow({ ...validBuy, shares: 'abc' })
          .addRow(validSell)
          .calculate(),
      ).toThrow(ValidationError)
    })

    it('rejects negative price per share', () => {
      expect(() =>
        AdjustedCostBasisCalculator.forTicker('FIG')
          .addRow({ ...validBuy, pricePerShare: '-5' })
          .addRow(validSell)
          .calculate(),
      ).toThrow(ValidationError)
    })

    it('allows zero price per share', () => {
      expect(() =>
        AdjustedCostBasisCalculator.forTicker('FIG')
          .addRow({ ...validBuy, pricePerShare: '0' })
          .addRow({ ...validSell, acquiredDate: '2025-01-15' })
          .calculate(),
      ).not.toThrow()
    })
  })
})
