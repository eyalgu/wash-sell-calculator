import { Decimal, ZERO } from '../decimal'
import { InsufficientSharesError, LotIdentificationError } from '../errors'
import { AuditLog } from '../audit'
import type { NormalizedRow, LotFragment, SalePortion, IdGenerator } from '../types'

export interface LotLedgerResult {
  fragments: LotFragment[]
  salePortions: SalePortion[]
}

function findMatchingFragments(fragments: LotFragment[], row: NormalizedRow): LotFragment[] {
  const candidates = fragments.filter((f) => f.ticker === row.ticker && f.sharesOpen.gt(0))

  const byAcqDate = candidates.filter((f) => f.purchaseDateActual === row.acquiredDate)
  if (byAcqDate.length > 0) return sortByHifo(byAcqDate)

  // FIFO fallback: sort by purchaseDateActual ascending, then fragmentId
  return [...candidates].sort((a, b) => {
    const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual)
    if (dateCmp !== 0) return dateCmp
    return a.fragmentId.localeCompare(b.fragmentId)
  })
}

/**
 * Apply HIFO depletion within a set of fragments that share the same
 * purchaseDateActual. Used when selling from ambiguous sublots (FR-3.6).
 */
function sortByHifo(fragments: LotFragment[]): LotFragment[] {
  return [...fragments].sort((a, b) => {
    // Highest adjusted basis first
    const basisCmp = b.basisPerShareAdjusted.cmp(a.basisPerShareAdjusted)
    if (basisCmp !== 0) return basisCmp
    // Earliest original acquisition date
    const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual)
    if (dateCmp !== 0) return dateCmp
    // Earliest adjusted acquisition date
    const adjCmp = a.acquisitionDateAdjusted.localeCompare(b.acquisitionDateAdjusted)
    if (adjCmp !== 0) return adjCmp
    // Stable tie-break
    return a.fragmentId.localeCompare(b.fragmentId)
  })
}

export function buildLotLedger(
  normalizedRows: readonly NormalizedRow[],
  idGen: IdGenerator,
  audit: AuditLog,
): LotLedgerResult {
  const fragments: LotFragment[] = []
  const salePortions: SalePortion[] = []

  for (const row of normalizedRows) {
    if (row.action === 'BUY') {
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
    } else {
      // SELL: resolve to existing fragments
      const matchedFragments = findMatchingFragments(fragments, row)

      if (matchedFragments.length === 0) {
        throw new LotIdentificationError(
          `Cannot identify source lots for sale ${row.rowKey}: no matching open lots found.`,
          row.rowKey,
        )
      }

      let sharesToSell = row.shares
      const totalAvailable = matchedFragments.reduce((sum, f) => sum.plus(f.sharesOpen), ZERO)

      if (totalAvailable.lt(sharesToSell)) {
        throw new InsufficientSharesError(
          `Insufficient shares for sale ${row.rowKey}: need ${sharesToSell.toString()}, have ${totalAvailable.toString()}.`,
          row.rowKey,
          sharesToSell.toString(),
          totalAvailable.toString(),
        )
      }

      for (const frag of matchedFragments) {
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
        salePortions.push(portion)

        // If we're taking partial shares, we need to split the fragment
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
  }

  return { fragments, salePortions }
}
