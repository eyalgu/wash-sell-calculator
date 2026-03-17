import type { IdGenerator } from './types'

export class SequentialIdGenerator implements IdGenerator {
  private counters = new Map<string, number>()

  next(prefix: string): string {
    const current = this.counters.get(prefix) ?? 0
    const nextVal = current + 1
    this.counters.set(prefix, nextVal)
    return `${prefix}_${String(nextVal).padStart(3, '0')}`
  }
}
