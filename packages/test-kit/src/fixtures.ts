import type { RowInput, Action, Source } from '@wash-sale/core'

const DEFAULT_SOURCE: Source = 'Shareworks'

function applyOverrides<T extends RowInput>(base: T, overrides?: Partial<RowInput>): RowInput {
  return overrides ? { ...base, ...overrides } : base
}

/**
 * Creates a RSU_VEST BUY RowInput with sensible defaults.
 */
export function makeVest(overrides?: Partial<RowInput>): RowInput {
  return applyOverrides(
    {
      date: '2025-01-15',
      action: 'BUY' as Action,
      source: DEFAULT_SOURCE,
      shares: '100',
      pricePerShare: '20',
      transactionType: 'RSU_VEST',
      acquiredDate: '2025-01-15',
    },
    overrides,
  )
}

/**
 * Creates a SELL_TO_COVER SELL RowInput with sensible defaults.
 */
export function makeSellToCover(overrides?: Partial<RowInput>): RowInput {
  return applyOverrides(
    {
      date: '2025-01-15',
      action: 'SELL' as Action,
      source: DEFAULT_SOURCE,
      shares: '20',
      pricePerShare: '15',
      transactionType: 'SELL_TO_COVER',
      acquiredDate: '2025-01-15',
    },
    overrides,
  )
}

/**
 * Creates an IPO_SALE SELL RowInput with sensible defaults.
 */
export function makeIpoSale(overrides?: Partial<RowInput>): RowInput {
  return applyOverrides(
    {
      date: '2025-10-01',
      action: 'SELL' as Action,
      source: 'Computershare',
      shares: '100',
      pricePerShare: '18',
      transactionType: 'IPO_SALE',
      acquiredDate: '2025-09-15',
    },
    overrides,
  )
}

/**
 * Creates a generic BUY RowInput with sensible defaults.
 */
export function makeBuy(overrides?: Partial<RowInput>): RowInput {
  return applyOverrides(
    {
      date: '2025-01-15',
      action: 'BUY' as Action,
      source: DEFAULT_SOURCE,
      shares: '100',
      pricePerShare: '10',
      transactionType: 'RSU_VEST',
      acquiredDate: '2025-01-15',
    },
    overrides,
  )
}

/**
 * Creates a generic SELL RowInput with sensible defaults.
 */
export function makeSell(overrides?: Partial<RowInput>): RowInput {
  return applyOverrides(
    {
      date: '2025-02-10',
      action: 'SELL' as Action,
      source: DEFAULT_SOURCE,
      shares: '100',
      pricePerShare: '8',
      transactionType: 'OPEN_MARKET_SALE',
      acquiredDate: '2025-01-15',
    },
    overrides,
  )
}
