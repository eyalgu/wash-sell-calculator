import { AuditLog } from '../audit'
import type { SalePortion } from '../types'

/**
 * Filter sale portions to those with negative gain/loss (losses),
 * ordered per Reg. § 1.1091-1(b): earliest sale date first, then
 * earliest original acquisition date for same-day ties.
 */
export function identifyLossPortions(
  salePortions: readonly SalePortion[],
  audit: AuditLog,
): SalePortion[] {
  const losses = salePortions.filter((sp) => sp.gainLoss.isNegative())

  const sorted = [...losses].sort((a, b) => {
    const dateCmp = a.saleDate.localeCompare(b.saleDate)
    if (dateCmp !== 0) return dateCmp
    return a.originalAcquiredDateForOrdering.localeCompare(b.originalAcquiredDateForOrdering)
  })

  for (const sp of sorted) {
    audit.emit(
      'LOSS_DETECTED',
      sp.saleDate,
      `Loss of ${sp.gainLoss.toString()} detected on sale ${sp.saleRowKey} (${sp.shares.toString()} shares from ${sp.soldFromFragmentId})`,
      {
        saleRowKey: sp.saleRowKey,
        lotFragmentId: sp.soldFromFragmentId,
        payload: {
          shares: sp.shares.toString(),
          basisPerShare: sp.basisPerShareAtSale.toString(),
          salePrice: sp.salePricePerShare.toString(),
          gainLoss: sp.gainLoss.toString(),
        },
      },
    )
  }

  return sorted
}
