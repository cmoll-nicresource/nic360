import { spawn } from 'node:child_process'
import { testEnvironment } from './environment'
const mode = process.argv[2]
const args =
  mode === 'build'
    ? ['node_modules/next/dist/bin/next', 'build']
    : mode === 'start'
      ? ['node_modules/next/dist/bin/next', 'start', '--port', '3100']
      : ['--import', 'tsx', 'tests/support/seed.ts', ...process.argv.slice(3)]
const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: {
    ...testEnvironment(),
    ...(mode !== 'start' ? { E2E_SMTP_URL: '', E2E_SEEDING: '1' } : {}),
    NODE_ENV: mode === 'seed' ? 'development' : 'production',
    NODE_OPTIONS: '--max-old-space-size=8000',
  },
})
child.on('exit', (code) => process.exit(code ?? 1))
process.on('SIGTERM', () => child.kill('SIGTERM'))
process.on('SIGINT', () => child.kill('SIGINT'))
