export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly rowIndex?: number,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class LotIdentificationError extends Error {
  constructor(
    message: string,
    public readonly saleRowKey: string,
  ) {
    super(message)
    this.name = 'LotIdentificationError'
  }
}

export class InsufficientSharesError extends Error {
  constructor(
    message: string,
    public readonly saleRowKey: string,
    public readonly requestedShares: string,
    public readonly availableShares: string,
  ) {
    super(message)
    this.name = 'InsufficientSharesError'
  }
}
