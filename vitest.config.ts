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
    coverage: {
      provider: 'v8',
      include: ['src/access/**/*.ts', 'src/hooks/**/*.ts', 'src/lib/**/*.ts', 'src/app/api/**/route.ts'],
      exclude: ['**/*.test.ts', '**/fixtures/**', '**/syntheticFixture.ts'],
      reporter: ['text-summary', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      // Floors are measured from the complete offline suite, including untested modules.
      thresholds: { statements: 43, branches: 41, functions: 45, lines: 43.9 },
    },
  },
})
