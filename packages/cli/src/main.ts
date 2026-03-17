#!/usr/bin/env node
import yargs from 'yargs'
import { calculateCommand } from './commands/calculate'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const parser = yargs.scriptName('wash-sale')
  calculateCommand(parser)
  await parser
    .demandCommand(1, 'Please provide a command.')
    .strict()
    .wrap(Math.min(120, yargs.terminalWidth()))
    .parseAsync(args)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
