---
name: Wash Sale Calculator Implementation
overview: Implement a TypeScript wash sale calculation engine as a pnpm workspace inside misc-tools/wash-sale-calculator/, following the design doc's fluent builder API and 7-phase algorithm, with TDD using Jest for all acceptance criteria.
todos:
  - id: scaffold
    content: "Phase 1: Project scaffolding -- create directory structure, package.json files, tsconfig, jest config, pnpm-workspace.yaml entry, install decimal.js"
    status: completed
  - id: types
    content: "Phase 1: Define all TypeScript types (RowInput, CalculationResult, NormalizedRow, LotFragment, SalePortion, ReplacementMatch, AuditLogEntry, Form8949Row, etc.) and DI interfaces"
    status: completed
  - id: decimal-wrapper
    content: "Phase 1: Implement Decimal wrapper around decimal.js with add/sub/mul/div/cmp/round (half-up)"
    status: completed
  - id: builder-validation
    content: "Phase 2: Implement fluent builder API (forTicker/addRow/addRows/calculate) + Phase A input validation/normalization + immutability tests"
    status: completed
  - id: lot-ledger
    content: "Phase 3: TDD lot ledger (Phase B) -- BUY creates fragments, SELL resolves to lots, partial splits, FIFO fallback, HIFO sublot depletion"
    status: completed
  - id: loss-detection
    content: "Phase 4: TDD loss detection (Phase C) -- 12 tests covering gain/loss detection, multi-lot ordering, audit events"
    status: completed
  - id: replacement-matching
    content: "Phase 5: TDD replacement matching (Phase D) -- 22 tests covering AC-1 through AC-11, window boundaries, FIFO, single-matching guard"
    status: completed
  - id: basis-adjustment
    content: "Phase 6: TDD basis & date adjustment (Phase E) -- 14 tests covering basis increase, date adjustment, fragment splitting, AC-10"
    status: completed
  - id: cascade-integration
    content: "Phase 7: TDD cascade + full pipeline integration -- 10 integration test files, 12 tests covering AC-1 through AC-11 end-to-end"
    status: completed
  - id: output-generation
    content: "Phase 8: Output generation (Phase G) -- 24 tests, collectWarnings implemented (3 warning types), Form 8949, summary, remaining positions"
    status: completed
  - id: adapters
    content: "Phase 9: Adapters package -- CSV parser (16 tests), serializer (3 tests), fs-node adapter, round-trip test, CsvPort integration"
    status: completed
  - id: golden-tests
    content: "Phase 10: Test kit fixtures + 11 golden snapshots (AC-1 through AC-11), determinism test, 6 invariant tests (share + loss conservation)"
    status: completed
isProject: false
---

# Wash Sale Calculator Implementation Plan

## Project Location & Structure

The project is structured as a pnpm workspace with three sub-packages matching the design doc:

```
misc-tools/wash-sale-calculator/
  pnpm-workspace.yaml
  package.json              # root workspace scripts (test, lint, build)
  tsconfig.base.json        # shared TS config
  packages/
    core/                   # @wash-sale/core - pure calculation engine
      package.json
      tsconfig.json
      jest.config.ts
      src/
        index.ts            # public API re-exports
        types.ts            # all types from design doc section 5-6
        decimal.ts          # thin wrapper around decimal.js
        builder.ts          # AdjustedCostBasisCalculator + CalculatorBuilder
        calculator.ts       # orchestrates phases A-G
        phases/
          a-normalize.ts    # validate + normalize + sort + rowKey generation
          b-lot-ledger.ts   # build initial lot fragments, resolve sells to lots
          c-loss-detection.ts   # identify loss sale portions
          d-replacement-match.ts # wash sale matching (FIFO, single-matching)
          e-basis-adjust.ts     # apply basis + acquisition date adjustments
          g-output.ts           # Form 8949, summary, remaining positions
        errors.ts           # ValidationError, custom error types
        audit.ts            # audit log builder
      test/
        builder.immutability.spec.ts
        calculate.simple-wash-sale.spec.ts
        calculate.partial-wash-sale.spec.ts
        calculate.cross-brokerage.spec.ts
        calculate.sell-to-cover-30-vs-31-day.spec.ts
        calculate.sell-to-cover-isolated-no-self-trigger.spec.ts
        calculate.multi-lot-same-day-ordering.spec.ts
        calculate.hifo-sublot-depletion.spec.ts
        calculate.single-matching-guard.spec.ts
        calculate.partial-replacement-split.spec.ts
        calculate.cascade.spec.ts
        phases/              # unit tests per phase
          a-normalize.spec.ts
          b-lot-ledger.spec.ts
          c-loss-detection.spec.ts
          d-replacement-match.spec.ts
          e-basis-adjust.spec.ts
          g-output.spec.ts
        determinism.spec.ts
        invariants.spec.ts   # share conservation, loss conservation
    adapters/               # @wash-sale/adapters - CSV, file I/O
      package.json
      tsconfig.json
      src/
        csv-parser.ts
        csv-serializer.ts
        fs-node.ts
      test/
        csv.spec.ts
    test-kit/               # @wash-sale/test-kit - shared fixtures
      package.json
      tsconfig.json
      src/
        fixtures.ts         # reusable test data builders
        golden/             # golden test snapshots (JSON)
```

