import { Decimal, d, ZERO, roundCents } from '../decimal'
import type { AuditLog } from '../audit'
import type {
  Ticker,
  LotFragment,
  NormalizedRow,
  SalePortion,
  ReplacementMatch,
  Form8949Row,
  Form8949Data,
  RemainingPosition,
  SummaryTotals,
  CalculationWarning,
  Term,
} from '../types'

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z')
  const b = new Date(dateB + 'T00:00:00Z')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function determineTerm(acquiredDate: string, soldDate: string): Term {
  const days = daysBetween(acquiredDate, soldDate)
  return days > 365 ? 'LONG' : 'SHORT'
}

interface SaleWithAdjustment {
  portion: SalePortion
  disallowedTotal: Decimal
  adjustedAcquiredDate: string
}

/**
 * Merges Form 8949 rows that share the same acquired date, sold date, and
 * adjustment code.  This happens when a lot is split for internal tracking
 * (e.g. replacement-share matching) but both halves are sold in the same
 * transaction with no differing wash-sale treatment.
 */
function consolidateRows(rows: Form8949Row[], ticker: Ticker, audit?: AuditLog): Form8949Row[] {
  const keyOf = (r: Form8949Row): string =>
    `${r.dateAcquired}|${r.dateSold}|${r.adjustmentCode ?? ''}`

  const grouped = new Map<string, Form8949Row[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(key, [row])
    }
  }

  const result: Form8949Row[] = []
  for (const bucket of grouped.values()) {
    if (bucket.length === 1) {
      result.push(bucket[0]!)
      continue
    }
    let totalShares = ZERO
    let totalProceeds = ZERO
    let totalCostBasis = ZERO
    let totalAdjustment = ZERO
    let totalGainOrLoss = ZERO
    const { dateAcquired, dateSold, adjustmentCode, term } = bucket[0]!
    const sourceDescriptions: string[] = []
    for (const row of bucket) {
      const shares = d(row.description.split(' ')[0]!)
      totalShares = totalShares.plus(shares)
      totalProceeds = totalProceeds.plus(row.proceeds)
      totalCostBasis = totalCostBasis.plus(row.costBasis)
      totalAdjustment = totalAdjustment.plus(row.adjustmentAmount ?? ZERO)
      totalGainOrLoss = totalGainOrLoss.plus(row.gainOrLoss)
      sourceDescriptions.push(row.description)
    }
    const hasWashSale = adjustmentCode === 'W'
    const merged: Form8949Row = {
      description: `${totalShares.toString()} sh ${ticker}`,
      dateAcquired,
      dateSold,
      proceeds: roundCents(totalProceeds),
      costBasis: roundCents(totalCostBasis),
      adjustmentCode: hasWashSale ? 'W' : undefined,
      adjustmentAmount: hasWashSale ? roundCents(totalAdjustment) : undefined,
      gainOrLoss: roundCents(totalGainOrLoss),
      term,
    }
    audit?.emit(
      'ROWS_CONSOLIDATED',
      dateSold,
      `Consolidated ${bucket.length} rows into ${merged.description} (sold ${dateSold}): ${sourceDescriptions.join(' + ')}`,
      {
        payload: {
          mergedCount: bucket.length,
          sourceDescriptions,
          resultDescription: merged.description,
          dateAcquired,
          dateSold,
        },
      },
    )
    result.push(merged)
  }
  return result
}

