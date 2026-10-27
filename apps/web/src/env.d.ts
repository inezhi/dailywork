interface Window {
  dailywork?: {
    platform: string
    revealDataDir: () => Promise<string>
    restart: () => Promise<void>
    version: () => Promise<string>
    dataDir: () => Promise<string>
    pickBackup: () => Promise<string | null>
  }
}
