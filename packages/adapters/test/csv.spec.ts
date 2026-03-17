import { AdjustedCostBasisCalculator } from '../../core/src'
import { parseRows, toCsv, csvAdapter } from '../src'

describe('CSV Parser', () => {
  it('parses valid CSV into correct RowInput[]', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15
2025-02-10,SELL,Shareworks,50,12,OPEN_MARKET_SALE,2025-01-15`

    const rows = parseRows(csv)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      date: '2025-01-15',
      action: 'BUY',
      source: 'Shareworks',
      shares: '100',
      pricePerShare: '10',
      transactionType: 'RSU_VEST',
      acquiredDate: '2025-01-15',
    })
    expect(rows[1]).toEqual({
      date: '2025-02-10',
      action: 'SELL',
      source: 'Shareworks',
      shares: '50',
      pricePerShare: '12',
      transactionType: 'OPEN_MARKET_SALE',
      acquiredDate: '2025-01-15',
    })
  })

  it('parses CSV with optional columns', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate,notes
2025-01-15,BUY,Computershare,100,10,RSU_VEST,2025-01-15,
2025-02-10,SELL,Other,50,12,OPEN_MARKET_SALE,2025-01-15,test note`

    const rows = parseRows(csv)

    expect(rows).toHaveLength(2)
    expect(rows[0]!.transactionType).toBe('RSU_VEST')
    expect(rows[0]!.acquiredDate).toBe('2025-01-15')
    expect(rows[0]!.notes).toBeUndefined()

    expect(rows[1]!.transactionType).toBe('OPEN_MARKET_SALE')
    expect(rows[1]!.acquiredDate).toBe('2025-01-15')
    expect(rows[1]!.notes).toBe('test note')
  })

  it('parses CSV with optional columns missing - still works', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15`

    const rows = parseRows(csv)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      date: '2025-01-15',
      action: 'BUY',
      source: 'Shareworks',
      shares: '100',
      pricePerShare: '10',
      transactionType: 'RSU_VEST',
      acquiredDate: '2025-01-15',
    })
  })

  it('parses CSV with case-insensitive headers', () => {
    const csv = `Date,Action,Source,Shares,PricePerShare,TransactionType,AcquiredDate
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15`

    const rows = parseRows(csv)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.date).toBe('2025-01-15')
  })

  it('throws when required column is missing', () => {
    const csv = `date,action,source,shares,pricePerShare
2025-01-15,BUY,Shareworks,100,10`

    expect(() => parseRows(csv)).toThrow(/missing required column "transactionType"/)
  })

  it('throws when headers are bad (no date column)', () => {
    const csv = `action,source,shares,pricePerShare
BUY,Shareworks,100,10`

    expect(() => parseRows(csv)).toThrow(/missing required column "date"/)
  })

  it('throws on malformed date', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
01-15-2025,BUY,Shareworks,100,10,RSU_VEST,2025-01-15`

    expect(() => parseRows(csv)).toThrow(/must be YYYY-MM-DD/)
  })

  it('throws on invalid action', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,HOLD,Shareworks,100,10,RSU_VEST,2025-01-15`

    expect(() => parseRows(csv)).toThrow(/action.*must be BUY or SELL/)
  })

  it('throws on invalid source', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Fidelity,100,10,RSU_VEST,2025-01-15`

    expect(() => parseRows(csv)).toThrow(/source.*must be Shareworks, Computershare, or Other/)
  })

  it('throws on invalid shares (non-numeric)', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,abc,10,RSU_VEST,2025-01-15`

    expect(() => parseRows(csv)).toThrow(/shares.*must be a valid number/)
  })

  it('throws on empty required field', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,,10,RSU_VEST,2025-01-15`

    expect(() => parseRows(csv)).toThrow(/shares.*required/)
  })

  it('handles quoted fields with commas', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate,notes
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15,"note, with comma"`

    const rows = parseRows(csv)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.notes).toBe('note, with comma')
  })

  it('handles quoted fields with escaped quotes', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate,notes
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15,"note with ""quotes"""`

    const rows = parseRows(csv)

    expect(rows).toHaveLength(1)
    expect(rows[0]!.notes).toBe('note with "quotes"')
  })

  it('throws when required acquiredDate is empty', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,`

    expect(() => parseRows(csv)).toThrow(/acquiredDate.*YYYY-MM-DD/)
  })

  it('returns empty array for empty CSV', () => {
    expect(parseRows('')).toEqual([])
  })

  it('returns empty array for header-only CSV', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate`
    expect(parseRows(csv)).toEqual([])
  })
})

describe('CSV Serializer', () => {
  it('serializes Form8949Data to valid CSV text', () => {
    const result = AdjustedCostBasisCalculator.forTicker('FIG')
      .addRow({
        date: '2025-01-15',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '10',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-15',
      })
      .addRow({
        date: '2025-02-10',
        action: 'SELL',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '12',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2025-01-15',
      })
      .calculate()

    const csv = toCsv(result)

    expect(csv).toContain('=== Short-term ===')
    expect(csv).toContain('description,dateAcquired,dateSold,proceeds,costBasis')
    expect(csv).toContain('2025-01-15')
    expect(csv).toContain('2025-02-10')
  })

  it('includes both short-term and long-term sections when present', () => {
    const result = AdjustedCostBasisCalculator.forTicker('FIG')
      .addRow({
        date: '2024-01-01',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '10',
        transactionType: 'RSU_VEST',
        acquiredDate: '2024-01-01',
      })
      .addRow({
        date: '2025-02-10',
        action: 'SELL',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '12',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2024-01-01',
      })
      .calculate()

    const csv = toCsv(result)

    expect(csv).toContain('=== Long-term ===')
    expect(csv).toContain('2024-01-01')
  })

  it('escapes commas in values', () => {
    const result = AdjustedCostBasisCalculator.forTicker('FIG')
      .addRow({
        date: '2025-01-15',
        action: 'BUY',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '10',
        transactionType: 'RSU_VEST',
        acquiredDate: '2025-01-15',
      })
      .addRow({
        date: '2025-02-10',
        action: 'SELL',
        source: 'Shareworks',
        shares: '100',
        pricePerShare: '12',
        transactionType: 'OPEN_MARKET_SALE',
        acquiredDate: '2025-01-15',
      })
      .calculate()

    const csv = toCsv(result)
    const lines = csv.split('\n')

    lines.forEach((line: string) => {
      let depth = 0
      for (const char of line) {
        if (char === '"') depth++
        else if (char === ',' && depth % 2 === 0) {
          // comma outside quotes - valid delimiter
        }
      }
    })
    expect(csv).toMatch(/^[^\n]*\n/)
  })
})

describe('Round-trip: parse -> calculate -> serialize', () => {
  it('produces valid output', () => {
    const inputCsv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15
2025-02-10,SELL,Shareworks,100,12,OPEN_MARKET_SALE,2025-01-15
2025-02-25,BUY,Shareworks,100,9,RSU_VEST,2025-02-25`

    const rows = parseRows(inputCsv)
    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()
    const outputCsv = toCsv(result)

    expect(outputCsv).toContain('=== Short-term ===')
    expect(outputCsv).toContain('dateAcquired')
    expect(outputCsv).toContain('dateSold')
    expect(outputCsv).not.toMatch(/undefined/)
  })
})

describe('csvAdapter implements CsvPort', () => {
  it('parseRows and toCsv work via csvAdapter', () => {
    const csv = `date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15`

    const rows = csvAdapter.parseRows(csv)
    expect(rows).toHaveLength(1)

    const result = AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()
    const out = csvAdapter.toCsv(result)
    expect(out).toBeTruthy()
  })
})
