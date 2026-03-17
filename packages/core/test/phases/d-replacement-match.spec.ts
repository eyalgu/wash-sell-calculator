import { allocateReplacements, addDays } from '@wash-sale/core/phases/d-replacement-match'
import { AuditLog } from '@wash-sale/core/audit'
import { SequentialIdGenerator } from '@wash-sale/core/id-generator'
import { d, ZERO } from '@wash-sale/core/decimal'
import type { SalePortion, LotFragment, NormalizedRow, Source } from '@wash-sale/core/types'

function makeIdGen() {
  return new SequentialIdGenerator()
}

function makeAudit(idGen = makeIdGen()) {
  return new AuditLog(idGen)
}

function salePortion(opts: {
  salePortionId?: string
  saleRowKey?: string
  soldFromFragmentId?: string
  shares?: string
  saleDate?: string
  salePricePerShare?: string
  basisPerShareAtSale?: string
  gainLoss: string
  originalAcquiredDateForOrdering?: string
}): SalePortion {
  const shares = d(opts.shares ?? '100')
  const salePrice = d(opts.salePricePerShare ?? '8')
  const basis = d(opts.basisPerShareAtSale ?? '12')
  const gainLoss = d(opts.gainLoss)
  const proceeds = shares.mul(salePrice)

  return {
    salePortionId: opts.salePortionId ?? 'sp_001',
    saleRowKey: opts.saleRowKey ?? '2025-03-01_sell_0',
    soldFromFragmentId: opts.soldFromFragmentId ?? 'frag_001',
    shares,
    saleDate: opts.saleDate ?? '2025-03-01',
    salePricePerShare: salePrice,
    proceeds,
    basisPerShareAtSale: basis,
    gainLoss,
    originalAcquiredDateForOrdering: opts.originalAcquiredDateForOrdering ?? '2025-01-15',
  }
}

function lotFragment(opts: {
  fragmentId?: string
  originRowKey?: string
  ticker?: string
  source?: Source
  sharesOpen?: string
  purchaseDateActual: string
  consumedAsReplacement?: string
}): LotFragment {
  return {
    fragmentId: opts.fragmentId ?? 'frag_001',
    originRowKey: opts.originRowKey ?? `${opts.purchaseDateActual}_buy_0`,
    ticker: opts.ticker ?? 'FIG',
    source: opts.source ?? 'Shareworks',
    sharesOpen: d(opts.sharesOpen ?? '100'),
    purchaseDateActual: opts.purchaseDateActual,
    acquisitionDateAdjusted: opts.purchaseDateActual,
    basisPerShareAdjusted: d('10'),
    originalBasisPerShare: d('10'),
    washAdjustmentHistory: [],
    consumedAsReplacement: d(opts.consumedAsReplacement ?? '0'),
  }
}

function normalizedRow(opts: {
  rowKey: string
  date: string
  source?: Source
  action: 'BUY' | 'SELL'
  transactionType?: NormalizedRow['transactionType']
  acquiredDate?: string
}): NormalizedRow {
  return {
    rowKey: opts.rowKey,
    ticker: 'FIG',
    date: opts.date,
    action: opts.action,
    source: opts.source ?? 'Shareworks',
    shares: d('100'),
    pricePerShare: d('10'),
    transactionType:
      opts.transactionType ?? (opts.action === 'BUY' ? 'RSU_VEST' : 'OPEN_MARKET_SALE'),
    acquiredDate: opts.acquiredDate ?? opts.date,
    sortKey: `${opts.date}_0_0`,
  }
}

