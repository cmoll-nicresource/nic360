import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Payload generates these from the config; exercising that requires a
    // real DB and is out of scope for these fast, dependency-free unit tests.
    exclude: ['node_modules', '.next'],
  },
})
