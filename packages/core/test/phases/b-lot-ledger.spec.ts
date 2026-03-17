import { buildLotLedger } from '@wash-sale/core/phases/b-lot-ledger'
import { AuditLog } from '@wash-sale/core/audit'
import { SequentialIdGenerator } from '@wash-sale/core/id-generator'
import { LotIdentificationError, InsufficientSharesError } from '@wash-sale/core/errors'
import { d, ZERO } from '@wash-sale/core/decimal'
import type { NormalizedRow } from '@wash-sale/core/types'

function makeIdGen() {
  return new SequentialIdGenerator()
}

function makeAudit(idGen = makeIdGen()) {
  return { audit: new AuditLog(idGen), idGen }
}

interface RowOpts {
  date: string
  shares: string
  pricePerShare: string
  rowKey?: string
  ticker?: string
  source?: 'Shareworks' | 'Computershare' | 'Other'
  transactionType?: NormalizedRow['transactionType']
  acquiredDate?: string
  sortKey?: string
}

function buyRow(opts: RowOpts): NormalizedRow {
  return {
    rowKey: opts.rowKey ?? `${opts.date}_buy_0`,
    ticker: opts.ticker ?? 'FIG',
    date: opts.date,
    action: 'BUY',
    source: opts.source ?? 'Shareworks',
    shares: d(opts.shares),
    pricePerShare: d(opts.pricePerShare),
    transactionType: opts.transactionType ?? 'RSU_VEST',
    acquiredDate: opts.acquiredDate ?? opts.date,
    sortKey: opts.sortKey ?? `${opts.date}_0_0`,
  }
}

function sellRow(opts: RowOpts): NormalizedRow {
  return {
    rowKey: opts.rowKey ?? `${opts.date}_sell_0`,
    ticker: opts.ticker ?? 'FIG',
    date: opts.date,
    action: 'SELL',
    source: opts.source ?? 'Shareworks',
    shares: d(opts.shares),
    pricePerShare: d(opts.pricePerShare),
    transactionType: opts.transactionType ?? 'OPEN_MARKET_SALE',
    acquiredDate: opts.acquiredDate ?? opts.date,
    sortKey: opts.sortKey ?? `${opts.date}_1_0`,
  }
}

