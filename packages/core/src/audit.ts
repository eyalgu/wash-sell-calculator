import type { AuditEventType, AuditLogEntry, IsoDate, IdGenerator } from './types'

export class AuditLog {
  private readonly entries: AuditLogEntry[] = []

  constructor(private readonly idGen: IdGenerator) {}

  emit(
    type: AuditEventType,
    at: IsoDate,
    message: string,
    opts: {
      rowKey?: string
      saleRowKey?: string
      lotFragmentId?: string
      relatedFragmentId?: string
      payload?: Record<string, unknown>
    } = {},
  ): void {
    this.entries.push({
      eventId: this.idGen.next('audit'),
      type,
      at,
      message,
      rowKey: opts.rowKey,
      saleRowKey: opts.saleRowKey,
      lotFragmentId: opts.lotFragmentId,
      relatedFragmentId: opts.relatedFragmentId,
      payload: opts.payload ?? {},
    })
  }

  getEntries(): readonly AuditLogEntry[] {
    return [...this.entries]
  }
}
