import { parseRows } from './csv-parser'
import { toCsv } from './csv-serializer'
import type { CsvPort } from '@wash-sale/core'

export { parseRows } from './csv-parser'
export { toCsv } from './csv-serializer'
export { nodeFileSystem } from './fs-node'
export {
  formatResultTable,
  formatAuditCsv,
  formatPositionsCsv,
  escapeCsvValue,
  padRight,
} from './formatters'
export type { FormatOptions } from './formatters'

export const csvAdapter: CsvPort = { parseRows, toCsv }
export type { CsvPort, FileSystemPort } from '@wash-sale/core'