describe('Phase B - Lot Ledger', () => {
  describe('BUY creates LotFragment', () => {
    it('creates a fragment with correct initial fields', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '42.50' }),
      ]

      const { fragments, salePortions } = buildLotLedger(rows, idGen, audit)

      expect(fragments).toHaveLength(1)
      expect(salePortions).toHaveLength(0)

      const frag = fragments[0]!
      expect(frag.fragmentId).toBe('frag_001')
      expect(frag.originRowKey).toBe('2025-01-15_buy_0')
      expect(frag.ticker).toBe('FIG')
      expect(frag.source).toBe('Shareworks')
      expect(frag.sharesOpen.eq(d('100'))).toBe(true)
      expect(frag.purchaseDateActual).toBe('2025-01-15')
      expect(frag.acquisitionDateAdjusted).toBe('2025-01-15')
      expect(frag.basisPerShareAdjusted.eq(d('42.50'))).toBe(true)
      expect(frag.originalBasisPerShare.eq(d('42.50'))).toBe(true)
      expect(frag.washAdjustmentHistory).toEqual([])
      expect(frag.consumedAsReplacement.eq(ZERO)).toBe(true)
    })

    it('creates multiple fragments from multiple BUYs', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '100',
          pricePerShare: '42.50',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '50',
          pricePerShare: '45.00',
          rowKey: '2025-02-15_buy_0',
        }),
      ]

      const { fragments } = buildLotLedger(rows, idGen, audit)

      expect(fragments).toHaveLength(2)
      expect(fragments[0]!.fragmentId).toBe('frag_001')
      expect(fragments[0]!.sharesOpen.eq(d('100'))).toBe(true)
      expect(fragments[1]!.fragmentId).toBe('frag_002')
      expect(fragments[1]!.sharesOpen.eq(d('50'))).toBe(true)
    })

    it('preserves source from the BUY row', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10', source: 'Computershare' }),
      ]

      const { fragments } = buildLotLedger(rows, idGen, audit)
      expect(fragments[0]!.source).toBe('Computershare')
    })

    it('emits LOT_CREATED audit event for each BUY', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '100',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '50',
          pricePerShare: '12',
          rowKey: '2025-02-15_buy_0',
        }),
      ]

      buildLotLedger(rows, idGen, audit)

      const created = audit.getEntries().filter((e) => e.type === 'LOT_CREATED')
      expect(created).toHaveLength(2)
      expect(created[0]!.lotFragmentId).toBe('frag_001')
      expect(created[1]!.lotFragmentId).toBe('frag_002')
    })
  })

  describe('SELL resolves to lots via acquiredDate', () => {
    it('resolves sell to lot with matching acquiredDate', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '100',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '100',
          pricePerShare: '15',
          rowKey: '2025-02-15_buy_0',
        }),
        sellRow({
          date: '2025-03-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-02-15',
          rowKey: '2025-03-01_sell_0',
        }),
      ]

      const { salePortions, fragments } = buildLotLedger(rows, idGen, audit)

      expect(salePortions).toHaveLength(1)
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_002')
      expect(salePortions[0]!.shares.eq(d('100'))).toBe(true)

      // First lot unchanged, second lot fully consumed
      expect(fragments[0]!.sharesOpen.eq(d('100'))).toBe(true)
      expect(fragments[1]!.sharesOpen.eq(ZERO)).toBe(true)
    })

    it('calculates correct proceeds, cost, and gainLoss', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)
      const sp = salePortions[0]!

      expect(sp.proceeds.eq(d('1200'))).toBe(true) // 100 * 12
      expect(sp.basisPerShareAtSale.eq(d('10'))).toBe(true)
      expect(sp.gainLoss.eq(d('200'))).toBe(true) // 1200 - 1000
    })

    it('calculates loss correctly', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '8',
          acquiredDate: '2025-01-15',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)
      const sp = salePortions[0]!

      expect(sp.proceeds.eq(d('800'))).toBe(true)
      expect(sp.gainLoss.eq(d('-200'))).toBe(true) // 800 - 1000
    })

    it("records originalAcquiredDateForOrdering from the fragment's purchaseDateActual", () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)
      expect(salePortions[0]!.originalAcquiredDateForOrdering).toBe('2025-01-15')
    })
  })

  describe('FIFO fallback', () => {
    it('uses FIFO ordering when acquiredDate is not provided', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '50',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '50',
          pricePerShare: '15',
          rowKey: '2025-02-15_buy_0',
        }),
        sellRow({
          date: '2025-03-01',
          shares: '50',
          pricePerShare: '12',
          rowKey: '2025-03-01_sell_0',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)

      expect(salePortions).toHaveLength(1)
      // FIFO: should sell from earliest lot (Jan 15)
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_001')
    })

    it('depletes FIFO lots across multiple fragments', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '30',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '50',
          pricePerShare: '15',
          rowKey: '2025-02-15_buy_0',
        }),
        sellRow({
          date: '2025-03-01',
          shares: '60',
          pricePerShare: '12',
          rowKey: '2025-03-01_sell_0',
        }),
      ]

      const { salePortions, fragments } = buildLotLedger(rows, idGen, audit)

      // 60 shares sold: 30 from first lot, 30 from second
      expect(salePortions).toHaveLength(2)
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_001')
      expect(salePortions[0]!.shares.eq(d('30'))).toBe(true)
      expect(salePortions[1]!.soldFromFragmentId).toBe('frag_002')
      expect(salePortions[1]!.shares.eq(d('30'))).toBe(true)

      // First lot fully depleted, second partially
      expect(fragments[0]!.sharesOpen.eq(ZERO)).toBe(true)
      expect(fragments[1]!.sharesOpen.eq(d('20'))).toBe(true)
    })

    it('falls back to FIFO when acquiredDate matches no lots', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '100',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '100',
          pricePerShare: '15',
          rowKey: '2025-02-15_buy_0',
        }),
        sellRow({
          date: '2025-03-01',
          shares: '50',
          pricePerShare: '12',
          acquiredDate: '2025-03-15', // matches no lots
          rowKey: '2025-03-01_sell_0',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)

      // No acquiredDate match -> FIFO from earliest
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_001')
    })
  })

  describe('partial lot sale (fragment splitting)', () => {
    it('splits fragment into sold and remaining portions', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '40',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      const { salePortions, fragments } = buildLotLedger(rows, idGen, audit)

      expect(salePortions).toHaveLength(1)
      expect(salePortions[0]!.shares.eq(d('40'))).toBe(true)
      expect(fragments[0]!.sharesOpen.eq(d('60'))).toBe(true)
    })

    it('emits LOT_SPLIT audit event on partial sale', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '40',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      buildLotLedger(rows, idGen, audit)

      const splits = audit.getEntries().filter((e) => e.type === 'LOT_SPLIT')
      expect(splits).toHaveLength(1)
      expect(splits[0]!.payload).toMatchObject({
        soldShares: '40',
        remainingShares: '60',
      })
    })

    it('does not emit LOT_SPLIT on a full lot sale', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      buildLotLedger(rows, idGen, audit)

      const splits = audit.getEntries().filter((e) => e.type === 'LOT_SPLIT')
      expect(splits).toHaveLength(0)
    })

    it('allows multiple partial sales from the same lot', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '30',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
          rowKey: '2025-02-01_sell_0',
        }),
        sellRow({
          date: '2025-03-01',
          shares: '40',
          pricePerShare: '11',
          acquiredDate: '2025-01-15',
          rowKey: '2025-03-01_sell_0',
        }),
      ]

      const { salePortions, fragments } = buildLotLedger(rows, idGen, audit)

      expect(salePortions).toHaveLength(2)
      expect(salePortions[0]!.shares.eq(d('30'))).toBe(true)
      expect(salePortions[1]!.shares.eq(d('40'))).toBe(true)
      expect(fragments[0]!.sharesOpen.eq(d('30'))).toBe(true) // 100 - 30 - 40
    })
  })

  describe('insufficient shares', () => {
    it('throws InsufficientSharesError when selling more than available', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '50', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      expect(() => buildLotLedger(rows, idGen, audit)).toThrow(InsufficientSharesError)
    })

    it('throws LotIdentificationError when no matching lots exist', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        sellRow({ date: '2025-02-01', shares: '100', pricePerShare: '12' }),
      ]

      expect(() => buildLotLedger(rows, idGen, audit)).toThrow(LotIdentificationError)
    })

    it('includes requested and available shares in error', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '50', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      try {
        buildLotLedger(rows, idGen, audit)
        fail('Expected InsufficientSharesError')
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientSharesError)
        const e = err as InstanceType<typeof InsufficientSharesError>
        expect(e.requestedShares).toBe('100')
        expect(e.availableShares).toBe('50')
      }
    })
  })

  describe('HIFO sublot depletion (FR-3.6)', () => {
    it('selects highest-basis sublot first when acquiredDate matches multiple fragments', () => {
      const { audit, idGen } = makeAudit()

      // Two BUYs on same date with different basis (e.g., wash-adjusted and original)
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '50',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-01-15',
          shares: '50',
          pricePerShare: '20',
          rowKey: '2025-01-15_buy_1',
        }),
        sellRow({
          date: '2025-02-01',
          shares: '50',
          pricePerShare: '15',
          acquiredDate: '2025-01-15',
          rowKey: '2025-02-01_sell_0',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)

      expect(salePortions).toHaveLength(1)
      // HIFO: should sell from highest basis ($20) fragment first
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_002')
      expect(salePortions[0]!.basisPerShareAtSale.eq(d('20'))).toBe(true)
    })

    it('depletes HIFO across multiple same-date fragments', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '30',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-01-15',
          shares: '40',
          pricePerShare: '25',
          rowKey: '2025-01-15_buy_1',
        }),
        buyRow({
          date: '2025-01-15',
          shares: '30',
          pricePerShare: '15',
          rowKey: '2025-01-15_buy_2',
        }),
        sellRow({
          date: '2025-02-01',
          shares: '60',
          pricePerShare: '18',
          acquiredDate: '2025-01-15',
          rowKey: '2025-02-01_sell_0',
        }),
      ]

      const { salePortions, fragments } = buildLotLedger(rows, idGen, audit)

      // HIFO order: $25 (40 shares) -> $15 (30 shares) -> $10 (30 shares)
      // Selling 60: take 40 from $25 lot, 20 from $15 lot
      expect(salePortions).toHaveLength(2)
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_002') // $25
      expect(salePortions[0]!.shares.eq(d('40'))).toBe(true)
      expect(salePortions[1]!.soldFromFragmentId).toBe('frag_003') // $15
      expect(salePortions[1]!.shares.eq(d('20'))).toBe(true)

      // Remaining: frag_001 untouched, frag_002 depleted, frag_003 partially
      expect(fragments[0]!.sharesOpen.eq(d('30'))).toBe(true)
      expect(fragments[1]!.sharesOpen.eq(ZERO)).toBe(true)
      expect(fragments[2]!.sharesOpen.eq(d('10'))).toBe(true)
    })

    it('uses fragmentId as tie-breaker when basis is equal', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '50',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-01-15',
          shares: '50',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_1',
        }),
        sellRow({
          date: '2025-02-01',
          shares: '50',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
          rowKey: '2025-02-01_sell_0',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)

      expect(salePortions).toHaveLength(1)
      // Same basis - tie-break by fragmentId ascending
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_001')
    })

    it('does NOT apply HIFO when acquiredDate is not specified (FIFO only)', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '50',
          pricePerShare: '20',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '50',
          pricePerShare: '10',
          rowKey: '2025-02-15_buy_0',
        }),
        // No acquiredDate - should use FIFO not HIFO
        sellRow({
          date: '2025-03-01',
          shares: '50',
          pricePerShare: '15',
          rowKey: '2025-03-01_sell_0',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)

      // FIFO: earliest lot first (Jan 15 @ $20), not cheapest
      expect(salePortions[0]!.soldFromFragmentId).toBe('frag_001')
      expect(salePortions[0]!.basisPerShareAtSale.eq(d('20'))).toBe(true)
    })
  })

  describe('SALE_PROCESSED audit events', () => {
    it('emits SALE_PROCESSED for each sale allocation', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({
          date: '2025-01-15',
          shares: '30',
          pricePerShare: '10',
          rowKey: '2025-01-15_buy_0',
        }),
        buyRow({
          date: '2025-02-15',
          shares: '50',
          pricePerShare: '15',
          rowKey: '2025-02-15_buy_0',
        }),
        sellRow({
          date: '2025-03-01',
          shares: '60',
          pricePerShare: '12',
          rowKey: '2025-03-01_sell_0',
        }),
      ]

      buildLotLedger(rows, idGen, audit)

      const salesProcessed = audit.getEntries().filter((e) => e.type === 'SALE_PROCESSED')
      expect(salesProcessed).toHaveLength(2)
      expect(salesProcessed[0]!.lotFragmentId).toBe('frag_001')
      expect(salesProcessed[1]!.lotFragmentId).toBe('frag_002')
    })
  })

  describe('decimal precision', () => {
    it('handles fractional shares correctly', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100.5', pricePerShare: '42.123' }),
        sellRow({
          date: '2025-02-01',
          shares: '50.25',
          pricePerShare: '45.00',
          acquiredDate: '2025-01-15',
        }),
      ]

      const { salePortions, fragments } = buildLotLedger(rows, idGen, audit)

      expect(salePortions[0]!.shares.eq(d('50.25'))).toBe(true)
      expect(fragments[0]!.sharesOpen.eq(d('50.25'))).toBe(true) // 100.5 - 50.25

      // proceeds = 50.25 * 45 = 2261.25
      expect(salePortions[0]!.proceeds.eq(d('2261.25'))).toBe(true)
      // cost = 50.25 * 42.123 = 2116.67975
      const expectedGain = d('2261.25').minus(d('50.25').mul(d('42.123')))
      expect(salePortions[0]!.gainLoss.eq(expectedGain)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles BUY-only rows (no sells)', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        buyRow({
          date: '2025-02-15',
          shares: '50',
          pricePerShare: '15',
          rowKey: '2025-02-15_buy_0',
        }),
      ]

      const { fragments, salePortions } = buildLotLedger(rows, idGen, audit)

      expect(fragments).toHaveLength(2)
      expect(salePortions).toHaveLength(0)
      expect(fragments[0]!.sharesOpen.eq(d('100'))).toBe(true)
      expect(fragments[1]!.sharesOpen.eq(d('50'))).toBe(true)
    })

    it('handles selling exactly all shares', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      const { salePortions, fragments } = buildLotLedger(rows, idGen, audit)

      expect(salePortions).toHaveLength(1)
      expect(fragments[0]!.sharesOpen.eq(ZERO)).toBe(true)
    })

    it('handles sell-to-cover transaction type', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '10' }),
        sellRow({
          date: '2025-01-15',
          shares: '30',
          pricePerShare: '10',
          acquiredDate: '2025-01-15',
          transactionType: 'SELL_TO_COVER',
          rowKey: '2025-01-15_sell_0',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)
      expect(salePortions).toHaveLength(1)
      expect(salePortions[0]!.shares.eq(d('30'))).toBe(true)
    })

    it('handles zero-price BUY (e.g., RSU vest at zero cost basis)', () => {
      const { audit, idGen } = makeAudit()
      const rows: NormalizedRow[] = [
        buyRow({ date: '2025-01-15', shares: '100', pricePerShare: '0' }),
        sellRow({
          date: '2025-02-01',
          shares: '100',
          pricePerShare: '12',
          acquiredDate: '2025-01-15',
        }),
      ]

      const { salePortions } = buildLotLedger(rows, idGen, audit)
      expect(salePortions[0]!.basisPerShareAtSale.eq(ZERO)).toBe(true)
      expect(salePortions[0]!.gainLoss.eq(d('1200'))).toBe(true) // All proceeds are gain
    })
  })
})
