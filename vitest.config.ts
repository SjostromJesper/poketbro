import { defineConfig } from 'vitest/config'

// Only the headless Nudge engine/data/game tests run here; the rest of the app has no unit tests.
export default defineConfig({
  test: {
    include: ['nudge/tests/**/*.test.ts'],
    environment: 'node',
  },
})
