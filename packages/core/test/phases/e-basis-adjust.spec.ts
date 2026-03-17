import { applyAdjustments } from '@wash-sale/core/phases/e-basis-adjust'
import { AuditLog } from '@wash-sale/core/audit'
import { SequentialIdGenerator } from '@wash-sale/core/id-generator'
import { d } from '@wash-sale/core/decimal'
import type { ReplacementMatch, LotFragment, Source } from '@wash-sale/core/types'

function makeIdGen() {
  return new SequentialIdGenerator()
}

function makeAudit(idGen = makeIdGen()) {
  return new AuditLog(idGen)
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
  purchaseDateActual: string
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
  const basis = opts.basisPerShareAdjusted ?? opts.originalBasisPerShare ?? '10'
  return {
    fragmentId: opts.fragmentId ?? 'frag_001',
    originRowKey: opts.originRowKey ?? `${opts.purchaseDateActual}_buy_0`,
    ticker: opts.ticker ?? 'FIG',
    source: opts.source ?? 'Shareworks',
    sharesOpen: d(opts.sharesOpen ?? '100'),
    purchaseDateActual: opts.purchaseDateActual,
    acquisitionDateAdjusted: opts.purchaseDateActual,
    basisPerShareAdjusted: d(basis),
    originalBasisPerShare: d(opts.originalBasisPerShare ?? basis),
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

describe('Phase E - Basis & Date Adjustment', () => {
  describe('basisPerShareAdjusted increases by disallowedLossPerShare', () => {
    it('increases replacement fragment basis by disallowed loss per share after match', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_A',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
        basisPerShareAdjusted: '10',
        originalBasisPerShare: '10',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          matchId: 'm1',
          replacementFragmentId: 'frag_A',
          matchedShares: '100',
          disallowedLossPerShare: '4',
          holdingPeriodDaysCarried: 64,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragment.basisPerShareAdjusted.eq(d('14'))).toBe(true) // 10 + 4
    })
  })

  describe('acquisitionDateAdjusted = replacementPurchaseDate - daysHeld', () => {
    it('sets adjusted acquisition date based on holding period transfer', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const purchaseDate = '2025-03-20'
      const fragment = lotFragment({
        fragmentId: 'frag_B',
        purchaseDateActual: purchaseDate,
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      // Sale was Jan 15, replacement bought Mar 20 -> 64 days held
      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_B',
          matchedShares: '100',
          disallowedLossPerShare: '4',
          holdingPeriodDaysCarried: 64,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      // acquisitionDateAdjusted = purchaseDate - 64 days = 2025-01-15
      expect(fragment.acquisitionDateAdjusted).toBe('2025-01-15')
    })
  })

  describe('Fragment splitting when partial replacement match', () => {
    it('splits fragment into adjusted and unadjusted portions when only part matched', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_partial',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_partial',
          matchedShares: '40',
          disallowedLossPerShare: '4',
          holdingPeriodDaysCarried: 30,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragments).toHaveLength(2)
      const adjusted = fragments.find((f) => f.fragmentId === 'frag_partial')!
      const remainder = fragments.find((f) => f.fragmentId !== 'frag_partial')!

      expect(adjusted.sharesOpen.eq(d('40'))).toBe(true)
      expect(remainder.sharesOpen.eq(d('60'))).toBe(true)
      expect(remainder.basisPerShareAdjusted.eq(d('10'))).toBe(true)
      expect(remainder.washAdjustmentHistory).toHaveLength(0)
    })
  })

  describe('Wash adjustment history appended', () => {
    it('adds entry to washAdjustmentHistory for each adjustment', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_hist',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          matchId: 'm_hist',
          salePortionId: 'sp_sale',
          replacementFragmentId: 'frag_hist',
          matchedShares: '100',
          disallowedLossPerShare: '3',
          holdingPeriodDaysCarried: 45,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragment.washAdjustmentHistory).toHaveLength(1)
      expect(fragment.washAdjustmentHistory[0]!.matchId).toBe('m_hist')
      expect(fragment.washAdjustmentHistory[0]!.disallowedLossPerShare.eq(d('3'))).toBe(true)
      expect(fragment.washAdjustmentHistory[0]!.fromSaleRowKey).toBe('sp_sale')
    })
  })

  describe('AC-10: partial replacement split - 80 shares matched out of 100', () => {
    it('splits fragment correctly: 80 adjusted, 20 unadjusted remainder', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_ac10',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
        basisPerShareAdjusted: '12',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_ac10',
          matchedShares: '80',
          disallowedLossPerShare: '5',
          holdingPeriodDaysCarried: 50,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragments).toHaveLength(2)
      const adjusted = fragments.find((f) => f.fragmentId === 'frag_ac10')!
      const remainder = fragments.find((f) => f.fragmentId !== 'frag_ac10')!

      expect(adjusted.sharesOpen.eq(d('80'))).toBe(true)
      expect(adjusted.basisPerShareAdjusted.eq(d('17'))).toBe(true) // 12 + 5
      expect(remainder.sharesOpen.eq(d('20'))).toBe(true)
      expect(remainder.basisPerShareAdjusted.eq(d('12'))).toBe(true)
    })
  })

  describe('Multiple matches for same fragment (AC-8 HIFO sublots)', () => {
    it('splits into sublots when fragment gets different adjustments from multiple losses', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_multi',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
        basisPerShareAdjusted: '8',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          matchId: 'm1',
          salePortionId: 'sp_001',
          replacementFragmentId: 'frag_multi',
          matchedShares: '50',
          disallowedLossPerShare: '2',
          holdingPeriodDaysCarried: 30,
        }),
        replacementMatch({
          matchId: 'm2',
          salePortionId: 'sp_002',
          replacementFragmentId: 'frag_multi',
          matchedShares: '50',
          disallowedLossPerShare: '3',
          holdingPeriodDaysCarried: 45,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      // AC-8: different adjustments → two sublots for HIFO depletion
      expect(fragments).toHaveLength(2) // original (50) + carved-off (50)
      const adj10 = fragments.find((f) => f.basisPerShareAdjusted.eq(d('10')))
      const adj11 = fragments.find((f) => f.basisPerShareAdjusted.eq(d('11')))
      expect(adj10?.sharesOpen.eq(d('50'))).toBe(true) // 8 + 2
      expect(adj11?.sharesOpen.eq(d('50'))).toBe(true) // 8 + 3
    })
  })

  describe('Audit events', () => {
    it('emits BASIS_ADJUSTED event', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_audit',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          matchId: 'm_audit',
          replacementFragmentId: 'frag_audit',
          matchedShares: '100',
          disallowedLossPerShare: '4',
          holdingPeriodDaysCarried: 60,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      const basisEvents = audit.getEntries().filter((e) => e.type === 'BASIS_ADJUSTED')
      expect(basisEvents).toHaveLength(1)
      expect(basisEvents[0]!.lotFragmentId).toBe('frag_audit')
      expect(basisEvents[0]!.message).toContain('+4')
      expect(basisEvents[0]!.payload).toMatchObject({
        disallowedLossPerShare: '4',
        matchId: 'm_audit',
      })
    })

    it('emits LOT_SPLIT when fragment is partially matched', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_split',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_split',
          matchedShares: '30',
          disallowedLossPerShare: '2',
          holdingPeriodDaysCarried: 25,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      const splitEvents = audit.getEntries().filter((e) => e.type === 'LOT_SPLIT')
      expect(splitEvents).toHaveLength(1)
      expect(splitEvents[0]!.lotFragmentId).toBe('frag_split')
      expect(splitEvents[0]!.relatedFragmentId).toBeDefined()
      expect(splitEvents[0]!.message).toContain('30 shares adjusted')
      expect(splitEvents[0]!.message).toContain('70')
    })

    it('emits ACQ_DATE_ADJUSTED event', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_acq',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_acq',
          matchedShares: '100',
          disallowedLossPerShare: '1',
          holdingPeriodDaysCarried: 40,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      const acqEvents = audit.getEntries().filter((e) => e.type === 'ACQ_DATE_ADJUSTED')
      expect(acqEvents).toHaveLength(1)
      expect(acqEvents[0]!.lotFragmentId).toBe('frag_acq')
    })
  })

  describe('Edge cases', () => {
    it('skips match with zero disallowed loss', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_zero',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
        basisPerShareAdjusted: '10',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_zero',
          matchedShares: '100',
          disallowedLossPerShare: '0',
          holdingPeriodDaysCarried: 30,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragment.basisPerShareAdjusted.eq(d('10'))).toBe(true)
    })

    it('full match - no split needed', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_full',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_full',
          matchedShares: '100',
          disallowedLossPerShare: '3',
          holdingPeriodDaysCarried: 20,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragments).toHaveLength(1)
      expect(fragment.sharesOpen.eq(d('100'))).toBe(true)
      const splitEvents = audit.getEntries().filter((e) => e.type === 'LOT_SPLIT')
      expect(splitEvents).toHaveLength(0)
    })

    it('already-adjusted fragment gets additional adjustment', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_pre',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
        basisPerShareAdjusted: '15',
        originalBasisPerShare: '10',
        washAdjustmentHistory: [
          {
            matchId: 'old_match',
            disallowedLossPerShare: '5',
            fromSaleRowKey: 'sp_old',
            appliedAt: '2025-03-20',
          },
        ],
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          matchId: 'm_new',
          replacementFragmentId: 'frag_pre',
          matchedShares: '100',
          disallowedLossPerShare: '2',
          holdingPeriodDaysCarried: 10,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragment.basisPerShareAdjusted.eq(d('17'))).toBe(true) // 15 + 2
      expect(fragment.washAdjustmentHistory).toHaveLength(2)
      expect(fragment.washAdjustmentHistory[1]!.matchId).toBe('m_new')
    })

    it('ignores matches for non-existent fragment', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_real',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      const matches: ReplacementMatch[] = [
        replacementMatch({
          replacementFragmentId: 'frag_nonexistent',
          matchedShares: '100',
          disallowedLossPerShare: '4',
          holdingPeriodDaysCarried: 30,
        }),
      ]

      applyAdjustments(matches, fragments, idGen, audit)

      expect(fragment.basisPerShareAdjusted.eq(d('10'))).toBe(true)
      expect(fragments).toHaveLength(1)
    })

    it('handles empty matches', () => {
      const idGen = makeIdGen()
      const audit = makeAudit(idGen)
      const fragment = lotFragment({
        fragmentId: 'frag_empty',
        purchaseDateActual: '2025-03-20',
        sharesOpen: '100',
      })
      const fragments: LotFragment[] = [fragment]

      applyAdjustments([], fragments, idGen, audit)

      expect(fragment.basisPerShareAdjusted.eq(d('10'))).toBe(true)
      expect(fragment.washAdjustmentHistory).toHaveLength(0)
    })
  })
})
