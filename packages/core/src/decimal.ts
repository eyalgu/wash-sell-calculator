import Decimal from 'decimal.js'

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
})

export { Decimal }

export function d(value: string | number | Decimal): Decimal {
  return new Decimal(value)
}

export function roundCents(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

export function isNegative(value: Decimal): boolean {
  return value.isNegative() && !value.isZero()
}

export function isPositive(value: Decimal): boolean {
  return value.isPositive() && !value.isZero()
}

export const ZERO = new Decimal(0)
