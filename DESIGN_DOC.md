# Wash Sale Calculator JS Library - Design Doc

**Author:** Eyal Blum + AI collaborator  
**Date:** 2026-03-15  
**Status:** Draft  
**Scope:** Library design for a reusable calculation engine that runs in Node.js and browser apps
**PRD:** [`PRD.md`](./PRD.md)
**README:** [`README.md`](./README.md)

---

## 1) Goals

- Provide a deterministic, testable wash-sale calculation engine for one ticker per run.
- Support both Node and browser environments with the same API and behavior.
- Optimize for correctness, auditability, and reproducibility over convenience.
- Keep design API-first in TypeScript, with implementation details intentionally minimal in this doc.

## 2) Non-Goals

- Tax advice.
- Brokerage API integrations.
- UI design (CLI/web UI can be built as separate wrappers around this library).
- Deep discussion of persistence/import layers (covered via interfaces only).

---

## 3) Design Principles

1. **API-first TypeScript**  
   Define external API contracts before implementation.

2. **Fluent builder API**  
   Primary usage should read naturally:
   `AdjustedCostBasisCalculator.forTicker("FIG").addRow(...).addRow(...).calculate()`.

3. **Prefer immutability / constant state**  
   - Rows may be mutable only while building input.
   - After `calculate()`, all calculator inputs and outputs are immutable.
   - Internal processing uses immutable snapshots where feasible.

4. **Deterministic outcomes**  
   Same input must always produce identical outputs, including tie-break behavior.

5. **Traceability first**  
   Every adjustment must produce auditable entries (what changed, why, and from which trigger).

6. **Runtime portability**  
   No mandatory Node-only APIs in core package. Optional adapters can provide file IO.

7. **Dependency injection**  
   External concerns (clock, IDs, filesystem, CSV parsing adapters, logging) go through interfaces.

8. **TDD with Jest**  
   Acceptance criteria from PRD become executable tests before implementation logic is finalized.

---

## 4) Proposed Package Structure

```text
@wash-sale/core
  - Pure calculation engine
  - TypeScript types + builder + calculator + algorithm
  - No direct fs/network access

@wash-sale/adapters
  - Optional helpers (CSV parser/serializer, file system adapter, date parsing)
  - Node/browser specific adapters behind interfaces

@wash-sale/test-kit (optional)
  - Shared fixtures
  - Golden test input/output snapshots
```

---

## 5) API Design (TypeScript First)

### 5.1 Primary Fluent API

```ts
const result = AdjustedCostBasisCalculator
  .forTicker("FIG")
  .addRow({
    date: "2025-07-31",
    action: "SELL",
    source: "Computershare",
    shares: "500",
    pricePerShare: "30", // net sale price per share after fees
    transactionType: "IPO_SALE",
    acquiredDate: "2025-07-31",
  })
  .addRow({
    date: "2025-08-01",
    action: "BUY",
    source: "Shareworks",
    shares: "200",
    pricePerShare: "115",
    transactionType: "RSU_VEST",
  })
  .calculate();
```

### 5.2 Core Public Types

```ts
export type Ticker = string;
export type IsoDate = string; // YYYY-MM-DD in API boundary
export type DecimalString = string; // avoid float ambiguity at input boundary

export type Action = "BUY" | "SELL";
export type Source = "Shareworks" | "Computershare" | "Other";
export type TransactionType =
  | "RSU_VEST"
  | "SELL_TO_COVER"
  | "IPO_SALE"
  | "OPEN_MARKET_SALE"
  | "ESPP_PURCHASE"
  | "ESPP_SALE";

export interface RowInput {
  date: IsoDate;
  action: Action;
  source: Source;
  shares: DecimalString;
  pricePerShare: DecimalString; // SELL uses net per-share price after fees
  transactionType?: TransactionType;
  acquiredDate?: IsoDate; // required for SELL when needed to resolve lot identity
  notes?: string;
}

export interface CalculationResult {
  ticker: Ticker;
  normalizedRows: readonly NormalizedRow[];
  form8949Data: Form8949Data;
  remainingPositions: readonly RemainingPosition[];
  summary: SummaryTotals;
  auditLog: readonly AuditLogEntry[];
  reconciliation?: ReconciliationReport;
  warnings: readonly CalculationWarning[];
}
```

### 5.3 Builder and Calculator Interfaces

