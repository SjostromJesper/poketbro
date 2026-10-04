import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

// Only the headless Nudge engine/data/game tests (plus the Pinia stores, which have no DOM dependency) run here.
export default defineConfig({
  resolve: {
    alias: {
      '~~': root,
      '~': `${root}app`,
    },
  },
  test: {
    include: ['nudge/tests/**/*.test.ts'],
    environment: 'node',
  },
})
