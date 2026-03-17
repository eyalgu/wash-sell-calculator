import { makeVest, makeSellToCover, makeIpoSale, makeBuy, makeSell } from '../src/fixtures'

describe('test-kit fixtures', () => {
  it('makeVest returns valid RowInput with defaults', () => {
    const row = makeVest()
    expect(row.action).toBe('BUY')
    expect(row.transactionType).toBe('RSU_VEST')
    expect(row.shares).toBe('100')
  })

  it('makeVest accepts overrides', () => {
    const row = makeVest({ date: '2025-06-01', shares: '50' })
    expect(row.date).toBe('2025-06-01')
    expect(row.shares).toBe('50')
  })

  it('makeSellToCover returns valid RowInput', () => {
    const row = makeSellToCover()
    expect(row.action).toBe('SELL')
    expect(row.transactionType).toBe('SELL_TO_COVER')
  })

  it('makeIpoSale returns valid RowInput', () => {
    const row = makeIpoSale()
    expect(row.transactionType).toBe('IPO_SALE')
    expect(row.source).toBe('Computershare')
  })

  it('makeBuy and makeSell return generic row types', () => {
    expect(makeBuy().action).toBe('BUY')
    expect(makeSell().action).toBe('SELL')
  })
})