```ts
export interface CalculatorBuilder {
  addRow(row: RowInput): CalculatorBuilder;
  addRows(rows: readonly RowInput[]): CalculatorBuilder;
  calculate(): CalculationResult;
}

export declare class AdjustedCostBasisCalculator {
  static forTicker(ticker: Ticker): CalculatorBuilder;
}
```

### 5.4 Immutability Contract

- `CalculatorBuilder` is append-only and returns itself (or a new builder) for fluent calls.
- On `calculate()`:
  - input rows are normalized and frozen (library-level immutability contract),
  - output objects are returned as readonly/frozen structures,
  - no mutable internal state is exposed.

---

## 6) Data Structures

### 6.1 Internal Canonical Row

```ts
export interface NormalizedRow {
  rowKey: string; // generated as `${date}_${action.toLowerCase()}_${index}`
  ticker: Ticker;
  date: IsoDate;
  action: Action;
  source: Source;
  shares: Decimal;
  pricePerShare: Decimal;
  transactionType?: TransactionType;
  acquiredDate?: IsoDate;
  sortKey: string; // deterministic processing key
}
```

### 6.2 Lot Fragment Model (supports splitting)

```ts
export interface LotFragment {
  fragmentId: string;
  originRowKey: string; // BUY row key that created initial lot
  ticker: Ticker;
  source: Source;
  sharesOpen: Decimal;
  purchaseDateActual: IsoDate; // never changes
  acquisitionDateAdjusted: IsoDate; // can change per wash-sale carryover
  basisPerShareAdjusted: Decimal;
  originalBasisPerShare: Decimal;
  washAdjustmentHistory: readonly WashAdjustmentRef[];
}
```

### 6.3 Sale Portion and Matching Records

```ts
export interface SalePortion {
  saleRowKey: string;
  soldFromFragmentId: string;
  shares: Decimal;
  saleDate: IsoDate;
  salePricePerShare: Decimal;
  proceeds: Decimal;
  basisPerShareAtSale: Decimal;
  gainLoss: Decimal;
  originalAcquiredDateForOrdering: IsoDate;
}

export interface ReplacementMatch {
  matchId: string;
  salePortionId: string;
  replacementFragmentId: string;
  matchedShares: Decimal;
  disallowedLossPerShare: Decimal;
  disallowedLossTotal: Decimal;
  holdingPeriodDaysCarried: number;
}
```

### 6.4 Audit and Output

```ts
export type AuditEventType =
  | "ROW_NORMALIZED"
  | "LOT_CREATED"
  | "LOT_SPLIT"
  | "SALE_PROCESSED"
  | "LOSS_DETECTED"
  | "REPLACEMENT_MATCHED"
  | "BASIS_ADJUSTED"
  | "ACQ_DATE_ADJUSTED"
  | "RECONCILIATION_DELTA"
  | "WARNING";

export interface AuditLogEntry {
  eventId: string;
  type: AuditEventType;
  at: IsoDate;
  rowKey?: string;
  saleRowKey?: string;
  lotFragmentId?: string;
  relatedFragmentId?: string;
  message: string;
  payload: Record<string, unknown>;
}

export interface Form8949Row {
  description: string;
  dateAcquired: IsoDate;
  dateSold: IsoDate;
  proceeds: Decimal;
  costBasis: Decimal;
  adjustmentCode?: "W";
  adjustmentAmount?: Decimal;
  gainOrLoss: Decimal;
  term: "SHORT" | "LONG";
}

export interface Form8949Data {
  shortTermRows: readonly Form8949Row[];
  longTermRows: readonly Form8949Row[];
  exportNotes: readonly string[]; // IRS filing-oriented notes/warnings
}
```

---

## 7) Detailed `calculate()` Algorithm (Core Design)

This section is the crux of the library. It is intentionally explicit to guarantee deterministic behavior and testability.

### Phase A - Validate and Normalize Input

1. Validate ticker and row shape.
2. Normalize date formats and numeric values.
3. Enforce required field constraints (especially SELL lot identity fields when needed).
4. Create deterministic `sortKey` for each row:
   - primary: `date ASC`
   - secondary: action precedence (BUY before SELL on same day only when required by policy)
   - tertiary: per-date+action stable index used to generate `rowKey = ${date}_${action.toLowerCase()}_${index}`.
5. Emit `ROW_NORMALIZED` audit entries.

### Phase B - Build Initial Lot Ledger

