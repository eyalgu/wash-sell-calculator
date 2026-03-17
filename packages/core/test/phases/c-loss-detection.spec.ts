import { identifyLossPortions } from '@wash-sale/core/phases/c-loss-detection'
import { AuditLog } from '@wash-sale/core/audit'
import { SequentialIdGenerator } from '@wash-sale/core/id-generator'
import { d } from '@wash-sale/core/decimal'
import type { SalePortion } from '@wash-sale/core/types'

function makeAudit() {
  return new AuditLog(new SequentialIdGenerator())
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
  const salePrice = d(opts.salePricePerShare ?? '10')
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

describe('Phase C - Loss Detection', () => {
  describe('sale at a gain produces no loss portion', () => {
    it('returns empty array when all portions have positive gain', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [salePortion({ gainLoss: '200', salePortionId: 'sp_001' })]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(0)
      expect(result).toEqual([])
    })

    it('excludes gain portions when mixed with loss portions', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({ gainLoss: '200', salePortionId: 'sp_001' }),
        salePortion({ gainLoss: '-100', salePortionId: 'sp_002' }),
      ]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(1)
      expect(result[0]!.salePortionId).toBe('sp_002')
      expect(result[0]!.gainLoss.eq(d('-100'))).toBe(true)
    })
  })

  describe('sale at a loss produces SalePortion with negative gainLoss', () => {
    it('returns the loss portion', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({
          gainLoss: '-200',
          salePortionId: 'sp_001',
          saleRowKey: '2025-03-01_sell_0',
          soldFromFragmentId: 'frag_001',
        }),
      ]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(1)
      expect(result[0]!.gainLoss.eq(d('-200'))).toBe(true)
      expect(result[0]!.salePortionId).toBe('sp_001')
      expect(result[0]!.saleRowKey).toBe('2025-03-01_sell_0')
      expect(result[0]!.soldFromFragmentId).toBe('frag_001')
    })

    it('emits LOSS_DETECTED audit event for the loss portion', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({ gainLoss: '-150', saleRowKey: '2025-04-15_sell_0' }),
      ]

      identifyLossPortions(portions, audit)

      const lossEvents = audit.getEntries().filter((e) => e.type === 'LOSS_DETECTED')
      expect(lossEvents).toHaveLength(1)
      expect(lossEvents[0]!.saleRowKey).toBe('2025-04-15_sell_0')
      expect(lossEvents[0]!.message).toContain('Loss of -150')
      expect(lossEvents[0]!.payload).toMatchObject({
        gainLoss: '-150',
      })
    })
  })

  describe('multi-lot same-day sale creates separate loss portions (no averaging)', () => {
    it('returns each loss portion separately', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({
          gainLoss: '-50',
          salePortionId: 'sp_001',
          soldFromFragmentId: 'frag_001',
          originalAcquiredDateForOrdering: '2025-01-10',
        }),
        salePortion({
          gainLoss: '-75',
          salePortionId: 'sp_002',
          soldFromFragmentId: 'frag_002',
          originalAcquiredDateForOrdering: '2025-01-20',
        }),
      ]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(2)
      expect(result[0]!.salePortionId).toBe('sp_001')
      expect(result[0]!.gainLoss.eq(d('-50'))).toBe(true)
      expect(result[1]!.salePortionId).toBe('sp_002')
      expect(result[1]!.gainLoss.eq(d('-75'))).toBe(true)
    })

    it('emits LOSS_DETECTED for each loss portion', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({ gainLoss: '-50', salePortionId: 'sp_001' }),
        salePortion({ gainLoss: '-75', salePortionId: 'sp_002' }),
      ]

      identifyLossPortions(portions, audit)

      const lossEvents = audit.getEntries().filter((e) => e.type === 'LOSS_DETECTED')
      expect(lossEvents).toHaveLength(2)
    })
  })

  describe('loss portions ordered by sale date, then by original acquisition date for same-day ties', () => {
    it('sorts by sale date ascending', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({
          gainLoss: '-100',
          salePortionId: 'sp_003',
          saleDate: '2025-04-15',
          originalAcquiredDateForOrdering: '2025-01-01',
        }),
        salePortion({
          gainLoss: '-50',
          salePortionId: 'sp_001',
          saleDate: '2025-03-01',
          originalAcquiredDateForOrdering: '2025-01-01',
        }),
        salePortion({
          gainLoss: '-75',
          salePortionId: 'sp_002',
          saleDate: '2025-03-15',
          originalAcquiredDateForOrdering: '2025-01-01',
        }),
      ]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(3)
      expect(result[0]!.saleDate).toBe('2025-03-01')
      expect(result[0]!.salePortionId).toBe('sp_001')
      expect(result[1]!.saleDate).toBe('2025-03-15')
      expect(result[1]!.salePortionId).toBe('sp_002')
      expect(result[2]!.saleDate).toBe('2025-04-15')
      expect(result[2]!.salePortionId).toBe('sp_003')
    })

    it('uses originalAcquiredDateForOrdering as tie-breaker for same-day sale portions', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({
          gainLoss: '-100',
          salePortionId: 'sp_late',
          saleDate: '2025-03-15',
          originalAcquiredDateForOrdering: '2025-02-01',
        }),
        salePortion({
          gainLoss: '-50',
          salePortionId: 'sp_early',
          saleDate: '2025-03-15',
          originalAcquiredDateForOrdering: '2025-01-15',
        }),
      ]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(2)
      // Same sale date: order by originalAcquiredDateForOrdering ascending
      expect(result[0]!.originalAcquiredDateForOrdering).toBe('2025-01-15')
      expect(result[0]!.salePortionId).toBe('sp_early')
      expect(result[1]!.originalAcquiredDateForOrdering).toBe('2025-02-01')
      expect(result[1]!.salePortionId).toBe('sp_late')
    })
  })

  describe('edge cases', () => {
    it('excludes zero gain/loss portions', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [salePortion({ gainLoss: '0', salePortionId: 'sp_zero' })]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(0)
      expect(result).toEqual([])
    })

    it('handles empty input', () => {
      const audit = makeAudit()
      const result = identifyLossPortions([], audit)

      expect(result).toHaveLength(0)
      expect(result).toEqual([])

      const lossEvents = audit.getEntries().filter((e) => e.type === 'LOSS_DETECTED')
      expect(lossEvents).toHaveLength(0)
    })

    it('handles multiple sales on different dates with correct ordering', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({
          gainLoss: '-300',
          salePortionId: 'sp_dec',
          saleDate: '2025-12-01',
          originalAcquiredDateForOrdering: '2025-06-01',
        }),
        salePortion({
          gainLoss: '-100',
          salePortionId: 'sp_jan',
          saleDate: '2025-01-15',
          originalAcquiredDateForOrdering: '2024-12-01',
        }),
        salePortion({
          gainLoss: '-200',
          salePortionId: 'sp_jun',
          saleDate: '2025-06-15',
          originalAcquiredDateForOrdering: '2025-01-01',
        }),
      ]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(3)
      expect(result[0]!.saleDate).toBe('2025-01-15')
      expect(result[1]!.saleDate).toBe('2025-06-15')
      expect(result[2]!.saleDate).toBe('2025-12-01')
    })

    it('handles fractional loss amounts', () => {
      const audit = makeAudit()
      const portions: SalePortion[] = [
        salePortion({
          gainLoss: '-42.75',
          salePortionId: 'sp_001',
          shares: '50.5',
          salePricePerShare: '9.50',
          basisPerShareAtSale: '10.35',
        }),
      ]

      const result = identifyLossPortions(portions, audit)

      expect(result).toHaveLength(1)
      expect(result[0]!.gainLoss.eq(d('-42.75'))).toBe(true)
    })
  })
})
