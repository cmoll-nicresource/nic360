import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertFresh, shouldAlert } from './health.mjs'

test('freshness rejects missing, malformed, stale and future completion times', () => {
  const now = Date.parse('2026-10-17T12:00:00Z')
  assert.doesNotThrow(() => assertFresh({ completedAt: '2026-10-16T12:00:00Z' }, 30, now))
  for (const completedAt of [undefined, 'invalid', '2026-10-16T05:59:59Z', '2026-10-17T12:06:00Z'])
    assert.throws(() => assertFresh({ completedAt }, 30, now))
})
test('repeat failures notify once daily while a changed failure notifies immediately', () => {
  const now = Date.parse('2026-10-17T12:00:00Z')
  const previous = { signature: 'same', sentAt: '2026-10-16T12:00:01Z' }
  assert.equal(shouldAlert(previous, 'same', now), false)
  assert.equal(shouldAlert(previous, 'changed', now), true)
  assert.equal(shouldAlert(previous, 'same', now + 1000), true)
  assert.equal(shouldAlert(undefined, 'same', now), true)
  assert.equal(shouldAlert({ signature: 'same', sentAt: 'invalid' }, 'same', now), true)
})
