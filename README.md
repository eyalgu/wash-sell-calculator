# Wash Sale Calculator

**[Try the calculator](https://eyalgu.github.io/wash-sell-calculator/)**

A TypeScript library that computes IRS wash sale adjustments for a single stock ticker, producing Form 8949-ready output with full audit trails.

Built for employees filing 2025 U.S. taxes with RSU, sell-to-cover, and IPO transactions across multiple brokerages.

## Packages

| Package | Description |
|---------|-------------|
| `@wash-sale/core` | Pure calculation engine — no I/O dependencies |
| `@wash-sale/adapters` | CSV parser/serializer and Node.js filesystem adapter |
| `@wash-sale/cli` | Command-line interface |
| `@wash-sale/web` | Browser-based calculator UI ([live](https://eyalgu.github.io/wash-sell-calculator/)) |
| `@wash-sale/test-kit` | Reusable test fixtures and data builders |

## CLI Usage

From the workspace root (`wash-sale-calculator/`):

```bash
# Print a summary table to stdout
pnpm --filter @wash-sale/cli start -- calculate -i transactions.csv -t FIG

# Print as CSV instead of table
pnpm --filter @wash-sale/cli start -- calculate -i transactions.csv -t FIG -f csv

# Include the full audit log at the bottom
pnpm --filter @wash-sale/cli start -- calculate -i transactions.csv -t FIG --print-audit-log

# Write Form 8949 CSV, audit log, and remaining positions to files
pnpm --filter @wash-sale/cli start -- calculate \
  -i transactions.csv \
  -t FIG \
  -o form8949.csv \
  -a audit.csv \
  -p positions.csv
```

### Options

| Flag | Alias | Required | Description |
|------|-------|----------|-------------|
| `--input` | `-i` | Yes | Path to input CSV file |
| `--ticker` | `-t` | Yes | Stock ticker symbol (e.g. `FIG`) |
| `--print-audit-log` | | No | Include audit log in stdout table output |
| `--output` | `-o` | No | Write Form 8949 CSV to this path |
| `--audit-file` | `-a` | No | Write audit log CSV to this path |
| `--positions` | `-p` | No | Write remaining positions CSV to this path |
| `--format` | `-f` | No | Stdout format: `table` (default) or `csv` |

When no file flags (`-o`, `-a`, `-p`) are provided, the result prints to stdout. When any file flag is provided, the corresponding file is written and stdout is suppressed.

### Example

Given a file `ac1.csv`:

```csv
date,action,source,shares,pricePerShare,transactionType,acquiredDate
2025-01-15,BUY,Shareworks,100,10,RSU_VEST,2025-01-15
2025-02-10,SELL,Shareworks,100,8,OPEN_MARKET_SALE,2025-01-15
2025-02-20,BUY,Shareworks,100,9,RSU_VEST,2025-02-20
```

```bash
pnpm --filter @wash-sale/cli start -- calculate -i ac1.csv -t FIG
```

This prints a summary table showing the $200 wash sale: $200 disallowed loss rolled into the Feb 20 replacement lot (adjusted basis $11/share).

## Quick Start (Programmatic)

```ts
import { AdjustedCostBasisCalculator } from "@wash-sale/core";

const result = AdjustedCostBasisCalculator
  .forTicker("FIG")
  .addRow({
    date: "2025-07-31",
    action: "BUY",
    source: "Computershare",
    shares: "500",
    pricePerShare: "33",
    transactionType: "RSU_VEST",
    acquiredDate: "2025-07-31",
  })
  .addRow({
    date: "2025-07-31",
    action: "SELL",
    source: "Computershare",
    shares: "500",
    pricePerShare: "30",
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
    acquiredDate: "2025-08-01",
  })
  .calculate();

console.log(result.summary.totalDisallowedLosses.toString()); // "600"
console.log(result.summary.totalAllowedLosses.toString());     // "900"
console.log(result.remainingPositions[0].basisPerShareAdjusted.toString()); // "118"
```

## Input Format

Each row represents one lot per transaction. If multiple lots are sold on the same day, enter each as a separate row.

```ts
interface RowInput {
  date: string;            // YYYY-MM-DD
  action: "BUY" | "SELL";
  source: "Shareworks" | "Computershare" | "Other";
  shares: string;          // decimal string, e.g. "100" or "42.5"
  pricePerShare: string;   // for SELL: net price after fees
  transactionType: "RSU_VEST" | "SELL_TO_COVER" | "IPO_SALE"
                 | "OPEN_MARKET_SALE" | "ESPP_PURCHASE" | "ESPP_SALE";
  acquiredDate: string;    // original vest/purchase date of the lot
  notes?: string;
}
```

**Key input rules:**

- `shares` and `pricePerShare` are strings to avoid floating-point issues. The library uses `decimal.js` internally.
- For `SELL` rows, `pricePerShare` is the **net sale price after fees/commissions**.
- `acquiredDate` on `SELL` rows identifies which lot the shares came from. On `BUY` rows, typically equals `date`.
- `transactionType` enables sell-to-cover self-trigger exclusion logic (FR-2.5) and enriches output.

## Output

`calculate()` returns a frozen `CalculationResult`:

```ts
interface CalculationResult {
  ticker: string;
  normalizedRows: NormalizedRow[];     // validated/sorted input
  form8949Data: Form8949Data;          // IRS Form 8949 rows (short-term + long-term)
  remainingPositions: RemainingPosition[]; // open lots with adjusted basis
  summary: SummaryTotals;              // aggregate gains, losses, disallowed amounts
  auditLog: AuditLogEntry[];           // step-by-step trace of every adjustment
  warnings: CalculationWarning[];      // non-fatal issues detected
}
```

### Form 8949 Data

```ts
result.form8949Data.shortTermRows  // held < 1 year (based on adjusted acq date)
result.form8949Data.longTermRows   // held >= 1 year
```

Each row contains: `description`, `dateAcquired`, `dateSold`, `proceeds`, `costBasis`, `adjustmentCode` (`"W"` for wash sales), `adjustmentAmount`, `gainOrLoss`, and `term`.

### Summary Totals

```ts
result.summary.realizedGainLossShortTerm   // net short-term gain/loss
result.summary.realizedGainLossLongTerm    // net long-term gain/loss
result.summary.totalDisallowedLosses       // total wash sale disallowed losses
result.summary.totalAllowedLosses          // total losses you can deduct
result.summary.deferredLossesInRemainingHoldings // losses rolled into remaining lots
```

### Remaining Positions

Shows your current lots with adjusted basis and acquisition dates:

```ts
for (const pos of result.remainingPositions) {
  console.log(
    `${pos.sharesOpen} shares, basis $${pos.basisPerShareAdjusted}/share, ` +
    `acq date ${pos.acquisitionDateAdjusted} (original: ${pos.purchaseDateActual})`
  );
}
```

### Audit Log

Every calculation step is traced. Filter by event type to inspect specific phases:

```ts
const washMatches = result.auditLog.filter(e => e.type === "REPLACEMENT_MATCHED");
const basisChanges = result.auditLog.filter(e => e.type === "BASIS_ADJUSTED");
```

Event types: `ROW_NORMALIZED`, `LOT_CREATED`, `LOT_SPLIT`, `SALE_PROCESSED`, `LOSS_DETECTED`, `REPLACEMENT_MATCHED`, `BASIS_ADJUSTED`, `ACQ_DATE_ADJUSTED`.

## CSV Import/Export

```ts
import { parseRows, toCsv, nodeFileSystem } from "@wash-sale/adapters";

// Parse CSV into RowInput[]
const csvText = await nodeFileSystem.readText("transactions.csv");
const rows = parseRows(csvText);

// Calculate
const result = AdjustedCostBasisCalculator
  .forTicker("FIG")
  .addRows(rows)
  .calculate();

// Export Form 8949 as CSV
const output = toCsv(result);
await nodeFileSystem.writeText("form8949.csv", output);
```

### CSV Input Format

```csv
date,action,source,shares,pricePerShare,transactionType,acquiredDate,notes
2025-07-31,BUY,Computershare,500,33,RSU_VEST,2025-07-31,IPO shares
2025-07-31,SELL,Computershare,500,30,IPO_SALE,2025-07-31,
2025-08-01,BUY,Shareworks,200,115,RSU_VEST,2025-08-01,
```

Required columns: `date`, `action`, `source`, `shares`, `pricePerShare`, `transactionType`, `acquiredDate`. Optional: `notes`. Headers are case-insensitive.

## Algorithm Overview

The calculator processes transactions in seven phases:

1. **Phase A** — Validate, normalize, and sort input chronologically
2. **Phase B** — Build lot ledger: BUYs create lot fragments, SELLs resolve to lots (FIFO/HIFO)
3. **Phase C** — Identify loss sale portions (no averaging across lots)
4. **Phase D** — Match replacement shares within the 61-day wash window (FIFO, with single-matching guard and sell-to-cover self-exclusion)
5. **Phase E** — Adjust basis and acquisition dates on matched replacement fragments
6. **Phase F** — Cascades happen naturally via chronological processing with updated basis
7. **Phase G** — Build Form 8949 rows, summary totals, remaining positions, and warnings

Sells are processed date-by-date. For each sell date, phases C-D-E run before moving to the next date, so cascading wash sales resolve correctly.

## Deploying the Web Calculator

```bash
pnpm deploy-web
```

This builds `@wash-sale/web` and copies the output to `docs/`, which is served by GitHub Pages.

## Running Tests

From the workspace root (`wash-sale-calculator/`):

```bash
# Run the full test suite (all 3 packages)
pnpm exec jest

# Run tests for a specific package
pnpm exec jest --testPathPattern=core
pnpm exec jest --testPathPattern=adapters

# Run a specific test file
pnpm exec jest --testPathPattern=cascade
pnpm exec jest --testPathPattern=golden

# Run tests in watch mode
pnpm exec jest --watch

# Update golden snapshots after intentional output changes
pnpm exec jest --updateSnapshot

# Type-check all packages
pnpm run typecheck
```

### Test Structure

```
packages/core/test/
  phases/                          # Unit tests per algorithm phase
    a-normalize.spec.ts
    b-lot-ledger.spec.ts
    c-loss-detection.spec.ts
    d-replacement-match.spec.ts
    e-basis-adjust.spec.ts
    g-output.spec.ts
  calculate.*.spec.ts              # Integration tests (AC-1 through AC-11)
  golden.spec.ts                   # Golden snapshot regression tests
  determinism.spec.ts              # Byte-identical output verification
  invariants.spec.ts               # Share/loss conservation checks
  builder.immutability.spec.ts     # API contract tests

packages/adapters/test/
  csv.spec.ts                      # CSV parsing, serialization, round-trip

packages/test-kit/test/
  fixtures.spec.ts                 # Test data builder verification
```

### Test Coverage by Acceptance Criteria

| AC | Scenario | Integration Test |
|----|----------|-----------------|
| AC-1 | Simple wash sale (full match) | `calculate.simple-wash-sale.spec.ts` |
| AC-2 | Partial wash sale | `calculate.partial-wash-sale.spec.ts` |
| AC-3 | MS PDF example (79/82 split) | Phase D unit test + golden |
| AC-4 | Sell-to-cover 30-day trigger | `calculate.sell-to-cover-30-vs-31-day.spec.ts` |
| AC-5 | Sell-to-cover 31-day non-trigger | `calculate.sell-to-cover-30-vs-31-day.spec.ts` |
| AC-6 | Cross-brokerage (Computershare + Shareworks) | `calculate.cross-brokerage.spec.ts` |
| AC-7 | Multi-lot November pattern + cascade | `calculate.cascade.spec.ts` |
| AC-8 | HIFO sublot depletion | `calculate.hifo-sublot-depletion.spec.ts` |
| AC-9 | Single-matching guard | `calculate.single-matching-guard.spec.ts` |
| AC-10 | Partial replacement split | `calculate.partial-replacement-split.spec.ts` |
| AC-11 | Sell-to-cover self-trigger exclusion | `calculate.sell-to-cover-isolated-no-self-trigger.spec.ts` |

## Disclaimer

This tool is for educational and computational purposes only. It does not constitute tax, legal, or financial advice. Always consult a qualified tax professional for your specific situation.
