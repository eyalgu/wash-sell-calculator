import type Decimal from 'decimal.js'

// ---------------------------------------------------------------------------
// Branded string aliases (API boundary uses strings, not rich objects)
// ---------------------------------------------------------------------------

export type Ticker = string
export type IsoDate = string // YYYY-MM-DD
export type DecimalString = string // numeric string to avoid float ambiguity

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type Action = 'BUY' | 'SELL'

export type Source = 'Shareworks' | 'Computershare' | 'Other'

export type TransactionType =
  | 'RSU_VEST'
  | 'SELL_TO_COVER'
  | 'IPO_SALE'
  | 'OPEN_MARKET_SALE'
  | 'ESPP_PURCHASE'
  | 'ESPP_SALE'

export type AuditEventType =
  | 'ROW_NORMALIZED'
  | 'LOT_CREATED'
  | 'LOT_SPLIT'
  | 'SALE_PROCESSED'
  | 'LOSS_DETECTED'
  | 'REPLACEMENT_MATCHED'
  | 'BASIS_ADJUSTED'
  | 'ACQ_DATE_ADJUSTED'
  | 'RECONCILIATION_DELTA'
  | 'WARNING'
  | 'ROWS_CONSOLIDATED'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RowInput {
  date: IsoDate
  action: Action
  source: Source
  shares: DecimalString
  pricePerShare: DecimalString
  transactionType: TransactionType
  acquiredDate: IsoDate
  notes?: string
}

// ---------------------------------------------------------------------------
// Internal canonical row (post-normalization)
// ---------------------------------------------------------------------------

export interface NormalizedRow {
  readonly rowKey: string
  readonly ticker: Ticker
  readonly date: IsoDate
  readonly action: Action
  readonly source: Source
  readonly shares: Decimal
  readonly pricePerShare: Decimal
  readonly transactionType: TransactionType
  readonly acquiredDate: IsoDate
  readonly sortKey: string
}

// ---------------------------------------------------------------------------
// Lot fragment model (supports splitting)
// ---------------------------------------------------------------------------

export interface WashAdjustmentRef {
  readonly matchId: string
  readonly disallowedLossPerShare: Decimal
  readonly fromSaleRowKey: string
  readonly appliedAt: IsoDate
}

export interface LotFragment {
  readonly fragmentId: string
  readonly originRowKey: string
  readonly ticker: Ticker
  readonly source: Source
  sharesOpen: Decimal
  readonly purchaseDateActual: IsoDate
  acquisitionDateAdjusted: IsoDate
  basisPerShareAdjusted: Decimal
  readonly originalBasisPerShare: Decimal
  washAdjustmentHistory: readonly WashAdjustmentRef[]
  consumedAsReplacement: Decimal
}

// ---------------------------------------------------------------------------
// Sale portion and matching records
// ---------------------------------------------------------------------------

export interface SalePortion {
  readonly salePortionId: string
  readonly saleRowKey: string
  readonly soldFromFragmentId: string
  readonly shares: Decimal
  readonly saleDate: IsoDate
  readonly salePricePerShare: Decimal
  readonly proceeds: Decimal
  readonly basisPerShareAtSale: Decimal
  readonly gainLoss: Decimal
  readonly originalAcquiredDateForOrdering: IsoDate
}

export interface ReplacementMatch {
  readonly matchId: string
  readonly salePortionId: string
  readonly replacementFragmentId: string
  readonly matchedShares: Decimal
  readonly disallowedLossPerShare: Decimal
  readonly disallowedLossTotal: Decimal
  readonly holdingPeriodDaysCarried: number
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  readonly eventId: string
  readonly type: AuditEventType
  readonly at: IsoDate
  readonly rowKey?: string
  readonly saleRowKey?: string
  readonly lotFragmentId?: string
  readonly relatedFragmentId?: string
  readonly message: string
  readonly payload: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type Term = 'SHORT' | 'LONG'

export interface Form8949Row {
  readonly description: string
  readonly dateAcquired: IsoDate
  readonly dateSold: IsoDate
  readonly proceeds: Decimal
  readonly costBasis: Decimal
  readonly adjustmentCode?: 'W'
  readonly adjustmentAmount?: Decimal
  readonly gainOrLoss: Decimal
  readonly term: Term
}

export interface Form8949Data {
  readonly shortTermRows: readonly Form8949Row[]
  readonly longTermRows: readonly Form8949Row[]
  readonly exportNotes: readonly string[]
}

export interface RemainingPosition {
  readonly fragmentId: string
  readonly ticker: Ticker
  readonly source: Source
  readonly sharesOpen: Decimal
  readonly purchaseDateActual: IsoDate
  readonly acquisitionDateAdjusted: IsoDate
  readonly originalBasisPerShare: Decimal
  readonly basisPerShareAdjusted: Decimal
  readonly washAdjustmentHistory: readonly WashAdjustmentRef[]
}

export interface SummaryTotals {
  readonly realizedGainLossShortTerm: Decimal
  readonly realizedGainLossLongTerm: Decimal
  readonly totalDisallowedLosses: Decimal
  readonly deferredLossesInRemainingHoldings: Decimal
  readonly totalAllowedLosses: Decimal
}

export type ReconciliationClassification = 'Expected (allocation-ambiguity)' | 'Unexpected'

export interface ReconciliationEntry {
  readonly saleRowKey: string
  readonly computedBasis: Decimal
  readonly brokerReportedBasis: Decimal
  readonly delta: Decimal
  readonly fr36Applied: boolean
  readonly sublotDepletionOrder: readonly string[]
  readonly classification: ReconciliationClassification
}

export interface ReconciliationReport {
  readonly entries: readonly ReconciliationEntry[]
  readonly totalDelta: Decimal
}

export interface CalculationWarning {
  readonly code: string
  readonly message: string
  readonly rowKey?: string
  readonly fragmentId?: string
}

// ---------------------------------------------------------------------------
// Top-level result
// ---------------------------------------------------------------------------

export interface CalculationResult {
  readonly ticker: Ticker
  readonly normalizedRows: readonly NormalizedRow[]
  readonly form8949Data: Form8949Data
  readonly remainingPositions: readonly RemainingPosition[]
  readonly summary: SummaryTotals
  readonly auditLog: readonly AuditLogEntry[]
  readonly reconciliation?: ReconciliationReport
  readonly warnings: readonly CalculationWarning[]
}

// ---------------------------------------------------------------------------
// Builder and calculator interfaces
// ---------------------------------------------------------------------------

export interface CalculatorBuilder {
  addRow(row: RowInput): CalculatorBuilder
  addRows(rows: readonly RowInput[]): CalculatorBuilder
  calculate(): CalculationResult
}

// ---------------------------------------------------------------------------
// Dependency injection interfaces
// ---------------------------------------------------------------------------

export interface IdGenerator {
  next(prefix: string): string
}

export interface CsvPort {
  parseRows(csvText: string): RowInput[]
  toCsv(result: CalculationResult): string
}

export interface FileSystemPort {
  readText(path: string): Promise<string>
  writeText(path: string, content: string): Promise<void>
}
