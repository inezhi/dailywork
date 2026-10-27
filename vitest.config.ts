import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@daily/contracts': r('./packages/contracts/src/index.ts'),
      '@daily/platform': r('./packages/platform/src/index.ts'),
      '@daily/ops': r('./packages/ops/src/index.ts'),
      '@daily/context-workspace': r('./packages/contexts/workspace/src/index.ts'),
      '@daily/context-tasking': r('./packages/contexts/tasking/src/index.ts'),
      '@daily/context-projects': r('./packages/contexts/projects/src/index.ts'),
      '@daily/context-capture': r('./packages/contexts/capture/src/index.ts'),
      '@daily/context-planning': r('./packages/contexts/planning/src/index.ts'),
      '@daily/context-focus': r('./packages/contexts/focus/src/index.ts'),
      '@daily/context-documents': r('./packages/contexts/documents/src/index.ts'),
      '@daily/context-assistant': r('./packages/contexts/assistant/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/server/src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
})
