---
name: Required input fields
overview: Make `transactionType` and `acquiredDate` required fields on all input rows (both BUY and SELL), updating the core types, normalizer, CSV parser, all tests, and the CLI formatter.
todos:
  - id: update-types
    content: "Removed ? from transactionType and acquiredDate on RowInput and NormalizedRow in types.ts"
    status: completed
  - id: update-normalizer
    content: "Made acquiredDate validation unconditional in a-normalize.ts, added transactionType enum validation against 6 valid values"
    status: completed
  - id: update-csv-parser
    content: "Moved transactionType and acquiredDate to REQUIRED_COLUMNS in csv-parser.ts, renamed validateOptionalTransactionType to validateTransactionType"
    status: completed
  - id: update-calculator
    content: "Removed conditional if(row.acquiredDate) wrappers in calculator.ts and b-lot-ledger.ts, FIFO fallback preserved"
    status: completed
  - id: update-tests
    content: "Added transactionType and acquiredDate to all RowInput/NormalizedRow objects across 22 test files + test-kit fixtures"
    status: completed
  - id: regen-snapshots
    content: "Regenerated 11 golden snapshots, all 22 suites / 182 tests passing, typecheck clean"
    status: completed
isProject: false
---

# Make transactionType and acquiredDate Required Input Fields

## Scope

Two currently-optional fields become required on every `RowInput`:


| Field | Current | New | Rationale |
| ----- | ------- | --- | --------- |


- `**transactionType**`: optional -> required. Needed for sell-to-cover exclusion (AC-11), and makes output far more informative. Every real transaction has a type.
- `**acquiredDate**`: optional -> required. On SELL rows it drives lot matching (avoids FIFO guessing). On BUY rows it will typically equal `date`, but supports cases where vest date differs from trade date.

No new fields are added in this change.

## Key Files

### Core types (`@wash-sale/core`)

- [packages/core/src/types.ts](misc-tools/wash-sale-calculator/packages/core/src/types.ts) -- remove `?` from `transactionType` and `acquiredDate` on both `RowInput` (lines 49-50) and `NormalizedRow` (lines 66-67)

### Normalizer (Phase A)

- [packages/core/src/phases/a-normalize.ts](misc-tools/wash-sale-calculator/packages/core/src/phases/a-normalize.ts) -- the `acquiredDate` validation currently checks `if (row.acquiredDate !== undefined)` (line 70); change to unconditional validation. No change needed for `transactionType` since the normalizer just passes it through, but consider adding validation that it's a valid enum value.

### CSV parser (`@wash-sale/adapters`)

- [packages/adapters/src/csv-parser.ts](misc-tools/wash-sale-calculator/packages/adapters/src/csv-parser.ts) -- move `transactionType` and `acquiredDate` from `OPTIONAL_COLUMNS` (line 4) to `REQUIRED_COLUMNS` (line 3). Update the parsing logic (lines 195-205) to validate these as required rather than conditionally present. `validateOptionalTransactionType` becomes `validateTransactionType` (no longer returns `undefined`).

### Calculator engine

- [packages/core/src/calculator.ts](misc-tools/wash-sale-calculator/packages/core/src/calculator.ts) -- `findAndSortMatchingFragments` currently checks `if (row.acquiredDate)` (line 53). Since `acquiredDate` is now always present, this always runs the acquiredDate-based matching path. For BUY rows this doesn't matter (they don't go through this function). For SELL rows this means acquiredDate-based HIFO matching is always preferred, falling back to FIFO only when no lots match that date. This is the desired behavior.
- [packages/core/src/phases/b-lot-ledger.ts](misc-tools/wash-sale-calculator/packages/core/src/phases/b-lot-ledger.ts) -- same pattern as calculator.ts, same change.
- [packages/core/src/phases/d-replacement-match.ts](misc-tools/wash-sale-calculator/packages/core/src/phases/d-replacement-match.ts) -- currently checks `saleRow.transactionType !== "SELL_TO_COVER"` which already works with a required field (no `undefined` concern). No functional change needed.

### Tests (bulk update)

Every test file that constructs `RowInput` objects needs `transactionType` and `acquiredDate` added to every row. Files affected:

- `packages/core/test/golden.spec.ts` -- all AC scenarios
- `packages/core/test/calculate.simple-wash-sale.spec.ts`
- `packages/core/test/calculate.partial-wash-sale.spec.ts`
- `packages/core/test/calculate.sell-to-cover-30-vs-31-day.spec.ts`
- `packages/core/test/calculate.cross-brokerage.spec.ts`
- `packages/core/test/calculate.cascade.spec.ts`
- `packages/core/test/calculate.hifo-sublot-depletion.spec.ts`
- `packages/core/test/calculate.single-matching-guard.spec.ts`
- `packages/core/test/calculate.partial-replacement-split.spec.ts`
- `packages/core/test/calculate.sell-to-cover-isolated-no-self-trigger.spec.ts`
- `packages/core/test/calculate.multi-lot-same-day-ordering.spec.ts`
- `packages/core/test/invariants.spec.ts`
- `packages/core/test/determinism.spec.ts`
- `packages/core/test/builder.immutability.spec.ts`
- `packages/core/test/phases/a-normalize.spec.ts`
- `packages/core/test/phases/b-lot-ledger.spec.ts`
- `packages/core/test/phases/d-replacement-match.spec.ts`
- `packages/core/test/phases/e-basis-adjust.spec.ts`

For BUY rows, use the appropriate type (typically `RSU_VEST`) and set `acquiredDate` equal to `date`. For SELL rows, use the appropriate type and set `acquiredDate` to the lot's original purchase date.

### Golden snapshots

After updating test inputs, golden snapshots will need to be regenerated since `normalizedRows` in the output will now always include `transactionType` and `acquiredDate` fields (previously they were omitted when undefined).

- Run `pnpm test -- -u` in the core package to update snapshots

### CLI formatter

- [packages/cli/src/formatters.ts](misc-tools/wash-sale-calculator/packages/cli/src/formatters.ts) -- no changes needed; the input table already prints Type and Acquired Date columns, and they'll now always be populated.

## Execution Order

1. Update core types (RowInput + NormalizedRow)
2. Update normalizer validation (a-normalize.ts)
3. Update CSV parser (csv-parser.ts)
4. Update calculator/lot-ledger acquiredDate checks
5. Update all test files with required fields
6. Regenerate golden snapshots
7. Verify typecheck + full test suite passes

