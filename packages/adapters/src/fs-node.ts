import { readFile, writeFile } from 'fs/promises'
import type { FileSystemPort } from '@wash-sale/core'

/**
 * Node.js implementation of FileSystemPort using fs/promises.
 */
export const nodeFileSystem: FileSystemPort = {
  async readText(path: string): Promise<string> {
    return readFile(path, 'utf-8')
  },

  async writeText(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf-8')
  },
}
