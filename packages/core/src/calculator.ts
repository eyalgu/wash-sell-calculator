import { Decimal, ZERO } from './decimal'
import { AuditLog } from './audit'
import { InsufficientSharesError, LotIdentificationError } from './errors'
import { normalizeRows } from './phases/a-normalize'
import { identifyLossPortions } from './phases/c-loss-detection'
import { allocateReplacements } from './phases/d-replacement-match'
import { applyAdjustments } from './phases/e-basis-adjust'
import {
  buildForm8949,
  buildRemainingPositions,
  buildSummary,
  collectWarnings,
} from './phases/g-output'
import type {
  RowInput,
  NormalizedRow,
  LotFragment,
  SalePortion,
  ReplacementMatch,
  CalculationResult,
  IdGenerator,
  Ticker,
} from './types'

/**
 * Sort fragments for HIFO sublot depletion within a given acquiredDate group.
 */
function sortByHifo(fragments: LotFragment[]): LotFragment[] {
  return [...fragments].sort((a, b) => {
    const basisCmp = b.basisPerShareAdjusted.cmp(a.basisPerShareAdjusted)
    if (basisCmp !== 0) return basisCmp
    const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual)
    if (dateCmp !== 0) return dateCmp
    const adjCmp = a.acquisitionDateAdjusted.localeCompare(b.acquisitionDateAdjusted)
    if (adjCmp !== 0) return adjCmp
    return a.fragmentId.localeCompare(b.fragmentId)
  })
}

function findAndSortMatchingFragments(fragments: LotFragment[], row: NormalizedRow): LotFragment[] {
  const candidates = fragments.filter((f) => f.ticker === row.ticker && f.sharesOpen.gt(0))

  const byAcqDate = candidates.filter((f) => f.purchaseDateActual === row.acquiredDate)
  if (byAcqDate.length > 0) return sortByHifo(byAcqDate)

  // FIFO fallback
  return [...candidates].sort((a, b) => {
    const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual)
    if (dateCmp !== 0) return dateCmp
    return a.fragmentId.localeCompare(b.fragmentId)
  })
}

/**
 * Core calculation engine. Processes the timeline chronologically with
 * interleaved wash sale detection so that cascading adjustments work
 * naturally (each sale uses the current adjusted basis of its lot).
 *
 * Algorithm:
 * 1. Phase A: normalize and sort all rows
 * 2. Create all lot fragments from BUY rows (so forward-looking
 *    replacement matching can find future purchases)
 * 3. Process SELL rows chronologically:
 *    a. Resolve to lot fragments using current adjusted basis
 *    b. Identify loss portions (Phase C)
 *    c. Allocate replacements (Phase D)
 *    d. Apply basis/date adjustments (Phase E)
 * 4. Build outputs (Phase G)
 */
