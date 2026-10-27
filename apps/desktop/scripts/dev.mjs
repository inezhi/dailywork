import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
await import('./build.mjs')
const electron = join(root, '..', '..', 'node_modules', '.bin', 'electron')
const child = spawn(electron, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173' },
})
child.on('exit', (code) => process.exit(code ?? 0))