1. Iterate normalized rows in chronological order.
2. For each BUY:
   - create a `LotFragment` with `sharesOpen = shares`,
   - `purchaseDateActual = date`,
   - `acquisitionDateAdjusted = date`,
   - `basisPerShareAdjusted = purchase price`.
3. For each SELL:
   - resolve sold shares to existing open fragments according to declared lot-identification policy.
   - if selling partial shares from a fragment, split the fragment into sold/open portions.
   - fail validation only if lot identification remains unresolvable after deterministic fallback.
4. Record `SalePortion` entries with basis-at-sale.

### Phase C - Identify Loss Sale Portions

1. For each `SalePortion`, compute `gainLoss`.
2. Keep only portions where `gainLoss < 0` as candidate loss portions.
3. If one transaction sells multiple source lots, treat each sold-lot portion as its own loss disposition (no averaging).
4. Order loss portions:
   - earliest sale disposition date first,
   - if same day and order unknown, earliest original acquisition date first.
5. Emit `LOSS_DETECTED` audit entries.

### Phase D - Allocate Replacement Shares (Wash Sale Matching)

For each ordered loss portion:

1. Compute the wash window `[saleDate - 30, saleDate + 30]`.
2. Find eligible replacement fragments:
   - BUY fragments with `purchaseDateActual` in window,
   - same ticker,
   - positive open shares available for matching,
   - not already consumed for another loss beyond available shares,
   - for `SELL_TO_COVER` loss portions, exclude the same-day vest acquisition tied to that sell-to-cover event (FR-2.5 self-trigger exclusion).
3. Apply replacement matching order:
   - replacement fragments by actual acquisition date ascending (FIFO),
   - deterministic tie-break key by fragment creation order.
4. Match share-by-share (or batched deterministic chunking) until:
   - either loss shares are fully matched, or
   - no eligible replacement shares remain.
   - if replacement shares are insufficient across same-day multi-lot losses, allocate disallowed loss to earlier-ordered loss portions first (with same-day ordering by original acquisition date), and leave remaining later-ordered portions as allowed loss.
5. For each match chunk:
   - `disallowedLossPerShare = basisPerShareAtSale - salePricePerShare`,
   - `disallowedLossTotal = disallowedLossPerShare * matchedShares`,
   - compute holding period carryover days from sold portion.
6. Mark unmatched loss shares as allowed losses.
7. Emit `REPLACEMENT_MATCHED` audit entries.

### Phase E - Apply Basis and Acquisition Date Adjustments

For each `ReplacementMatch` in match order:

1. Split replacement fragment if needed so only matched shares receive adjustment.
2. Increase `basisPerShareAdjusted` for matched fragment by `disallowedLossPerShare`.
3. Adjust `acquisitionDateAdjusted`:
   - `replacementPurchaseDateActual - daysHeldBySoldShares`.
4. Append wash adjustment history reference.
5. Emit:
   - `LOT_SPLIT`
   - `BASIS_ADJUSTED`
   - `ACQ_DATE_ADJUSTED`.

### Phase F - Cascade Handling

1. Continue processing sales chronologically with updated fragment states.
2. If a fragment that already absorbed wash loss is later sold at a loss, it naturally re-enters Phases C-D-E as a new loss portion.
3. No special-case recursion is required if timeline processing uses current adjusted basis at each sale.

### Phase G - Build Outputs

1. Build IRS-ready `Form8949Data`:
   - split into short-term and long-term row sets,
   - use adjusted acquisition date and wash adjustment fields,
   - apply final currency rounding to cents for reportable outputs.
2. Build remaining positions from open fragments.
3. Build summary totals:
   - realized gain/loss ST/LT
   - total disallowed losses
   - deferred losses in remaining holdings.
4. Run reconciliation classification if brokerage comparison data provided.
5. Emit final warnings and return frozen `CalculationResult`.

---

## 8) Error Handling and Warnings

- **Validation errors (throw / fail-fast):**
  - invalid dates/numbers,
  - negative share counts,
  - SELL with insufficient shares,
  - missing required sell lot fields,
  - lot identification failure (cannot map a SELL to a valid source lot set).
- **Warnings (non-fatal):**
  - ambiguous lot identification fallback was used,
  - reconciliation delta exists.

### 8.1 Lot Identification Failure Conditions

Lot identification fails when any of the following is true:

1. A SELL row omits required lot identity fields in a context where broker default cannot be inferred.
2. Referenced source lot does not exist in the current timeline for the ticker.
3. Referenced source lot exists but has insufficient remaining shares.
4. No candidate lots remain after applying provided constraints and broker-default policy.
5. Row ordering/date inconsistencies imply selling shares before they were acquired.

