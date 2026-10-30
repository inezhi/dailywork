export interface ParsedArgs {
  positionals: string[]
  flags: Record<string, string | boolean>
  json: boolean
  yes: boolean
  help: boolean
}

export function parseArgv(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}
  let json = false
  let yes = false
  let help = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--yes' || arg === '-y') {
      yes = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      if (eq !== -1) {
        flags[normalizeKey(arg.slice(2, eq))] = arg.slice(eq + 1)
      } else {
        const key = normalizeKey(arg.slice(2))
        const next = argv[i + 1]
        if (next !== undefined && !next.startsWith('-')) {
          flags[key] = next
          i++
        } else {
          flags[key] = true
        }
      }
      continue
    }
    positionals.push(arg)
  }
  return { positionals, flags, json, yes, help }
}

export function normalizeKey(key: string): string {
  return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}
