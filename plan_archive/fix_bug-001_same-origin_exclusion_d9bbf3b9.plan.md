---
name: Fix BUG-001 same-origin exclusion
overview: Fix BUG-001 by generalizing the existing `isSellToCoverSelfTrigger` filter in Phase D (replacement matching) to exclude ALL same-origin fragments — not just sell-to-cover — using `originRowKey` matching. Add FR-2.8 and AC-12 to the PRD, update specs, and add integration tests.
todos:
  - id: phase1-prd
    content: "Phase 1: Add FR-2.8 (same-acquisition exclusion) and AC-12 (partial lot scenario) to PRD.md"
    status: completed
  - id: phase2-unit-spec
    content: "Phase 2a: Add AC-12 tests to d-replacement-match.spec.ts — 3 tests (same-origin excluded, different-origin allowed, full scenario) + AC-11 describe rename"
    status: completed
  - id: phase2-integration-spec
    content: "Phase 2b: Create calculate.partial-lot-same-origin-exclusion.spec.ts — end-to-end test with 8 assertions"
    status: completed
  - id: phase3-code-fix
    content: "Phase 3: Replace isSellToCoverSelfTrigger with isSameOriginAsLossSale in d-replacement-match.ts — also fixed AC-11 unit tests to include sold fragment and prefixed unused normalizedRows param"
    status: completed
  - id: phase4-verify
    content: "Phase 4: Full test suite — 21 suites, 160 tests, 11 snapshots, all passing"
    status: completed
isProject: false
---

# Fix BUG-001: Same-Lot Replacement Exclusion

## Context

When selling part of a lot at a loss, the remaining unsold shares from the **same acquisition** are incorrectly matched as replacement shares, triggering a false wash sale. The existing `isSellToCoverSelfTrigger` in [d-replacement-match.ts](misc-tools/wash-sale-calculator/packages/core/src/phases/d-replacement-match.ts) already solves a special case of this for `SELL_TO_COVER`. The fix generalizes this to all sale types using `originRowKey` matching.

## Code change

### Replace `isSellToCoverSelfTrigger` with `isSameOriginAsLossSale`

In [d-replacement-match.ts](misc-tools/wash-sale-calculator/packages/core/src/phases/d-replacement-match.ts):

- **Delete** `isSellToCoverSelfTrigger` (lines 23-40)
- **Add** a new function that checks `originRowKey` identity:

```typescript
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
  const soldFragment = allFragments.find(
    (f) => f.fragmentId === lossPortion.soldFromFragmentId,
  )
  if (!soldFragment) return false
  return candidateFragment.originRowKey === soldFragment.originRowKey
}
```

- **Update** the filter call in `allocateReplacements` (line 67): replace `isSellToCoverSelfTrigger(lossPortion, f, normalizedRows)` with `isSameOriginAsLossSale(lossPortion, f, fragments)`
- The `normalizedRows` param on `allocateReplacements` stays (used elsewhere), but the exclusion function no longer needs it

## PRD update

In [PRD.md](misc-tools/wash-sale-calculator/PRD.md):

### Add FR-2.8 (after FR-2.7, line ~183)

> **FR-2.8: Same-acquisition replacement exclusion**
> When selling part of a lot at a loss, the remaining unsold shares from the same acquisition event must NOT be treated as replacement shares for that loss sale. Only shares from separate acquisition events qualify as replacements. This reflects the prevailing interpretation of IRC section 1091(a) and is consistent with every regulatory example in Reg. section 1.1091-1. This generalizes FR-2.5 (sell-to-cover self-trigger exclusion) — the same-day vest exclusion for sell-to-cover is a special case of same-acquisition exclusion.

### Add AC-12 (after AC-11, line ~398)

> **AC-12: Partial Lot Sale — Same-Lot Remainder Excluded from Replacement**
>
> - BUY 100 shares at $10 on Jan 15
> - BUY 20 shares at $12 on Jan 16
> - SELL 50 shares at $8 on Feb 1 (from Jan 15 lot)
> - **Expected:** Loss = $2/share x 50 = $100. The 50 remaining Jan 15 shares are NOT replacement (same acquisition). The 20 Jan 16 shares ARE replacement (different acquisition, within window). Disallowed = $40, allowed = $60. The 20 replacement shares get +$2 basis (new basis = $14/share).

## Spec updates

### Unit spec: [d-replacement-match.spec.ts](misc-tools/wash-sale-calculator/packages/core/test/phases/d-replacement-match.spec.ts)

Add a new `describe('AC-12: same-origin exclusion for partial lot sales')` block with three tests:

1. **Same-origin fragment excluded** — Partial sale from `frag_001`, remaining shares in `frag_001` (same `originRowKey`) → 0 matches
2. **Different-origin fragment allowed** — Same scenario plus `frag_002` from different `originRowKey` → matches only `frag_002`
3. **Full AC-12 scenario** — BUY 100 Jan 15, BUY 20 Jan 16, SELL 50 Feb 1 from Jan 15 lot → 20 shares matched from Jan 16 lot, disallowed = $40

Also update the existing `AC-11: sell-to-cover self-trigger exclusion` describe block name to note it's now a special case of same-origin exclusion (the tests themselves stay unchanged — they should pass as-is since `originRowKey` matching subsumes the STC check).

### Integration spec: new file `calculate.partial-lot-same-origin-exclusion.spec.ts`

Following the pattern of [calculate.partial-wash-sale.spec.ts](misc-tools/wash-sale-calculator/packages/core/test/calculate.partial-wash-sale.spec.ts) and [calculate.sell-to-cover-isolated-no-self-trigger.spec.ts](misc-tools/wash-sale-calculator/packages/core/test/calculate.sell-to-cover-isolated-no-self-trigger.spec.ts):

- End-to-end test with `AdjustedCostBasisCalculator.forTicker('FIG').addRows(rows).calculate()`
- Input: BUY 100 @ $10 Jan 15, BUY 20 @ $12 Jan 16, SELL 50 @ $8 Feb 1 (acquiredDate: Jan 15)
- Assert:
  - `summary.totalDisallowedLosses` = 40
  - `summary.totalAllowedLosses` = 60
  - `form8949Data.shortTermRows[0].adjustmentAmount` = 40
  - `form8949Data.shortTermRows[0].gainOrLoss` = -60
  - `remainingPositions` has 3 entries: 50 shares @ $10 (Jan 15 remainder), 20 shares @ $14 (Jan 16 adjusted), and some unadjusted remainder if the Jan 16 lot wasn't fully consumed (n/a here — all 20 matched)
  Correction: remaining positions should be 2 entries since Jan 16 lot is fully consumed as replacement:
  - 50 shares @ $10 (Jan 15 unsold remainder)
  - 20 shares @ $14 (Jan 16, fully adjusted)

## Verification

Run existing test suite to confirm no regressions — the STC tests in both [d-replacement-match.spec.ts](misc-tools/wash-sale-calculator/packages/core/test/phases/d-replacement-match.spec.ts) (AC-11 block, line 257) and [calculate.sell-to-cover-isolated-no-self-trigger.spec.ts](misc-tools/wash-sale-calculator/packages/core/test/calculate.sell-to-cover-isolated-no-self-trigger.spec.ts) should pass unchanged since `originRowKey` matching is strictly more general than the old STC-specific check.