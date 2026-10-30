interface Window {
  dailywork?: {
    platform: string
    remote: boolean
    revealDataDir: () => Promise<string>
    restart: () => Promise<void>
    version: () => Promise<string>
    dataDir: () => Promise<string>
    serverUrl: () => Promise<string>
    pickBackup: () => Promise<string | null>
    connection: {
      get: () => Promise<string>
      test: (url: string) => Promise<{ ok: boolean; url?: string; version?: string; error?: string }>
      save: (url: string) => Promise<{ ok: boolean; url?: string; version?: string; error?: string }>
      open: () => Promise<void>
    }
  }
}