describe('Phase D - Replacement Match', () => {
  describe('AC-1: simple wash sale - 100% match, full disallowed loss', () => {
    it('matches full loss when replacement shares equal loss shares', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate: '2025-03-15',
          shares: '100',
          salePricePerShare: '8',
          basisPerShareAtSale: '12',
          gainLoss: '-400',
          originalAcquiredDateForOrdering: '2025-01-10',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_A',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '100',
        }),
      ]
      const rows: NormalizedRow[] = []

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', rows, idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.salePortionId).toBe('sp_001')
      expect(matches[0]!.replacementFragmentId).toBe('frag_A')
      expect(matches[0]!.matchedShares.eq(d('100'))).toBe(true)
      expect(matches[0]!.disallowedLossPerShare.eq(d('4'))).toBe(true) // 12 - 8
      expect(matches[0]!.disallowedLossTotal.eq(d('400'))).toBe(true)
      expect(matches[0]!.holdingPeriodDaysCarried).toBe(64) // Jan 10 to Mar 15
    })

    it('emits REPLACEMENT_MATCHED audit events', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          gainLoss: '-100',
          saleDate: '2025-03-15',
          shares: '50',
          salePricePerShare: '8',
          basisPerShareAtSale: '10',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_rep',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '50',
        }),
      ]

      allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      const matchEvents = audit.getEntries().filter((e) => e.type === 'REPLACEMENT_MATCHED')
      expect(matchEvents).toHaveLength(1)
      expect(matchEvents[0]!.lotFragmentId).toBe('frag_rep')
    })
  })

  describe('AC-2: partial wash sale - fewer replacement than loss shares', () => {
    it('only partially disallows when replacement shares < loss shares', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate: '2025-03-15',
          shares: '100',
          salePricePerShare: '8',
          basisPerShareAtSale: '12',
          gainLoss: '-400',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_A',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '40',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.matchedShares.eq(d('40'))).toBe(true)
      expect(matches[0]!.disallowedLossTotal.eq(d('160'))).toBe(true) // 40 * 4
    })
  })

  describe('AC-3: MS PDF example - 79 sold, 82 bought, lot split scenario', () => {
    it('matches 79 of 82 replacement shares with correct lot allocation', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_079',
          saleDate: '2025-03-15',
          shares: '79',
          salePricePerShare: '95',
          basisPerShareAtSale: '110',
          gainLoss: '-1185',
          originalAcquiredDateForOrdering: '2024-06-01',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_82',
          originRowKey: '2025-03-20_vest_0',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '82',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.matchedShares.eq(d('79'))).toBe(true)
      expect(matches[0]!.disallowedLossPerShare.eq(d('15'))).toBe(true) // 110 - 95
      expect(matches[0]!.disallowedLossTotal.eq(d('1185'))).toBe(true)
      expect(fragments[0]!.consumedAsReplacement.eq(d('79'))).toBe(true)
      expect(fragments[0]!.sharesOpen.eq(d('82'))).toBe(true)
    })
  })

  describe('AC-9: single-matching guard - replacement shares used once only', () => {
    it('consumed replacement cannot match a second loss', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate: '2025-03-15',
          shares: '50',
          gainLoss: '-100',
        }),
        salePortion({
          salePortionId: 'sp_002',
          saleDate: '2025-03-20',
          shares: '50',
          gainLoss: '-100',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_only',
          purchaseDateActual: '2025-03-18',
          sharesOpen: '50',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.salePortionId).toBe('sp_001')
      expect(matches[0]!.matchedShares.eq(d('50'))).toBe(true)
      expect(fragments[0]!.consumedAsReplacement.eq(d('50'))).toBe(true)
    })
  })

  describe('AC-11: sell-to-cover self-trigger exclusion (special case of same-origin exclusion)', () => {
    it('excludes same-day vest as replacement for its own sell-to-cover', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_stc',
          soldFromFragmentId: 'frag_sold',
          saleRowKey: '2025-01-15_sell_0',
          saleDate: '2025-01-15',
          shares: '30',
          gainLoss: '-60',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_sold',
          originRowKey: '2025-01-15_buy_0',
          purchaseDateActual: '2025-01-15',
          sharesOpen: '0',
        }),
        lotFragment({
          fragmentId: 'frag_vest_same_day',
          originRowKey: '2025-01-15_buy_0',
          purchaseDateActual: '2025-01-15',
          sharesOpen: '70',
        }),
      ]
      const rows: NormalizedRow[] = [
        normalizedRow({
          rowKey: '2025-01-15_sell_0',
          date: '2025-01-15',
          source: 'Shareworks',
          action: 'SELL',
          transactionType: 'SELL_TO_COVER',
        }),
        normalizedRow({
          rowKey: '2025-01-15_buy_0',
          date: '2025-01-15',
          source: 'Shareworks',
          action: 'BUY',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', rows, idGen, audit)

      expect(matches).toHaveLength(0)
      expect(fragments[0]!.consumedAsReplacement.eq(ZERO)).toBe(true)
    })

    it('does NOT exclude different-day vest for sell-to-cover', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_stc',
          soldFromFragmentId: 'frag_sold',
          saleRowKey: '2025-01-15_sell_0',
          saleDate: '2025-01-15',
          shares: '30',
          gainLoss: '-60',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_sold',
          originRowKey: '2025-01-15_buy_0',
          purchaseDateActual: '2025-01-15',
          sharesOpen: '0',
        }),
        lotFragment({
          fragmentId: 'frag_vest_next_day',
          originRowKey: '2025-01-16_buy_0',
          purchaseDateActual: '2025-01-16',
          sharesOpen: '70',
        }),
      ]
      const rows: NormalizedRow[] = [
        normalizedRow({
          rowKey: '2025-01-15_sell_0',
          date: '2025-01-15',
          action: 'SELL',
          transactionType: 'SELL_TO_COVER',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', rows, idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.replacementFragmentId).toBe('frag_vest_next_day')
    })
  })

  describe('AC-12: same-origin exclusion for partial lot sales', () => {
    it('same-origin fragment is excluded from replacement matching', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          soldFromFragmentId: 'frag_001',
          saleDate: '2025-02-01',
          shares: '50',
          salePricePerShare: '8',
          basisPerShareAtSale: '10',
          gainLoss: '-100',
          originalAcquiredDateForOrdering: '2025-01-15',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_001',
          originRowKey: '2025-01-15_buy_0',
          purchaseDateActual: '2025-01-15',
          sharesOpen: '50',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(0)
      expect(fragments[0]!.consumedAsReplacement.eq(ZERO)).toBe(true)
    })

    it('different-origin fragment is allowed as replacement', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          soldFromFragmentId: 'frag_001',
          saleDate: '2025-02-01',
          shares: '50',
          salePricePerShare: '8',
          basisPerShareAtSale: '10',
          gainLoss: '-100',
          originalAcquiredDateForOrdering: '2025-01-15',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_001',
          originRowKey: '2025-01-15_buy_0',
          purchaseDateActual: '2025-01-15',
          sharesOpen: '50',
        }),
        lotFragment({
          fragmentId: 'frag_002',
          originRowKey: '2025-01-16_buy_0',
          purchaseDateActual: '2025-01-16',
          sharesOpen: '20',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.replacementFragmentId).toBe('frag_002')
      expect(matches[0]!.matchedShares.eq(d('20'))).toBe(true)
      expect(fragments[0]!.consumedAsReplacement.eq(ZERO)).toBe(true)
      expect(fragments[1]!.consumedAsReplacement.eq(d('20'))).toBe(true)
    })

    it('full AC-12 scenario — BUY 100 Jan 15, BUY 20 Jan 16, SELL 50 Feb 1', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          soldFromFragmentId: 'frag_jan15',
          saleDate: '2025-02-01',
          shares: '50',
          salePricePerShare: '8',
          basisPerShareAtSale: '10',
          gainLoss: '-100',
          originalAcquiredDateForOrdering: '2025-01-15',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_jan15',
          originRowKey: '2025-01-15_buy_0',
          purchaseDateActual: '2025-01-15',
          sharesOpen: '50',
        }),
        lotFragment({
          fragmentId: 'frag_jan16',
          originRowKey: '2025-01-16_buy_0',
          purchaseDateActual: '2025-01-16',
          sharesOpen: '20',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.replacementFragmentId).toBe('frag_jan16')
      expect(matches[0]!.matchedShares.eq(d('20'))).toBe(true)
      expect(matches[0]!.disallowedLossPerShare.eq(d('2'))).toBe(true) // 10 - 8
      expect(matches[0]!.disallowedLossTotal.eq(d('40'))).toBe(true) // 20 * 2
      expect(fragments[0]!.consumedAsReplacement.eq(ZERO)).toBe(true)
      expect(fragments[1]!.consumedAsReplacement.eq(d('20'))).toBe(true)
    })
  })

  describe('AC-4: sell-to-cover 30-day trigger', () => {
    it('next vest within 30 days triggers wash sale', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_stc',
          saleRowKey: '2025-01-15_sell_0',
          saleDate: '2025-01-15',
          shares: '30',
          gainLoss: '-60',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_vest_30',
          originRowKey: '2025-02-14_buy_0',
          purchaseDateActual: '2025-02-14',
          sharesOpen: '100',
        }),
      ]
      const rows: NormalizedRow[] = [
        normalizedRow({
          rowKey: '2025-01-15_sell_0',
          date: '2025-01-15',
          action: 'SELL',
          transactionType: 'SELL_TO_COVER',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', rows, idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.replacementFragmentId).toBe('frag_vest_30')
    })
  })

  describe('AC-5: sell-to-cover 31-day non-trigger', () => {
    it('next vest outside 30-day window does NOT trigger wash sale', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_stc',
          saleDate: '2025-01-15',
          shares: '30',
          gainLoss: '-60',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_vest_31',
          purchaseDateActual: '2025-02-16',
          sharesOpen: '100',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(0)
    })
  })

  describe('FIFO replacement ordering', () => {
    it('uses earliest acquisition date first when multiple replacements available', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate: '2025-03-15',
          shares: '80',
          gainLoss: '-160',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_late',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '50',
        }),
        lotFragment({
          fragmentId: 'frag_early',
          purchaseDateActual: '2025-03-01',
          sharesOpen: '50',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(2)
      expect(matches[0]!.replacementFragmentId).toBe('frag_early')
      expect(matches[0]!.matchedShares.eq(d('50'))).toBe(true)
      expect(matches[1]!.replacementFragmentId).toBe('frag_late')
      expect(matches[1]!.matchedShares.eq(d('30'))).toBe(true)
    })
  })

  describe('Wash window calculation - [saleDate-30, saleDate+30] inclusive', () => {
    it('includes replacement on saleDate-30 (boundary inclusive)', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const saleDate = '2025-03-15'
      const windowStart = addDays(saleDate, -30)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate,
          shares: '10',
          gainLoss: '-20',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_boundary',
          purchaseDateActual: windowStart,
          sharesOpen: '10',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.replacementFragmentId).toBe('frag_boundary')
    })

    it('includes replacement on saleDate+30 (boundary inclusive)', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const saleDate = '2025-03-15'
      const windowEnd = addDays(saleDate, 30)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate,
          shares: '10',
          gainLoss: '-20',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_end',
          purchaseDateActual: windowEnd,
          sharesOpen: '10',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.replacementFragmentId).toBe('frag_end')
    })

    it('excludes replacement before saleDate-30', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const saleDate = '2025-03-15'
      const beforeWindow = addDays(saleDate, -31)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate,
          shares: '10',
          gainLoss: '-20',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_before',
          purchaseDateActual: beforeWindow,
          sharesOpen: '10',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(0)
    })

    it('excludes replacement after saleDate+30', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const saleDate = '2025-03-15'
      const afterWindow = addDays(saleDate, 31)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate,
          shares: '10',
          gainLoss: '-20',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_after',
          purchaseDateActual: afterWindow,
          sharesOpen: '10',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(0)
    })
  })

  describe('No replacements available', () => {
    it('returns empty matches when no eligible replacements in window', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate: '2025-03-15',
          shares: '100',
          gainLoss: '-400',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_far',
          purchaseDateActual: '2025-01-01',
          sharesOpen: '100',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(0)
    })

    it('returns empty when fragments have wrong ticker', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({ gainLoss: '-100', saleDate: '2025-03-15' }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_AAPL',
          ticker: 'AAPL',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '100',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(0)
    })
  })

  describe('Multiple losses, shared replacement pool', () => {
    it('allocates to earlier-ordered losses first', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_first',
          saleDate: '2025-03-01',
          shares: '30',
          gainLoss: '-60',
        }),
        salePortion({
          salePortionId: 'sp_second',
          saleDate: '2025-03-15',
          shares: '50',
          gainLoss: '-100',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_shared',
          purchaseDateActual: '2025-03-10',
          sharesOpen: '60',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(2)
      expect(matches[0]!.salePortionId).toBe('sp_first')
      expect(matches[0]!.matchedShares.eq(d('30'))).toBe(true)
      expect(matches[1]!.salePortionId).toBe('sp_second')
      expect(matches[1]!.matchedShares.eq(d('30'))).toBe(true)
      expect(fragments[0]!.consumedAsReplacement.eq(d('60'))).toBe(true)
    })
  })

  describe('addDays helper', () => {
    it('adds positive days correctly', () => {
      expect(addDays('2025-03-15', 30)).toBe('2025-04-14')
    })

    it('subtracts days correctly (negative argument)', () => {
      expect(addDays('2025-03-15', -30)).toBe('2025-02-13')
    })
  })

  describe('edge cases', () => {
    it('handles empty loss portions', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragments: LotFragment[] = [
        lotFragment({
          purchaseDateActual: '2025-03-20',
          sharesOpen: '100',
        }),
      ]

      const matches = allocateReplacements([], fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(0)
    })

    it('handles fragment with pre-consumed replacement shares', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate: '2025-03-15',
          shares: '100',
          gainLoss: '-200',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_partial',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '100',
          consumedAsReplacement: '70',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(1)
      expect(matches[0]!.matchedShares.eq(d('30'))).toBe(true)
      expect(fragments[0]!.consumedAsReplacement.eq(d('100'))).toBe(true)
    })

    it('AC-9: second loss cannot reuse replacement shares consumed by first loss', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_replace',
          purchaseDateActual: '2025-02-15',
          sharesOpen: '50',
          consumedAsReplacement: '0',
        }),
      ]

      const loss1 = [
        salePortion({
          salePortionId: 'sp_1',
          saleDate: '2025-02-01',
          shares: '50',
          basisPerShareAtSale: '20',
          salePricePerShare: '15',
          gainLoss: '-250',
          originalAcquiredDateForOrdering: '2025-01-10',
        }),
      ]
      const matches1 = allocateReplacements(loss1, fragments, 'FIG', [], idGen, audit)
      expect(matches1).toHaveLength(1)
      expect(matches1[0]!.matchedShares.eq(d('50'))).toBe(true)
      expect(fragments[0]!.consumedAsReplacement.eq(d('50'))).toBe(true)

      const loss2 = [
        salePortion({
          salePortionId: 'sp_2',
          saleDate: '2025-03-01',
          shares: '50',
          basisPerShareAtSale: '20',
          salePricePerShare: '14',
          gainLoss: '-300',
          originalAcquiredDateForOrdering: '2025-01-10',
        }),
      ]
      const matches2 = allocateReplacements(loss2, fragments, 'FIG', [], idGen, audit)
      expect(matches2).toHaveLength(0)
    })

    it('AC-9: full calculator flow - applyAdjustments then second allocateReplacements', () => {
      const { applyAdjustments } = require('@wash-sale/core/phases/e-basis-adjust')
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_replace',
          purchaseDateActual: '2025-02-15',
          sharesOpen: '50',
          consumedAsReplacement: '0',
        }),
      ]

      const loss1 = [
        salePortion({
          salePortionId: 'sp_1',
          saleDate: '2025-02-01',
          shares: '50',
          basisPerShareAtSale: '20',
          salePricePerShare: '15',
          gainLoss: '-250',
          originalAcquiredDateForOrdering: '2025-01-10',
        }),
      ]
      const matches1 = allocateReplacements(loss1, fragments, 'FIG', [], idGen, audit)
      expect(matches1).toHaveLength(1)

      applyAdjustments(matches1, fragments, idGen, audit)

      expect(fragments[0]!.consumedAsReplacement.eq(d('50'))).toBe(true)

      const loss2 = [
        salePortion({
          salePortionId: 'sp_2',
          saleDate: '2025-03-01',
          shares: '50',
          basisPerShareAtSale: '20',
          salePricePerShare: '14',
          gainLoss: '-300',
          originalAcquiredDateForOrdering: '2025-01-10',
        }),
      ]
      const matches2 = allocateReplacements(loss2, fragments, 'FIG', [], idGen, audit)
      expect(matches2).toHaveLength(0)
    })

    it('matches across multiple fragments for single loss', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const lossPortions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_001',
          saleDate: '2025-03-15',
          shares: '150',
          gainLoss: '-300',
        }),
      ]
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_1',
          purchaseDateActual: '2025-03-01',
          sharesOpen: '40',
        }),
        lotFragment({
          fragmentId: 'frag_2',
          purchaseDateActual: '2025-03-10',
          sharesOpen: '60',
        }),
        lotFragment({
          fragmentId: 'frag_3',
          purchaseDateActual: '2025-03-20',
          sharesOpen: '80',
        }),
      ]

      const matches = allocateReplacements(lossPortions, fragments, 'FIG', [], idGen, audit)

      expect(matches).toHaveLength(3)
      expect(matches[0]!.replacementFragmentId).toBe('frag_1')
      expect(matches[0]!.matchedShares.eq(d('40'))).toBe(true)
      expect(matches[1]!.replacementFragmentId).toBe('frag_2')
      expect(matches[1]!.matchedShares.eq(d('60'))).toBe(true)
      expect(matches[2]!.replacementFragmentId).toBe('frag_3')
      expect(matches[2]!.matchedShares.eq(d('50'))).toBe(true)
    })
  })
})
