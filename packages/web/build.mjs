import * as esbuild from 'esbuild'
import { copyFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serve = process.argv.includes('--serve')

const buildOptions = {
  entryPoints: [__dirname + '/src/main.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outfile: __dirname + '/dist/bundle.js',
  sourcemap: true,
  target: ['es2022'],
  alias: {
    '@wash-sale/core': resolve(__dirname, '../core/src/index.ts'),
    '@wash-sale/adapters': resolve(__dirname, '../adapters/src/browser.ts'),
  },
}

mkdirSync(__dirname + '/dist', { recursive: true })
copyFileSync(__dirname + '/src/index.html', __dirname + '/dist/index.html')

if (serve) {
  const ctx = await esbuild.context(buildOptions)
  const { host, port } = await ctx.serve({ servedir: __dirname + '/dist' })
  console.log(`Dev server running at http://${host}:${port}`)
} else {
  await esbuild.build(buildOptions)
  console.log('Build complete: dist/bundle.js')
}
