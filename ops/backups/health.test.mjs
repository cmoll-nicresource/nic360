import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertFresh } from './health.mjs'

test('freshness rejects missing, malformed, stale and future completion times', () => {
  const now = Date.parse('2026-10-17T12:00:00Z')
  assert.doesNotThrow(() => assertFresh({ completedAt: '2026-10-16T12:00:00Z' }, 30, now))
  for (const completedAt of [undefined, 'invalid', '2026-10-16T05:59:59Z', '2026-10-17T12:06:00Z'])
    assert.throws(() => assertFresh({ completedAt }, 30, now))
})