## Monorepo Integration

- Add `misc-tools/wash-sale-calculator/packages/*` to the root [pnpm-workspace.yaml](pnpm-workspace.yaml)
- Use `decimal.js` as the decimal arithmetic library
- Use Jest for testing (already in the monorepo's devDependencies)
- TypeScript 5.9.3 (from the monorepo catalog)
- No Bazel integration needed (this is a standalone tool, similar to `flag-wizard`)

## Implementation Sequence

The approach is **types + builder shell first, then TDD for each algorithm phase**. Each phase writes failing tests derived from the PRD acceptance criteria, then implements until tests pass.

### Phase 1: Scaffold + Types (no algorithm logic)

Set up the project structure, all TypeScript types from design doc sections 5.2-6.4, and the `Decimal` wrapper around `decimal.js`. This includes:

- All public types: `RowInput`, `CalculationResult`, `NormalizedRow`, `LotFragment`, `SalePortion`, `ReplacementMatch`, `AuditLogEntry`, `Form8949Row`, `Form8949Data`, `RemainingPosition`, `SummaryTotals`, `ReconciliationReport`, `CalculationWarning`
- DI interfaces: `IdGenerator`, `DecimalMath`, `CsvPort`, `FileSystemPort`
- Decimal wrapper: thin facade over `decimal.js` exposing `add`, `sub`, `mul`, `div`, `cmp`, `round` with half-up rounding
- Enum/union types: `Action`, `Source`, `TransactionType`, `AuditEventType`

### Phase 2: Builder Shell + Validation

Implement the fluent builder API and input validation (Phase A of the algorithm):

- `AdjustedCostBasisCalculator.forTicker("FIG")` returns a `CalculatorBuilder`
- `addRow()` / `addRows()` append-only, returns `this` for chaining
- `calculate()` calls the algorithm pipeline and returns frozen `CalculationResult`
- Phase A normalize: validate dates/numbers, reject negative shares, generate deterministic `sortKey` and `rowKey`, emit `ROW_NORMALIZED` audit entries
- **Immutability contract**: after `calculate()`, all inputs/outputs are `Object.freeze()`-d

Write `builder.immutability.spec.ts` tests:

- Builder fluency (chaining returns builder)
- `calculate()` returns readonly/frozen objects
- Adding rows after `calculate()` throws or creates a new builder
- Invalid input (bad dates, negative shares) throws `ValidationError`

### Phase 3: TDD - Lot Ledger (Phase B)

Tests first for lot construction and sell-lot resolution:

- BUY creates a `LotFragment` with correct initial fields
- SELL resolves to matching lot(s) via `acquiredDate` + FIFO fallback
- Partial lot sale splits fragment into sold/remaining portions
- Insufficient shares throws validation error
- FIFO fallback when `acquiredDate` not provided
- HIFO sublot depletion (FR-3.6) when selling from ambiguous sublots

### Phase 4: TDD - Loss Detection (Phase C)

Tests first for identifying loss sale portions:

- Sale at a gain produces no loss portion
- Sale at a loss produces `SalePortion` with negative `gainLoss`
- Multi-lot same-day sale creates separate loss portions (no averaging)
- Loss portions ordered by sale date, then by original acquisition date for same-day ties

### Phase 5: TDD - Replacement Matching (Phase D) -- Core Wash Sale Logic

This is the most complex phase. Tests derived from PRD acceptance criteria:

- **AC-1** (simple wash sale): 100% match, full disallowed loss
- **AC-2** (partial wash sale): fewer replacement shares than loss shares
- **AC-3** (MS PDF example): 79 sold, 82 bought, lot split
- **AC-9** (single-matching guard): replacement shares used once only
- **AC-11** (sell-to-cover self-trigger exclusion): same-day vest excluded as replacement for its own sell-to-cover
- **AC-4** (sell-to-cover 30-day trigger): next vest within 30 days
- **AC-5** (sell-to-cover 31-day non-trigger): next vest outside window
- FIFO replacement ordering (earliest acquisition first)
- Wash window calculation: `[saleDate - 30, saleDate + 30]` using actual purchase dates

Key implementation details:

- For each ordered loss portion, scan eligible replacement fragments in the window
- Exclude same-day vest for SELL_TO_COVER losses (FR-2.5)
- Match share-by-share with FIFO ordering on replacement fragments
- Track consumed replacement shares to enforce single-matching (FR-2.6 / Reg. 1.1091-1(e))
- For same-day multi-lot losses with insufficient replacements, allocate to earlier-ordered losses first

### Phase 6: TDD - Basis & Date Adjustment (Phase E)

Tests for adjustment application:

- `basisPerShareAdjusted` increases by `disallowedLossPerShare`
- `acquisitionDateAdjusted` = `replacementPurchaseDate - daysHeld`
- Fragment splitting when partial replacement match
- Wash adjustment history appended
- **AC-10** (partial replacement split): 80 shares matched out of 100

### Phase 7: TDD - Cascade + Full Pipeline (Phase F integration)

Not a separate phase in code -- cascades work naturally when processing chronologically with updated fragment state. Tests:

- **AC-7** (multi-lot November pattern): three loss sub-sales, 100 replacement shares, ordered matching
- **AC-8** (HIFO sublot depletion): sell-to-cover from wash-adjusted lot
- **AC-6** (cross-brokerage IPO to Shareworks): Computershare loss + Shareworks vest replacement
- Chain: loss -> wash adjustment -> subsequent sale at adjusted-basis loss -> new wash sale

### Phase 8: Output Generation (Phase G)

- Form 8949 row construction: short-term vs long-term split based on adjusted acquisition date
- Rounding to cents (half-up) at output boundary only
- `SummaryTotals`: realized gain/loss (ST/LT), total disallowed, deferred in remaining holdings
- `RemainingPosition` list from open fragments
- `ReconciliationReport` when comparison data provided (FR-4.1, FR-4.4)
- Warning collection

### Phase 9: Adapters Package

- `CsvParser`: parse CSV text into `RowInput[]` (validate headers, map columns)
- `CsvSerializer`: `CalculationResult` -> CSV text for Form 8949 export (FR-5.3)
- `FsNode`: `FileSystemPort` implementation using `fs/promises`

### Phase 10: Test Kit + Golden Tests

- Reusable test data builders (`makeVest()`, `makeSellToCover()`, `makeIpoSale()`, etc.)
- Golden snapshot tests: run AC-1 through AC-11 scenarios, serialize full `CalculationResult` to JSON, snapshot for regression
- Determinism test: run same input 100x, assert byte-identical JSON output
- Share conservation invariant: total shares in (BUY) = total shares out (SELL) + total shares remaining

## Key Technical Decisions

- **Decimal arithmetic**: All internal math uses `decimal.js` via a thin `Decimal` wrapper. No `number` type for monetary values. Rounding (half-up to cents) only at Phase G output boundaries.
- **ID generation**: Default `IdGenerator` uses deterministic counters (`frag_001`, `frag_002`, ...) for reproducibility. No UUIDs.
- **Immutability**: `Object.freeze()` on all output objects. Internal processing uses fresh objects rather than mutation where practical.
- **Phase F (cascades)**: No special recursion. The chronological processing loop in `calculator.ts` naturally handles cascades because each sale uses the *current* adjusted basis of the fragment being sold.
- **Sell-to-cover self-exclusion**: During Phase D, when processing a `SELL_TO_COVER` loss portion, filter out any BUY fragment whose `purchaseDateActual` matches the sell date AND whose origin is the same vest event. This is tracked via `rowKey` linkage between the vest BUY and its sell-to-cover SELL.

