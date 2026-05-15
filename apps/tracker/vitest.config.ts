import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./src/emulator.global-setup.ts'],
    passWithNoTests: true,
    setupFiles: ['./src/vitest.setup.ts'],
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/vitest.setup.ts', 'src/emulator.global-setup.ts'],
    },
  },
})
