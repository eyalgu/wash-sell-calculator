import { Decimal, ZERO } from '../decimal'
import { AuditLog } from '../audit'
import type {
  SalePortion,
  LotFragment,
  ReplacementMatch,
  NormalizedRow,
  IdGenerator,
} from '../types'

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z')
  const b = new Date(dateB + 'T00:00:00Z')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Per FR-2.8: remaining shares from the same acquisition event as the
 * sold shares must not serve as replacement for that sale's loss.
 * Subsumes FR-2.5 (sell-to-cover self-trigger) as a special case.
 */
function isSameOriginAsLossSale(
  lossPortion: SalePortion,
  candidateFragment: LotFragment,
  allFragments: readonly LotFragment[],
): boolean {
  const soldFragment = allFragments.find((f) => f.fragmentId === lossPortion.soldFromFragmentId)
  if (!soldFragment) return false
  return candidateFragment.originRowKey === soldFragment.originRowKey
}

function getAvailableForReplacement(frag: LotFragment): Decimal {
  const available = frag.sharesOpen.minus(frag.consumedAsReplacement)
  return available.gt(0) ? available : ZERO
}

export function allocateReplacements(
  lossPortions: readonly SalePortion[],
  fragments: LotFragment[],
  ticker: string,
  _normalizedRows: readonly NormalizedRow[],
  idGen: IdGenerator,
  audit: AuditLog,
): ReplacementMatch[] {
  const matches: ReplacementMatch[] = []

  for (const lossPortion of lossPortions) {
    const windowStart = addDays(lossPortion.saleDate, -30)
    const windowEnd = addDays(lossPortion.saleDate, 30)

    const eligible = fragments
      .filter((f) => {
        if (f.ticker !== ticker) return false
        if (f.purchaseDateActual < windowStart) return false
        if (f.purchaseDateActual > windowEnd) return false
        if (getAvailableForReplacement(f).lte(0)) return false
        if (isSameOriginAsLossSale(lossPortion, f, fragments)) return false
        return true
      })
      .sort((a, b) => {
        const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual)
        if (dateCmp !== 0) return dateCmp
        return a.fragmentId.localeCompare(b.fragmentId)
      })

    let lossSharesRemaining = lossPortion.shares
    const disallowedLossPerShare = lossPortion.basisPerShareAtSale.minus(
      lossPortion.salePricePerShare,
    )

    for (const replacementFrag of eligible) {
      if (lossSharesRemaining.lte(0)) break

      const availableForMatch = getAvailableForReplacement(replacementFrag)
      if (availableForMatch.lte(0)) continue

      const sharesToMatch = Decimal.min(lossSharesRemaining, availableForMatch)
      const holdingDays = daysBetween(
        lossPortion.originalAcquiredDateForOrdering,
        lossPortion.saleDate,
      )

      const match: ReplacementMatch = {
        matchId: idGen.next('match'),
        salePortionId: lossPortion.salePortionId,
        replacementFragmentId: replacementFrag.fragmentId,
        matchedShares: sharesToMatch,
        disallowedLossPerShare,
        disallowedLossTotal: disallowedLossPerShare.mul(sharesToMatch),
        holdingPeriodDaysCarried: holdingDays,
      }
      matches.push(match)

      replacementFrag.consumedAsReplacement =
        replacementFrag.consumedAsReplacement.plus(sharesToMatch)
      lossSharesRemaining = lossSharesRemaining.minus(sharesToMatch)

      audit.emit(
        'REPLACEMENT_MATCHED',
        lossPortion.saleDate,
        `Matched ${sharesToMatch.toString()} replacement shares from ${replacementFrag.fragmentId} for loss on ${lossPortion.saleRowKey}`,
        {
          saleRowKey: lossPortion.saleRowKey,
          lotFragmentId: replacementFrag.fragmentId,
          payload: {
            matchedShares: sharesToMatch.toString(),
            disallowedLossPerShare: disallowedLossPerShare.toString(),
            disallowedLossTotal: disallowedLossPerShare.mul(sharesToMatch).toString(),
            holdingPeriodDaysCarried: holdingDays,
          },
        },
      )
    }
  }

  return matches
}