export function buildForm8949(
  ticker: Ticker,
  salePortions: readonly SalePortion[],
  matches: readonly ReplacementMatch[],
  fragments: readonly LotFragment[],
  audit?: AuditLog,
): Form8949Data {
  // Build a map: salePortionId → total disallowed loss
  const disallowedBySale = new Map<string, Decimal>()
  for (const match of matches) {
    const current = disallowedBySale.get(match.salePortionId) ?? ZERO
    disallowedBySale.set(match.salePortionId, current.plus(match.disallowedLossTotal))
  }

  // Build a map: salePortionId → adjusted acquisition date from the sold fragment
  // The adjusted acquisition date comes from the fragment that was sold
  const adjustedDateBySale = new Map<string, string>()
  for (const portion of salePortions) {
    const frag = fragments.find((f) => f.fragmentId === portion.soldFromFragmentId)
    if (frag) {
      adjustedDateBySale.set(portion.salePortionId, frag.acquisitionDateAdjusted)
    }
  }

  const salesWithAdj: SaleWithAdjustment[] = salePortions.map((portion) => ({
    portion,
    disallowedTotal: disallowedBySale.get(portion.salePortionId) ?? ZERO,
    adjustedAcquiredDate:
      adjustedDateBySale.get(portion.salePortionId) ?? portion.originalAcquiredDateForOrdering,
  }))

  const shortTermRows: Form8949Row[] = []
  const longTermRows: Form8949Row[] = []
  const exportNotes: string[] = []

  for (const sale of salesWithAdj) {
    const { portion, disallowedTotal, adjustedAcquiredDate } = sale
    const term = determineTerm(adjustedAcquiredDate, portion.saleDate)
    const proceeds = roundCents(portion.proceeds)
    const costBasis = roundCents(portion.shares.mul(portion.basisPerShareAtSale))
    const hasWashSale = disallowedTotal.gt(0)

    const gainOrLoss = hasWashSale
      ? roundCents(proceeds.minus(costBasis).plus(disallowedTotal))
      : roundCents(proceeds.minus(costBasis))

    const row: Form8949Row = {
      description: `${portion.shares.toString()} sh ${ticker}`,
      dateAcquired: adjustedAcquiredDate,
      dateSold: portion.saleDate,
      proceeds,
      costBasis,
      adjustmentCode: hasWashSale ? 'W' : undefined,
      adjustmentAmount: hasWashSale ? roundCents(disallowedTotal) : undefined,
      gainOrLoss,
      term,
    }

    if (term === 'SHORT') {
      shortTermRows.push(row)
    } else {
      longTermRows.push(row)
    }
  }

  return {
    shortTermRows: consolidateRows(shortTermRows, ticker, audit),
    longTermRows: consolidateRows(longTermRows, ticker, audit),
    exportNotes,
  }
}

export function buildRemainingPositions(fragments: readonly LotFragment[]): RemainingPosition[] {
  return fragments
    .filter((f) => f.sharesOpen.gt(0))
    .map((f) => ({
      fragmentId: f.fragmentId,
      ticker: f.ticker,
      source: f.source,
      sharesOpen: f.sharesOpen,
      purchaseDateActual: f.purchaseDateActual,
      acquisitionDateAdjusted: f.acquisitionDateAdjusted,
      originalBasisPerShare: f.originalBasisPerShare,
      basisPerShareAdjusted: f.basisPerShareAdjusted,
      washAdjustmentHistory: f.washAdjustmentHistory,
    }))
}

