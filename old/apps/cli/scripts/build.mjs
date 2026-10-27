import { build } from 'esbuild'
import { chmodSync } from 'node:fs'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/index.mjs',
  sourcemap: true,
  external: ['node:sqlite'],
  banner: {
    js: `import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);`,
  },
})
chmodSync('bin/daily', 0o755)
console.log('built dist/index.mjs')