### 8.2 Deterministic Fallback Policy

If SELL lot mapping is incomplete/ambiguous, apply deterministic fallback for reproducibility.

Fallback order in v1:
1. Use provided acquisition date/source constraints when present.
2. If still ambiguous, deplete eligible open lots by FIFO acquisition date.
3. If tied, use stable lot/fragment creation order.
4. Where internal sublot depletion is ambiguous, apply FR-3.6 HIFO policy.

Emit warning + audit entry so assumptions are visible.

Replacement-share matching for wash-sale detection still follows the mandated algorithm (FIFO replacement matching and other ordering rules). The fallback only applies to resolving which lot(s) a SELL disposition came from when input is ambiguous.

### 8.3 Accounting Rounding Policy

- Use high-precision decimal arithmetic internally (no binary float math).
- Keep intermediate calculations unrounded whenever possible.
- Round reportable monetary values to cents (USD) at reporting boundaries:
  - Form 8949 proceeds,
  - Form 8949 cost basis,
  - Form 8949 adjustment amount,
  - Form 8949 gain/loss,
  - summary totals.
- Rounding mode: **half-up** (nearest cent, 0.5 rounds away from zero), applied consistently.

---

## 9) Test-Driven Development Plan (Jest)

### 9.1 Test Layers

1. **API contract tests**
   - Builder fluency, immutability guarantees, readonly output.
2. **Algorithm unit tests**
   - loss detection, replacement allocation, basis/date carryover, lot splits.
3. **Acceptance scenario tests**
   - PRD AC-1 through AC-11 as golden tests.
4. **Determinism tests**
   - repeated runs produce byte-identical output JSON.
5. **Property-style invariants**
   - share conservation across splits/sales,
   - disallowed-loss conservation checks.

### 9.2 Suggested Test Naming

- `calculate.simple-wash-sale.spec.ts`
- `calculate.partial-wash-sale.spec.ts`
- `calculate.cross-brokerage.spec.ts`
- `calculate.sell-to-cover-30-vs-31-day.spec.ts`
- `calculate.sell-to-cover-isolated-no-self-trigger.spec.ts`
- `calculate.multi-lot-same-day-ordering.spec.ts`
- `calculate.hifo-sublot-depletion.spec.ts`
- `builder.immutability.spec.ts`

---

## 10) Dependency Injection Design

Core calculator remains pure and receives collaborators via interfaces only when needed.

```ts
export interface IdGenerator {
  next(prefix: string): string;
}

export interface DecimalMath {
  add(a: Decimal, b: Decimal): Decimal;
  sub(a: Decimal, b: Decimal): Decimal;
  mul(a: Decimal, b: Decimal): Decimal;
  div(a: Decimal, b: Decimal): Decimal;
  cmp(a: Decimal, b: Decimal): -1 | 0 | 1;
}

export interface CsvPort {
  parseRows(csvText: string): RowInput[];
  toCsv(result: CalculationResult): string;
}

export interface FileSystemPort {
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
}
```

- Node adapter can implement `FileSystemPort` using `fs/promises`.
- Browser adapter can implement storage with File API/local persistence.
- Tests inject in-memory implementations, avoiding mocks for core behavior.

---

## 11) Technical Decisions (Brief)

1. **Fluent builder API** using `forTicker().addRow().calculate()` for ergonomics.
2. **Immutable outputs and near-immutable internals**; builder row collection is the controlled mutable phase.
3. **Deterministic ordering rules are fixed by PRD in v1** (FIFO replacement matching, HIFO sublot depletion for FR-3.6 ambiguity, same-day ordering by original acquisition date when needed); not exposed as runtime options.
4. **Jest-first TDD** with PRD acceptance tests as executable specs.
5. **Dependency injection ports** for environment-specific concerns, avoiding hard dependency on Node APIs.
6. **Core library pure by default** so same engine can run in Node CLI and webapp.
7. **Decimal arithmetic library internally** (e.g. `decimal.js`) to avoid floating-point precision errors.
8. **Rounding policy:** round reportable monetary outputs to cents (USD) using half-up mode.
9. **Audit log default enabled**; `calculate()` always returns `auditLog` and `form8949Data` plus supporting outputs.
10. **Fee handling simplified:** no fee field in v1 input; SELL `pricePerShare` is provided as net-of-fees.

---