export function buildSummary(
  salePortions: readonly SalePortion[],
  matches: readonly ReplacementMatch[],
  remainingPositions: readonly RemainingPosition[],
): SummaryTotals {
  const disallowedBySale = new Map<string, Decimal>()
  for (const match of matches) {
    const current = disallowedBySale.get(match.salePortionId) ?? ZERO
    disallowedBySale.set(match.salePortionId, current.plus(match.disallowedLossTotal))
  }

  let realizedST = ZERO
  let realizedLT = ZERO
  let totalDisallowed = ZERO
  let totalAllowed = ZERO

  for (const portion of salePortions) {
    const disallowed = disallowedBySale.get(portion.salePortionId) ?? ZERO
    const allowedGainLoss = portion.gainLoss.plus(disallowed)

    // Determine term using original acquired date (simplified; should use adjusted)
    const days = daysBetween(portion.originalAcquiredDateForOrdering, portion.saleDate)
    if (days > 365) {
      realizedLT = realizedLT.plus(allowedGainLoss)
    } else {
      realizedST = realizedST.plus(allowedGainLoss)
    }

    totalDisallowed = totalDisallowed.plus(disallowed)
    if (portion.gainLoss.isNegative()) {
      const allowedLoss = portion.gainLoss.abs().minus(disallowed)
      if (allowedLoss.gt(0)) {
        totalAllowed = totalAllowed.plus(allowedLoss)
      }
    }
  }

  // Deferred losses in remaining holdings = sum of wash adjustments on open positions
  let deferredInRemaining = ZERO
  for (const pos of remainingPositions) {
    const adjustmentPerShare = pos.basisPerShareAdjusted.minus(pos.originalBasisPerShare)
    if (adjustmentPerShare.gt(0)) {
      deferredInRemaining = deferredInRemaining.plus(adjustmentPerShare.mul(pos.sharesOpen))
    }
  }

  return {
    realizedGainLossShortTerm: roundCents(realizedST),
    realizedGainLossLongTerm: roundCents(realizedLT),
    totalDisallowedLosses: roundCents(totalDisallowed),
    deferredLossesInRemainingHoldings: roundCents(deferredInRemaining),
    totalAllowedLosses: roundCents(totalAllowed),
  }
}

/**
 * Collects warnings for potential data issues or anomalies in the calculation.
 * - Share count mismatch: total bought != total sold + remaining (when normalizedRows provided)
 * - Negative remaining shares: fragment with sharesOpen < 0
 * - Large wash sale adjustments: adjustment > 50% of original basis
 */
export function collectWarnings(
  salePortions: readonly SalePortion[],
  matches: readonly ReplacementMatch[],
  fragments: readonly LotFragment[],
  normalizedRows?: readonly NormalizedRow[],
): CalculationWarning[] {
  const warnings: CalculationWarning[] = []

  // 1. Share count mismatch: total bought != total sold + remaining
  if (normalizedRows && normalizedRows.length > 0) {
    const totalBought = normalizedRows
      .filter((r) => r.action === 'BUY')
      .reduce((sum, r) => sum.plus(r.shares), ZERO)
    const totalSold = salePortions.reduce((sum, p) => sum.plus(p.shares), ZERO)
    const totalRemaining = fragments.reduce((sum, f) => sum.plus(f.sharesOpen), ZERO)
    const expectedTotal = totalSold.plus(totalRemaining)
    if (!totalBought.eq(expectedTotal)) {
      warnings.push({
        code: 'SHARE_COUNT_MISMATCH',
        message: `Share count mismatch: bought ${totalBought.toString()}, sold+remaining ${expectedTotal.toString()}`,
      })
    }
  }

  // 2. Negative remaining shares
  for (const frag of fragments) {
    if (frag.sharesOpen.lt(0)) {
      warnings.push({
        code: 'NEGATIVE_REMAINING_SHARES',
        message: `Fragment ${frag.fragmentId} has negative remaining shares: ${frag.sharesOpen.toString()}`,
        fragmentId: frag.fragmentId,
      })
    }
  }

  // 3. Large wash sale adjustments (> 50% of original basis)
  for (const match of matches) {
    const frag = fragments.find((f) => f.fragmentId === match.replacementFragmentId)
    if (frag && frag.originalBasisPerShare.gt(0)) {
      const pct = match.disallowedLossPerShare.div(frag.originalBasisPerShare).mul(100)
      if (pct.gt(50)) {
        warnings.push({
          code: 'LARGE_WASH_SALE_ADJUSTMENT',
          message: `Wash sale adjustment (${match.disallowedLossPerShare.toString()} per share) exceeds 50% of original basis (${frag.originalBasisPerShare.toString()}) for fragment ${frag.fragmentId}`,
          fragmentId: frag.fragmentId,
        })
      }
    }
  }

  return warnings
}
