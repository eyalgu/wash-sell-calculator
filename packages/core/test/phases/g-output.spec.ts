import {
  buildForm8949,
  buildRemainingPositions,
  buildSummary,
  collectWarnings,
} from '@wash-sale/core/phases/g-output'
import { d } from '@wash-sale/core/decimal'
import type {
  SalePortion,
  ReplacementMatch,
  LotFragment,
  RemainingPosition,
  NormalizedRow,
  Source,
} from '@wash-sale/core/types'

function salePortion(opts: {
  salePortionId?: string
  saleRowKey?: string
  soldFromFragmentId?: string
  shares?: string
  saleDate?: string
  salePricePerShare?: string
  basisPerShareAtSale?: string
  gainLoss?: string
  originalAcquiredDateForOrdering?: string
}): SalePortion {
  const shares = d(opts.shares ?? '100')
  const salePrice = d(opts.salePricePerShare ?? '10')
  const basis = d(opts.basisPerShareAtSale ?? '12')
  const gainLoss = d(opts.gainLoss ?? '0')
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

function replacementMatch(opts: {
  matchId?: string
  salePortionId?: string
  replacementFragmentId: string
  matchedShares: string
  disallowedLossPerShare: string
  holdingPeriodDaysCarried: number
}): ReplacementMatch {
  const matchedShares = d(opts.matchedShares)
  const disallowedLossPerShare = d(opts.disallowedLossPerShare)
  const disallowedLossTotal = matchedShares.mul(disallowedLossPerShare)

  return {
    matchId: opts.matchId ?? 'match_001',
    salePortionId: opts.salePortionId ?? 'sp_001',
    replacementFragmentId: opts.replacementFragmentId,
    matchedShares,
    disallowedLossPerShare,
    disallowedLossTotal,
    holdingPeriodDaysCarried: opts.holdingPeriodDaysCarried,
  }
}

function lotFragment(opts: {
  fragmentId?: string
  originRowKey?: string
  ticker?: string
  source?: Source
  sharesOpen?: string
  purchaseDateActual?: string
  acquisitionDateAdjusted?: string
  basisPerShareAdjusted?: string
  originalBasisPerShare?: string
  washAdjustmentHistory?: readonly {
    matchId: string
    disallowedLossPerShare: string
    fromSaleRowKey: string
    appliedAt: string
  }[]
  consumedAsReplacement?: string
}): LotFragment {
  const purchaseDate = opts.purchaseDateActual ?? '2025-01-15'
  const basisAdjusted = opts.basisPerShareAdjusted ?? opts.originalBasisPerShare ?? '10'
  const basisOriginal = opts.originalBasisPerShare ?? basisAdjusted
  return {
    fragmentId: opts.fragmentId ?? 'frag_001',
    originRowKey: opts.originRowKey ?? `${purchaseDate}_buy_0`,
    ticker: opts.ticker ?? 'FIG',
    source: opts.source ?? 'Shareworks',
    sharesOpen: d(opts.sharesOpen ?? '100'),
    purchaseDateActual: purchaseDate,
    acquisitionDateAdjusted: opts.acquisitionDateAdjusted ?? purchaseDate,
    basisPerShareAdjusted: d(basisAdjusted),
    originalBasisPerShare: d(basisOriginal),
    washAdjustmentHistory:
      opts.washAdjustmentHistory?.map((h) => ({
        matchId: h.matchId,
        disallowedLossPerShare: d(h.disallowedLossPerShare),
        fromSaleRowKey: h.fromSaleRowKey,
        appliedAt: h.appliedAt,
      })) ?? [],
    consumedAsReplacement: d(opts.consumedAsReplacement ?? '0'),
  }
}

function normalizedRow(opts: {
  rowKey?: string
  ticker?: string
  date?: string
  action: 'BUY' | 'SELL'
  shares: string
  pricePerShare?: string
  acquiredDate?: string
}): NormalizedRow {
  const date = opts.date ?? '2025-01-01'
  const acquiredDate = opts.acquiredDate ?? (opts.action === 'BUY' ? date : '2025-01-01')
  const transactionType = opts.action === 'BUY' ? 'RSU_VEST' : 'OPEN_MARKET_SALE'
  return {
    rowKey: opts.rowKey ?? `${date}_${opts.action.toLowerCase()}_0`,
    ticker: opts.ticker ?? 'FIG',
    date,
    action: opts.action,
    source: 'Shareworks',
    shares: d(opts.shares),
    pricePerShare: d(opts.pricePerShare ?? '10'),
    transactionType,
    acquiredDate,
    sortKey: `${date}_${opts.action}_0`,
  }
}

describe('Phase G - Output Generation', () => {
  describe('buildForm8949', () => {
    describe('short-term vs long-term split', () => {
      it('classifies as SHORT when held < 1 year', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_short',
            soldFromFragmentId: 'frag_001',
            originalAcquiredDateForOrdering: '2025-01-15',
            saleDate: '2025-06-15',
            gainLoss: '100',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_001',
            purchaseDateActual: '2025-01-15',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)

        expect(result.shortTermRows).toHaveLength(1)
        expect(result.longTermRows).toHaveLength(0)
        expect(result.shortTermRows[0]!.term).toBe('SHORT')
      })

      it('classifies as LONG when held >= 1 year (366+ days)', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_long',
            soldFromFragmentId: 'frag_001',
            originalAcquiredDateForOrdering: '2024-01-01',
            saleDate: '2025-01-15',
            gainLoss: '100',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_001',
            purchaseDateActual: '2024-01-01',
            acquisitionDateAdjusted: '2024-01-01',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)

        expect(result.shortTermRows).toHaveLength(0)
        expect(result.longTermRows).toHaveLength(1)
        expect(result.longTermRows[0]!.term).toBe('LONG')
      })

      it('uses adjusted acquisition date for term classification when available', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_adj',
            soldFromFragmentId: 'frag_001',
            originalAcquiredDateForOrdering: '2024-01-01',
            saleDate: '2025-06-01',
            gainLoss: '-50',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_001',
            purchaseDateActual: '2025-03-20',
            acquisitionDateAdjusted: '2025-01-15', // carried from replacement - short term
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)

        expect(result.shortTermRows).toHaveLength(1)
        expect(result.longTermRows).toHaveLength(0)
        expect(result.shortTermRows[0]!.term).toBe('SHORT')
        expect(result.shortTermRows[0]!.dateAcquired).toBe('2025-01-15')
      })
    })

    describe('rounding to cents (half-up)', () => {
      it('rounds proceeds, costBasis, gainOrLoss to 2 decimal places at output boundary', () => {
        const portions: SalePortion[] = [
          salePortion({
            shares: '33.333',
            salePricePerShare: '10.001',
            basisPerShareAtSale: '8.888',
            gainLoss: '37.04',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_001',
            purchaseDateActual: '2025-01-15',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)
        const row = result.shortTermRows[0]!

        // Values should be rounded to 2 decimal places
        expect(row.proceeds.toDecimalPlaces(2).eq(row.proceeds)).toBe(true)
        expect(row.costBasis.toDecimalPlaces(2).eq(row.costBasis)).toBe(true)
        expect(row.gainOrLoss.toDecimalPlaces(2).eq(row.gainOrLoss)).toBe(true)
      })
    })

    describe('field population', () => {
      it('populates description, dateAcquired, dateSold, proceeds, costBasis, gainOrLoss correctly', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_1',
            soldFromFragmentId: 'frag_1',
            shares: '50',
            saleDate: '2025-03-15',
            salePricePerShare: '12',
            basisPerShareAtSale: '10',
            gainLoss: '100',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_1',
            purchaseDateActual: '2025-01-10',
            acquisitionDateAdjusted: '2025-01-10',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)
        const row = result.shortTermRows[0]!

        expect(row.description).toBe('50 sh FIG')
        expect(row.dateAcquired).toBe('2025-01-10')
        expect(row.dateSold).toBe('2025-03-15')
        expect(row.proceeds.eq(d('600'))).toBe(true) // 50 * 12
        expect(row.costBasis.eq(d('500'))).toBe(true) // 50 * 10
        expect(row.gainOrLoss.eq(d('100'))).toBe(true)
      })
    })

    describe('wash sale code W', () => {
      it('has adjustmentCode W and adjustmentAmount when disallowed loss exists', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_wash',
            soldFromFragmentId: 'frag_1',
            shares: '100',
            basisPerShareAtSale: '12',
            gainLoss: '-200',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_1',
            purchaseDateActual: '2025-01-15',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
        ]
        const matches: ReplacementMatch[] = [
          replacementMatch({
            salePortionId: 'sp_wash',
            replacementFragmentId: 'frag_2',
            matchedShares: '100',
            disallowedLossPerShare: '2',
            holdingPeriodDaysCarried: 30,
          }),
        ]

        const result = buildForm8949('FIG', portions, matches, fragments)
        const row = result.shortTermRows[0]!

        expect(row.adjustmentCode).toBe('W')
        expect(row.adjustmentAmount?.eq(d('200'))).toBe(true) // 100 * 2
      })

      it('has no adjustmentCode when no wash sale', () => {
        const portions: SalePortion[] = [salePortion({ salePortionId: 'sp_gain', gainLoss: '150' })]
        const fragments: LotFragment[] = [lotFragment({ fragmentId: 'frag_001', sharesOpen: '0' })]

        const result = buildForm8949('FIG', portions, [], fragments)
        const row = result.shortTermRows[0]!

        expect(row.adjustmentCode).toBeUndefined()
        expect(row.adjustmentAmount).toBeUndefined()
      })
    })

    describe('row consolidation', () => {
      it('merges rows with same acquired date, sold date, and no wash adjustment', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_1',
            soldFromFragmentId: 'frag_a',
            shares: '40',
            saleDate: '2025-06-01',
            salePricePerShare: '10',
            basisPerShareAtSale: '12',
            gainLoss: '-80',
            originalAcquiredDateForOrdering: '2025-03-01',
          }),
          salePortion({
            salePortionId: 'sp_2',
            soldFromFragmentId: 'frag_b',
            shares: '60',
            saleDate: '2025-06-01',
            salePricePerShare: '10',
            basisPerShareAtSale: '12',
            gainLoss: '-120',
            originalAcquiredDateForOrdering: '2025-03-01',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_a',
            purchaseDateActual: '2025-03-01',
            acquisitionDateAdjusted: '2025-03-01',
            sharesOpen: '0',
          }),
          lotFragment({
            fragmentId: 'frag_b',
            purchaseDateActual: '2025-03-01',
            acquisitionDateAdjusted: '2025-03-01',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)

        expect(result.shortTermRows).toHaveLength(1)
        const row = result.shortTermRows[0]!
        expect(row.description).toBe('100 sh FIG')
        expect(row.dateAcquired).toBe('2025-03-01')
        expect(row.dateSold).toBe('2025-06-01')
        expect(row.adjustmentCode).toBeUndefined()
        expect(row.proceeds.eq(d('1000'))).toBe(true)
        expect(row.costBasis.eq(d('1200'))).toBe(true)
        expect(row.gainOrLoss.eq(d('-200'))).toBe(true)
      })

      it('merges rows with same dates and both having wash adjustment code W', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_w1',
            soldFromFragmentId: 'frag_w1',
            shares: '50',
            saleDate: '2025-04-01',
            salePricePerShare: '8',
            basisPerShareAtSale: '12',
            gainLoss: '-200',
            originalAcquiredDateForOrdering: '2025-01-15',
          }),
          salePortion({
            salePortionId: 'sp_w2',
            soldFromFragmentId: 'frag_w2',
            shares: '30',
            saleDate: '2025-04-01',
            salePricePerShare: '8',
            basisPerShareAtSale: '12',
            gainLoss: '-120',
            originalAcquiredDateForOrdering: '2025-01-15',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_w1',
            purchaseDateActual: '2025-01-15',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
          lotFragment({
            fragmentId: 'frag_w2',
            purchaseDateActual: '2025-01-15',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
        ]
        const matches: ReplacementMatch[] = [
          replacementMatch({
            matchId: 'mw1',
            salePortionId: 'sp_w1',
            replacementFragmentId: 'frag_r1',
            matchedShares: '50',
            disallowedLossPerShare: '2',
            holdingPeriodDaysCarried: 10,
          }),
          replacementMatch({
            matchId: 'mw2',
            salePortionId: 'sp_w2',
            replacementFragmentId: 'frag_r2',
            matchedShares: '30',
            disallowedLossPerShare: '2',
            holdingPeriodDaysCarried: 10,
          }),
        ]

        const result = buildForm8949('FIG', portions, matches, fragments)

        expect(result.shortTermRows).toHaveLength(1)
        const row = result.shortTermRows[0]!
        expect(row.description).toBe('80 sh FIG')
        expect(row.adjustmentCode).toBe('W')
        expect(row.adjustmentAmount?.eq(d('160'))).toBe(true) // 50*2 + 30*2
      })

      it('does not merge rows with different sold dates', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_d1',
            soldFromFragmentId: 'frag_1',
            shares: '100',
            saleDate: '2025-04-01',
            originalAcquiredDateForOrdering: '2025-01-15',
          }),
          salePortion({
            salePortionId: 'sp_d2',
            soldFromFragmentId: 'frag_2',
            shares: '100',
            saleDate: '2025-04-02',
            originalAcquiredDateForOrdering: '2025-01-15',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_1',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
          lotFragment({
            fragmentId: 'frag_2',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)

        expect(result.shortTermRows).toHaveLength(2)
      })

      it('does not merge rows where one has W and the other does not', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_mix1',
            soldFromFragmentId: 'frag_m1',
            shares: '100',
            saleDate: '2025-04-01',
            gainLoss: '-100',
            originalAcquiredDateForOrdering: '2025-01-15',
          }),
          salePortion({
            salePortionId: 'sp_mix2',
            soldFromFragmentId: 'frag_m2',
            shares: '100',
            saleDate: '2025-04-01',
            gainLoss: '50',
            originalAcquiredDateForOrdering: '2025-01-15',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_m1',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
          lotFragment({
            fragmentId: 'frag_m2',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
        ]
        const matches: ReplacementMatch[] = [
          replacementMatch({
            salePortionId: 'sp_mix1',
            replacementFragmentId: 'frag_r',
            matchedShares: '100',
            disallowedLossPerShare: '1',
            holdingPeriodDaysCarried: 10,
          }),
        ]

        const result = buildForm8949('FIG', portions, matches, fragments)

        expect(result.shortTermRows).toHaveLength(2)
      })

      it('passes through single rows unchanged', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_solo',
            soldFromFragmentId: 'frag_solo',
            shares: '100',
            saleDate: '2025-04-01',
            gainLoss: '50',
            originalAcquiredDateForOrdering: '2025-01-15',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_solo',
            acquisitionDateAdjusted: '2025-01-15',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)

        expect(result.shortTermRows).toHaveLength(1)
        expect(result.shortTermRows[0]!.description).toBe('100 sh FIG')
      })
    })

    describe('multiple sales', () => {
      it('produces multiple Form 8949 rows for multiple sale portions', () => {
        const portions: SalePortion[] = [
          salePortion({
            salePortionId: 'sp_1',
            soldFromFragmentId: 'frag_1',
            shares: '100',
            salePricePerShare: '10.50',
            basisPerShareAtSale: '10',
            originalAcquiredDateForOrdering: '2025-01-01',
            saleDate: '2025-03-01',
            gainLoss: '50',
          }),
          salePortion({
            salePortionId: 'sp_2',
            soldFromFragmentId: 'frag_2',
            shares: '100',
            salePricePerShare: '11',
            basisPerShareAtSale: '10',
            originalAcquiredDateForOrdering: '2024-05-30', // 367 days before 2025-06-01 -> LONG
            saleDate: '2025-06-01',
            gainLoss: '100',
          }),
        ]
        const fragments: LotFragment[] = [
          lotFragment({
            fragmentId: 'frag_1',
            purchaseDateActual: '2025-01-01',
            acquisitionDateAdjusted: '2025-01-01',
            sharesOpen: '0',
          }),
          lotFragment({
            fragmentId: 'frag_2',
            purchaseDateActual: '2024-05-30',
            acquisitionDateAdjusted: '2024-05-30',
            sharesOpen: '0',
          }),
        ]

        const result = buildForm8949('FIG', portions, [], fragments)

        expect(result.shortTermRows).toHaveLength(1)
        expect(result.longTermRows).toHaveLength(1)
        expect(result.shortTermRows[0]!.gainOrLoss.eq(d('50'))).toBe(true)
        expect(result.longTermRows[0]!.gainOrLoss.eq(d('100'))).toBe(true)
      })
    })
  })

  describe('buildRemainingPositions', () => {
    it('includes open fragments (remainingShares > 0)', () => {
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_open',
          sharesOpen: '50',
          purchaseDateActual: '2025-03-20',
          originalBasisPerShare: '10',
          basisPerShareAdjusted: '12',
        }),
      ]

      const result = buildRemainingPositions(fragments)

      expect(result).toHaveLength(1)
      expect(result[0]!.fragmentId).toBe('frag_open')
      expect(result[0]!.sharesOpen.eq(d('50'))).toBe(true)
      expect(result[0]!.originalBasisPerShare.eq(d('10'))).toBe(true)
      expect(result[0]!.basisPerShareAdjusted.eq(d('12'))).toBe(true)
    })

    it('excludes fully sold fragments (sharesOpen = 0)', () => {
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_sold',
          sharesOpen: '0',
          purchaseDateActual: '2025-01-15',
        }),
      ]

      const result = buildRemainingPositions(fragments)

      expect(result).toHaveLength(0)
    })

    it('carries wash adjustment history through', () => {
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_hist',
          sharesOpen: '80',
          purchaseDateActual: '2025-03-20',
          washAdjustmentHistory: [
            {
              matchId: 'm1',
              disallowedLossPerShare: '3',
              fromSaleRowKey: 'sp_1',
              appliedAt: '2025-03-20',
            },
          ],
        }),
      ]

      const result = buildRemainingPositions(fragments)

      expect(result[0]!.washAdjustmentHistory).toHaveLength(1)
      expect(result[0]!.washAdjustmentHistory[0]!.matchId).toBe('m1')
      expect(result[0]!.washAdjustmentHistory[0]!.disallowedLossPerShare.eq(d('3'))).toBe(true)
    })

    it('includes only fragments with sharesOpen > 0 when mixed', () => {
      const fragments: LotFragment[] = [
        lotFragment({ fragmentId: 'frag_a', sharesOpen: '30' }),
        lotFragment({ fragmentId: 'frag_b', sharesOpen: '0' }),
        lotFragment({ fragmentId: 'frag_c', sharesOpen: '20' }),
      ]

      const result = buildRemainingPositions(fragments)

      expect(result).toHaveLength(2)
      expect(result.map((r) => r.fragmentId).sort()).toEqual(['frag_a', 'frag_c'])
    })
  })

  describe('buildSummary', () => {
    it('splits realized gain/loss into short-term and long-term', () => {
      const portions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_st',
          originalAcquiredDateForOrdering: '2025-01-01',
          saleDate: '2025-06-01',
          gainLoss: '100',
        }),
        salePortion({
          salePortionId: 'sp_lt',
          originalAcquiredDateForOrdering: '2024-01-01',
          saleDate: '2025-06-01',
          gainLoss: '200',
        }),
      ]
      const remaining: RemainingPosition[] = []

      const result = buildSummary(portions, [], remaining)

      expect(result.realizedGainLossShortTerm.eq(d('100'))).toBe(true)
      expect(result.realizedGainLossLongTerm.eq(d('200'))).toBe(true)
    })

    it('includes total disallowed loss amount', () => {
      const portions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_1',
          gainLoss: '-300',
          originalAcquiredDateForOrdering: '2025-01-15',
          saleDate: '2025-03-15',
        }),
      ]
      const matches: ReplacementMatch[] = [
        replacementMatch({
          salePortionId: 'sp_1',
          replacementFragmentId: 'frag_x',
          matchedShares: '100',
          disallowedLossPerShare: '2',
          holdingPeriodDaysCarried: 30,
        }),
      ]
      const remaining: RemainingPosition[] = []

      const result = buildSummary(portions, matches, remaining)

      expect(result.totalDisallowedLosses.eq(d('200'))).toBe(true) // 100 * 2
    })

    it('includes total deferred in remaining holdings', () => {
      const portions: SalePortion[] = []
      const remaining: RemainingPosition[] = [
        {
          fragmentId: 'frag_1',
          ticker: 'FIG',
          source: 'Shareworks',
          sharesOpen: d('50'),
          purchaseDateActual: '2025-03-20',
          acquisitionDateAdjusted: '2025-03-20',
          originalBasisPerShare: d('10'),
          basisPerShareAdjusted: d('13'), // +3 wash adjustment
          washAdjustmentHistory: [],
        },
      ]

      const result = buildSummary(portions, [], remaining)

      expect(result.deferredLossesInRemainingHoldings.eq(d('150'))).toBe(true) // 50 * 3
    })

    it('aggregates correctly across multiple sales', () => {
      const portions: SalePortion[] = [
        salePortion({
          salePortionId: 'sp_1',
          originalAcquiredDateForOrdering: '2025-01-01',
          saleDate: '2025-06-01',
          gainLoss: '50',
        }),
        salePortion({
          salePortionId: 'sp_2',
          originalAcquiredDateForOrdering: '2025-02-01',
          saleDate: '2025-06-01',
          gainLoss: '-100',
        }),
      ]
      const matches: ReplacementMatch[] = [
        replacementMatch({
          salePortionId: 'sp_2',
          replacementFragmentId: 'frag_r',
          matchedShares: '50',
          disallowedLossPerShare: '1',
          holdingPeriodDaysCarried: 30,
        }),
      ]
      const remaining: RemainingPosition[] = []

      const result = buildSummary(portions, matches, remaining)

      // sp_1: allowedGainLoss = 50, ST -> realizedST += 50
      // sp_2: allowedGainLoss = -100 + 50 = -50, ST -> realizedST += -50
      // realizedST = 0
      expect(result.realizedGainLossShortTerm.eq(d('0'))).toBe(true)
      expect(result.totalDisallowedLosses.eq(d('50'))).toBe(true)
    })
  })

  describe('collectWarnings', () => {
    it('returns empty when no issues', () => {
      const portions: SalePortion[] = [salePortion({ salePortionId: 'sp_1', shares: '50' })]
      const fragments: LotFragment[] = [lotFragment({ fragmentId: 'frag_1', sharesOpen: '50' })]
      const rows: NormalizedRow[] = [
        normalizedRow({ action: 'BUY', shares: '100', date: '2025-01-01' }),
        normalizedRow({ action: 'SELL', shares: '50', date: '2025-03-01' }),
      ]

      const result = collectWarnings(portions, [], fragments, rows)

      expect(result).toHaveLength(0)
    })

    it('reports SHARE_COUNT_MISMATCH when total bought != sold + remaining', () => {
      const portions: SalePortion[] = [salePortion({ salePortionId: 'sp_1', shares: '60' })]
      const fragments: LotFragment[] = [lotFragment({ fragmentId: 'frag_1', sharesOpen: '50' })]
      const rows: NormalizedRow[] = [
        normalizedRow({ action: 'BUY', shares: '100', date: '2025-01-01' }),
        normalizedRow({ action: 'SELL', shares: '60', date: '2025-03-01' }),
      ]
      // Bought 100, sold 60, remaining 50 -> 60+50=110 != 100

      const result = collectWarnings(portions, [], fragments, rows)

      expect(result).toHaveLength(1)
      expect(result[0]!.code).toBe('SHARE_COUNT_MISMATCH')
      expect(result[0]!.message).toContain('100')
      expect(result[0]!.message).toContain('110')
    })

    it('does not report share count mismatch when balanced', () => {
      const portions: SalePortion[] = [salePortion({ salePortionId: 'sp_1', shares: '50' })]
      const fragments: LotFragment[] = [lotFragment({ fragmentId: 'frag_1', sharesOpen: '50' })]
      const rows: NormalizedRow[] = [
        normalizedRow({ action: 'BUY', shares: '100', date: '2025-01-01' }),
        normalizedRow({ action: 'SELL', shares: '50', date: '2025-03-01' }),
      ]

      const result = collectWarnings(portions, [], fragments, rows)

      const shareWarnings = result.filter((w) => w.code === 'SHARE_COUNT_MISMATCH')
      expect(shareWarnings).toHaveLength(0)
    })

    it('reports NEGATIVE_REMAINING_SHARES when fragment has negative sharesOpen', () => {
      const frag = lotFragment({
        fragmentId: 'frag_neg',
        sharesOpen: '-5',
        purchaseDateActual: '2025-01-15',
      })

      const result = collectWarnings([], [], [frag])

      expect(result).toHaveLength(1)
      expect(result[0]!.code).toBe('NEGATIVE_REMAINING_SHARES')
      expect(result[0]!.message).toContain('frag_neg')
      expect(result[0]!.message).toContain('-5')
      expect(result[0]!.fragmentId).toBe('frag_neg')
    })

    it('reports LARGE_WASH_SALE_ADJUSTMENT when adjustment > 50% of original basis', () => {
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_low',
          sharesOpen: '50',
          purchaseDateActual: '2025-03-20',
          originalBasisPerShare: '10',
        }),
      ]
      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_low',
          matchedShares: '50',
          disallowedLossPerShare: '6', // 60% of 10
          holdingPeriodDaysCarried: 30,
        }),
      ]

      const result = collectWarnings([], matches, fragments)

      expect(result).toHaveLength(1)
      expect(result[0]!.code).toBe('LARGE_WASH_SALE_ADJUSTMENT')
      expect(result[0]!.message).toContain('6')
      expect(result[0]!.message).toContain('10')
      expect(result[0]!.fragmentId).toBe('frag_low')
    })

    it('does not report large adjustment when exactly 50% or less', () => {
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_50',
          sharesOpen: '50',
          originalBasisPerShare: '10',
        }),
      ]
      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_50',
          matchedShares: '50',
          disallowedLossPerShare: '5', // exactly 50%
          holdingPeriodDaysCarried: 30,
        }),
      ]

      const result = collectWarnings([], matches, fragments)

      const largeAdj = result.filter((w) => w.code === 'LARGE_WASH_SALE_ADJUSTMENT')
      expect(largeAdj).toHaveLength(0)
    })

    it('skips share count check when normalizedRows not provided', () => {
      const portions: SalePortion[] = [salePortion({ shares: '999' })]
      const fragments: LotFragment[] = [lotFragment({ sharesOpen: '0' })]

      const result = collectWarnings(portions, [], fragments)

      const shareWarnings = result.filter((w) => w.code === 'SHARE_COUNT_MISMATCH')
      expect(shareWarnings).toHaveLength(0)
    })

    it('collects multiple warning types when several issues exist', () => {
      const fragments: LotFragment[] = [
        lotFragment({
          fragmentId: 'frag_multi',
          sharesOpen: '-1',
          originalBasisPerShare: '10',
        }),
      ]
      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_multi',
          matchedShares: '50',
          disallowedLossPerShare: '8', // 80% of 10
          holdingPeriodDaysCarried: 30,
        }),
      ]
      const rows: NormalizedRow[] = [
        normalizedRow({ action: 'BUY', shares: '100' }),
        normalizedRow({ action: 'SELL', shares: '150' }),
      ]

      const result = collectWarnings([salePortion({ shares: '150' })], matches, fragments, rows)

      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.some((w) => w.code === 'SHARE_COUNT_MISMATCH')).toBe(true)
      expect(result.some((w) => w.code === 'NEGATIVE_REMAINING_SHARES')).toBe(true)
      expect(result.some((w) => w.code === 'LARGE_WASH_SALE_ADJUSTMENT')).toBe(true)
    })
  })
})