export function calculate(
  ticker: Ticker,
  rows: readonly RowInput[],
  idGen: IdGenerator,
): CalculationResult {
  const audit = new AuditLog(idGen)

  // Phase A
  const normalizedRows = normalizeRows(ticker, rows, audit)

  // Phase B1: Create all lot fragments from BUY rows
  const fragments: LotFragment[] = []
  const buyRows = normalizedRows.filter((r) => r.action === 'BUY')
  for (const row of buyRows) {
    const fragment: LotFragment = {
      fragmentId: idGen.next('frag'),
      originRowKey: row.rowKey,
      ticker: row.ticker,
      source: row.source,
      sharesOpen: row.shares,
      purchaseDateActual: row.date,
      acquisitionDateAdjusted: row.date,
      basisPerShareAdjusted: row.pricePerShare,
      originalBasisPerShare: row.pricePerShare,
      washAdjustmentHistory: [],
      consumedAsReplacement: ZERO,
    }
    fragments.push(fragment)

    audit.emit('LOT_CREATED', row.date, `Created lot ${fragment.fragmentId} from ${row.rowKey}`, {
      rowKey: row.rowKey,
      lotFragmentId: fragment.fragmentId,
      payload: {
        shares: row.shares.toString(),
        basisPerShare: row.pricePerShare.toString(),
        purchaseDate: row.date,
      },
    })
  }

  // Phase B2 + C + D + E: Process SELL rows chronologically with interleaved wash sale detection
  const allSalePortions: SalePortion[] = []
  const allMatches: ReplacementMatch[] = []

  // Group sells by date so we process same-day sells together before running wash sale detection
  const sellRows = normalizedRows.filter((r) => r.action === 'SELL')
  const sellsByDate = new Map<string, NormalizedRow[]>()
  for (const row of sellRows) {
    const existing = sellsByDate.get(row.date) ?? []
    existing.push(row)
    sellsByDate.set(row.date, existing)
  }
  const sortedDates = [...sellsByDate.keys()].sort()

  for (const date of sortedDates) {
    const dateSells = sellsByDate.get(date)!
    const dateSalePortions: SalePortion[] = []

    // Process each sell for this date
    for (const row of dateSells) {
      const matched = findAndSortMatchingFragments(fragments, row)

      if (matched.length === 0) {
        throw new LotIdentificationError(
          `Cannot identify source lots for sale ${row.rowKey}: no matching open lots found.`,
          row.rowKey,
        )
      }

      let sharesToSell = row.shares
      const totalAvailable = matched.reduce((sum, f) => sum.plus(f.sharesOpen), ZERO)

      if (totalAvailable.lt(sharesToSell)) {
        throw new InsufficientSharesError(
          `Insufficient shares for sale ${row.rowKey}: need ${sharesToSell.toString()}, have ${totalAvailable.toString()}.`,
          row.rowKey,
          sharesToSell.toString(),
          totalAvailable.toString(),
        )
      }

      for (const frag of matched) {
        if (sharesToSell.lte(0)) break

        const sharesToTake = Decimal.min(frag.sharesOpen, sharesToSell)
        const basisAtSale = frag.basisPerShareAdjusted
        const proceeds = sharesToTake.mul(row.pricePerShare)
        const cost = sharesToTake.mul(basisAtSale)
        const gainLoss = proceeds.minus(cost)

        const portion: SalePortion = {
          salePortionId: idGen.next('sp'),
          saleRowKey: row.rowKey,
          soldFromFragmentId: frag.fragmentId,
          shares: sharesToTake,
          saleDate: row.date,
          salePricePerShare: row.pricePerShare,
          proceeds,
          basisPerShareAtSale: basisAtSale,
          gainLoss,
          originalAcquiredDateForOrdering: frag.purchaseDateActual,
        }
        dateSalePortions.push(portion)

        if (sharesToTake.lt(frag.sharesOpen)) {
          audit.emit(
            'LOT_SPLIT',
            row.date,
            `Split ${frag.fragmentId}: sold ${sharesToTake.toString()} of ${frag.sharesOpen.toString()} shares`,
            {
              lotFragmentId: frag.fragmentId,
              saleRowKey: row.rowKey,
              payload: {
                soldShares: sharesToTake.toString(),
                remainingShares: frag.sharesOpen.minus(sharesToTake).toString(),
              },
            },
          )
        }

        frag.sharesOpen = frag.sharesOpen.minus(sharesToTake)
        sharesToSell = sharesToSell.minus(sharesToTake)

        audit.emit(
          'SALE_PROCESSED',
          row.date,
          `Processed sale of ${sharesToTake.toString()} shares from ${frag.fragmentId}`,
          {
            saleRowKey: row.rowKey,
            lotFragmentId: frag.fragmentId,
            payload: {
              shares: sharesToTake.toString(),
              proceeds: proceeds.toString(),
              basisAtSale: basisAtSale.toString(),
              gainLoss: gainLoss.toString(),
            },
          },
        )
      }
    }

    allSalePortions.push(...dateSalePortions)

    // Phase C: Identify losses from this date's sales
    const lossPortions = identifyLossPortions(dateSalePortions, audit)

    if (lossPortions.length > 0) {
      // Phase D: Allocate replacements
      const dateMatches = allocateReplacements(
        lossPortions,
        fragments,
        ticker,
        normalizedRows,
        idGen,
        audit,
      )

      if (dateMatches.length > 0) {
        allMatches.push(...dateMatches)

        // Phase E: Apply adjustments
        applyAdjustments(dateMatches, fragments, idGen, audit)
      }
    }
  }

  // Phase G: Build outputs
  const form8949Data = buildForm8949(ticker, allSalePortions, allMatches, fragments, audit)
  const remainingPositions = buildRemainingPositions(fragments)
  const summary = buildSummary(allSalePortions, allMatches, remainingPositions)
  const warnings = collectWarnings(allSalePortions, allMatches, fragments, normalizedRows)

  return {
    ticker,
    normalizedRows,
    form8949Data,
    remainingPositions,
    summary,
    auditLog: audit.getEntries(),
    warnings,
  }
}
