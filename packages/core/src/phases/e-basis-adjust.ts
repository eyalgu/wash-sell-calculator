import { ZERO } from '../decimal'
import { AuditLog } from '../audit'
import { addDays } from './d-replacement-match'
import type { ReplacementMatch, LotFragment, IdGenerator } from '../types'

/**
 * Apply basis and acquisition date adjustments to replacement fragments.
 * If a replacement fragment is only partially matched, split it into
 * adjusted and unadjusted portions.
 *
 * When multiple matches with DIFFERENT disallowedLossPerShare hit the
 * same fragment (AC-8 HIFO sublot depletion), split so each matched
 * portion gets only its own adjustment — enabling HIFO depletion from
 * higher-basis sublots first on subsequent sells.
 */
export function applyAdjustments(
  matches: readonly ReplacementMatch[],
  fragments: LotFragment[],
  idGen: IdGenerator,
  audit: AuditLog,
): void {
  // Group matches by replacement fragment to handle splits
  const matchesByFragment = new Map<string, ReplacementMatch[]>()
  for (const match of matches) {
    const existing = matchesByFragment.get(match.replacementFragmentId) ?? []
    existing.push(match)
    matchesByFragment.set(match.replacementFragmentId, existing)
  }

  for (const [fragmentId, fragMatches] of matchesByFragment) {
    const fragIndex = fragments.findIndex((f) => f.fragmentId === fragmentId)
    if (fragIndex === -1) continue
    const frag = fragments[fragIndex]!

    const totalMatched = fragMatches.reduce((sum, m) => sum.plus(m.matchedShares), ZERO)

    const hasMultipleDifferentAdjustments =
      fragMatches.length > 1 &&
      new Set(fragMatches.map((m) => m.disallowedLossPerShare.toString())).size > 1

    if (
      !hasMultipleDifferentAdjustments &&
      fragMatches.length === 1 &&
      totalMatched.lt(frag.sharesOpen)
    ) {
      // Single partial match: original behavior — create remainder as new,
      // shrink original to adjusted portion (keeps original fragment ID)
      const match = fragMatches[0]!
      if (match.disallowedLossPerShare.lte(0)) continue

      const unadjustedShares = frag.sharesOpen.minus(totalMatched)
      const remainder: LotFragment = {
        fragmentId: idGen.next('frag'),
        originRowKey: frag.originRowKey,
        ticker: frag.ticker,
        source: frag.source,
        sharesOpen: unadjustedShares,
        purchaseDateActual: frag.purchaseDateActual,
        acquisitionDateAdjusted: frag.acquisitionDateAdjusted,
        basisPerShareAdjusted: frag.basisPerShareAdjusted,
        originalBasisPerShare: frag.originalBasisPerShare,
        washAdjustmentHistory: [...frag.washAdjustmentHistory],
        consumedAsReplacement: ZERO,
      }
      fragments.push(remainder)

      audit.emit(
        'LOT_SPLIT',
        frag.purchaseDateActual,
        `Split ${frag.fragmentId}: ${totalMatched.toString()} shares adjusted, ${unadjustedShares.toString()} shares unadjusted → ${remainder.fragmentId}`,
        {
          lotFragmentId: frag.fragmentId,
          relatedFragmentId: remainder.fragmentId,
          payload: {
            adjustedShares: totalMatched.toString(),
            unadjustedShares: unadjustedShares.toString(),
          },
        },
      )

      frag.sharesOpen = totalMatched
      frag.consumedAsReplacement = totalMatched
      frag.basisPerShareAdjusted = frag.basisPerShareAdjusted.plus(match.disallowedLossPerShare)
      frag.acquisitionDateAdjusted = addDays(
        frag.purchaseDateActual,
        -match.holdingPeriodDaysCarried,
      )
      frag.washAdjustmentHistory = [
        ...frag.washAdjustmentHistory,
        {
          matchId: match.matchId,
          disallowedLossPerShare: match.disallowedLossPerShare,
          fromSaleRowKey: match.salePortionId,
          appliedAt: frag.purchaseDateActual,
        },
      ]

      audit.emit(
        'BASIS_ADJUSTED',
        frag.purchaseDateActual,
        `Adjusted basis of ${frag.fragmentId} by +${match.disallowedLossPerShare.toString()}/share → ${frag.basisPerShareAdjusted.toString()}/share`,
        {
          lotFragmentId: frag.fragmentId,
          payload: {
            disallowedLossPerShare: match.disallowedLossPerShare.toString(),
            newBasisPerShare: frag.basisPerShareAdjusted.toString(),
            matchId: match.matchId,
          },
        },
      )

      audit.emit(
        'ACQ_DATE_ADJUSTED',
        frag.purchaseDateActual,
        `Adjusted acquisition date of ${frag.fragmentId} to ${frag.acquisitionDateAdjusted} (carried ${match.holdingPeriodDaysCarried} days)`,
        {
          lotFragmentId: frag.fragmentId,
          payload: {
            originalAcqDate: frag.purchaseDateActual,
            adjustedAcqDate: frag.acquisitionDateAdjusted,
            holdingPeriodDaysCarried: match.holdingPeriodDaysCarried,
          },
        },
      )
    } else {
      // Multiple matches with different adjustments (AC-8) or full match:
      // carve off per-match to create sublots for HIFO
      let workingFrag = frag
      for (const match of fragMatches) {
        if (match.disallowedLossPerShare.lte(0)) continue

        const sharesToTake = match.matchedShares

        if (sharesToTake.lt(workingFrag.sharesOpen)) {
          const adjustedFrag: LotFragment = {
            fragmentId: idGen.next('frag'),
            originRowKey: workingFrag.originRowKey,
            ticker: workingFrag.ticker,
            source: workingFrag.source,
            sharesOpen: sharesToTake,
            purchaseDateActual: workingFrag.purchaseDateActual,
            acquisitionDateAdjusted: workingFrag.acquisitionDateAdjusted,
            basisPerShareAdjusted: workingFrag.basisPerShareAdjusted.plus(
              match.disallowedLossPerShare,
            ),
            originalBasisPerShare: workingFrag.originalBasisPerShare,
            washAdjustmentHistory: [
              ...workingFrag.washAdjustmentHistory,
              {
                matchId: match.matchId,
                disallowedLossPerShare: match.disallowedLossPerShare,
                fromSaleRowKey: match.salePortionId,
                appliedAt: workingFrag.purchaseDateActual,
              },
            ],
            consumedAsReplacement: sharesToTake,
          }
          adjustedFrag.acquisitionDateAdjusted = addDays(
            workingFrag.purchaseDateActual,
            -match.holdingPeriodDaysCarried,
          )
          fragments.push(adjustedFrag)

          audit.emit(
            'LOT_SPLIT',
            workingFrag.purchaseDateActual,
            `Split ${workingFrag.fragmentId}: ${sharesToTake.toString()} shares adjusted (→ ${adjustedFrag.fragmentId}), ${workingFrag.sharesOpen.minus(sharesToTake).toString()} remainder`,
            {
              lotFragmentId: workingFrag.fragmentId,
              relatedFragmentId: adjustedFrag.fragmentId,
              payload: {
                adjustedShares: sharesToTake.toString(),
                disallowedLossPerShare: match.disallowedLossPerShare.toString(),
                remainderShares: workingFrag.sharesOpen.minus(sharesToTake).toString(),
              },
            },
          )

          audit.emit(
            'BASIS_ADJUSTED',
            workingFrag.purchaseDateActual,
            `Adjusted basis of ${adjustedFrag.fragmentId} by +${match.disallowedLossPerShare.toString()}/share → ${adjustedFrag.basisPerShareAdjusted.toString()}/share`,
            {
              lotFragmentId: adjustedFrag.fragmentId,
              payload: {
                disallowedLossPerShare: match.disallowedLossPerShare.toString(),
                newBasisPerShare: adjustedFrag.basisPerShareAdjusted.toString(),
                matchId: match.matchId,
              },
            },
          )

          audit.emit(
            'ACQ_DATE_ADJUSTED',
            workingFrag.purchaseDateActual,
            `Adjusted acquisition date of ${adjustedFrag.fragmentId} to ${adjustedFrag.acquisitionDateAdjusted} (carried ${match.holdingPeriodDaysCarried} days)`,
            {
              lotFragmentId: adjustedFrag.fragmentId,
              payload: {
                originalAcqDate: workingFrag.purchaseDateActual,
                adjustedAcqDate: adjustedFrag.acquisitionDateAdjusted,
                holdingPeriodDaysCarried: match.holdingPeriodDaysCarried,
              },
            },
          )

          workingFrag.sharesOpen = workingFrag.sharesOpen.minus(sharesToTake)
          workingFrag.consumedAsReplacement = workingFrag.consumedAsReplacement.minus(sharesToTake)
        } else {
          workingFrag.basisPerShareAdjusted = workingFrag.basisPerShareAdjusted.plus(
            match.disallowedLossPerShare,
          )
          workingFrag.acquisitionDateAdjusted = addDays(
            workingFrag.purchaseDateActual,
            -match.holdingPeriodDaysCarried,
          )
          workingFrag.washAdjustmentHistory = [
            ...workingFrag.washAdjustmentHistory,
            {
              matchId: match.matchId,
              disallowedLossPerShare: match.disallowedLossPerShare,
              fromSaleRowKey: match.salePortionId,
              appliedAt: workingFrag.purchaseDateActual,
            },
          ]
          if (fragMatches.length === 1) {
            workingFrag.consumedAsReplacement = totalMatched
          }

          audit.emit(
            'BASIS_ADJUSTED',
            workingFrag.purchaseDateActual,
            `Adjusted basis of ${workingFrag.fragmentId} by +${match.disallowedLossPerShare.toString()}/share → ${workingFrag.basisPerShareAdjusted.toString()}/share`,
            {
              lotFragmentId: workingFrag.fragmentId,
              payload: {
                disallowedLossPerShare: match.disallowedLossPerShare.toString(),
                newBasisPerShare: workingFrag.basisPerShareAdjusted.toString(),
                matchId: match.matchId,
              },
            },
          )

          audit.emit(
            'ACQ_DATE_ADJUSTED',
            workingFrag.purchaseDateActual,
            `Adjusted acquisition date of ${workingFrag.fragmentId} to ${workingFrag.acquisitionDateAdjusted} (carried ${match.holdingPeriodDaysCarried} days)`,
            {
              lotFragmentId: workingFrag.fragmentId,
              payload: {
                originalAcqDate: workingFrag.purchaseDateActual,
                adjustedAcqDate: workingFrag.acquisitionDateAdjusted,
                holdingPeriodDaysCarried: match.holdingPeriodDaysCarried,
              },
            },
          )
        }
      }
    }
  }
}
