import { beforeEach, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { CLIPPER_ORIGIN, CLIPPER_REDIRECT, RESEARCH_CLIPPER_ORIGIN, RESEARCH_CLIPPER_REDIRECT } from '@/config/extension'
const m = vi.hoisted(() => ({ query: vi.fn(), findByID: vi.fn() }))
vi.mock('@/lib/ttb/db', () => ({ withTransaction: async (_: unknown, fn: (c: unknown) => unknown) => fn(m) }))
import { authenticateClipper, exchangeClipperCode, hashClipperSecret, pkceChallenge, validConnectRequest } from './clipperAuth'
const payload = { db: { pool: m }, findByID: m.findByID } as unknown as Payload
const verifier = 'v'.repeat(43)
const input = { code: 'c'.repeat(43), code_verifier: verifier, redirect_uri: CLIPPER_REDIRECT }
const staff = { label: 'Chrome News Clipper', id: 'synthetic-id', staff_id: 1, hash: 'password-hash', salt: 'salt', role: 'editor',
  credential_version: hashClipperSecret('password-hash:salt'), challenge: pkceChallenge(verifier), redirect_uri: CLIPPER_REDIRECT }
beforeEach(() => { vi.resetAllMocks(); m.findByID.mockResolvedValue({ id: 1, role: 'editor' }) })
it('accepts only the exact packaged callback and valid state/PKCE', () => {
  const request = { redirect_uri: CLIPPER_REDIRECT, state: 's'.repeat(43), code_challenge: pkceChallenge(verifier) }
  expect(validConnectRequest(request)).toBe(true)
  for (const redirect_uri of [CLIPPER_REDIRECT + '?bad=1', CLIPPER_REDIRECT + '/other', 'https://evil.example/connect', null])
    expect(validConnectRequest({ ...request, redirect_uri })).toBe(false)
  expect(validConnectRequest({ ...request, state: 'short' })).toBe(false)
})
it('uses the standard S256 PKCE vector', () => {
  expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
})
it('stores only hashed opaque tokens and spends the locked single-use code', async () => {
  m.query.mockResolvedValueOnce({ rows: [staff] }).mockResolvedValue({ rows: [] })
  const result = await exchangeClipperCode(payload, input)
  expect(result?.token).toMatch(/^nic360_clip_[A-Za-z0-9_-]{43}$/)
  expect(result!.exp - Math.floor(Date.now()/1000)).toBeCloseTo(43200, -1)
  expect(m.query.mock.calls[0][0]).toContain('FOR UPDATE OF c')
  expect(m.query.mock.calls[1][0]).toContain('used_at=now()')
  expect(m.query.mock.calls[2][1][2]).toBe(hashClipperSecret(result!.token))
  expect(JSON.stringify(m.query.mock.calls)).not.toContain(result!.token)
})
it.each([
  { challenge: pkceChallenge('wrong'.repeat(10)) }, { credential_version: 'old-password' },
  { role: 'user' }, { lock_until: '2999-01-01' }, { redirect_uri: 'https://evil.example' },
])('rejects mismatched or invalidated codes without spending them: %j', async changes => {
  m.query.mockResolvedValue({ rows: [{ ...staff, ...changes }] })
  expect(await exchangeClipperCode(payload, input)).toBeNull()
  expect(m.query).toHaveBeenCalledTimes(1)
})
it('rejects expired/used/missing codes and malformed inputs', async () => {
  m.query.mockResolvedValue({ rows: [] })
  expect(await exchangeClipperCode(payload, input)).toBeNull()
  expect(await exchangeClipperCode(payload, { ...input, code_verifier: 'short' })).toBeNull()
  expect(m.query).toHaveBeenCalledTimes(1)
  expect(m.query.mock.calls[0][0]).toContain('c.used_at IS NULL AND c.expires_at > now()')
})
const request = (authorization: string, origin = CLIPPER_ORIGIN) => new Request('https://site.example', { headers: { authorization, origin } })
it('never accepts website JWTs, cookies or foreign origins as clipper credentials', async () => {
  for (const auth of ['', 'JWT full-staff-token', 'Bearer JWT-like-token'])
    expect(await authenticateClipper(payload, request(auth))).toBeNull()
  expect(await authenticateClipper(payload, request('Bearer nic360_clip_' + 't'.repeat(43), 'chrome-extension://other'))).toBeNull()
  expect(m.query).not.toHaveBeenCalled()
})
it.each([{ credential_version: 'old' }, { lock_until: '2999-01-01' }, { role: 'invalid' }])('invalidates credentials on account changes: %j', async changes => {
  m.query.mockResolvedValue({ rows: [{ ...staff, ...changes }] })
  expect(await authenticateClipper(payload, request('Bearer nic360_clip_' + 't'.repeat(43)))).toBeNull()
  expect(m.findByID).not.toHaveBeenCalled()
})
it('checks revocation again before returning a staff identity', async () => {
  m.query.mockResolvedValueOnce({ rows: [staff] }).mockResolvedValueOnce({ rowCount: 0 })
  expect(await authenticateClipper(payload, request('Bearer nic360_clip_' + 't'.repeat(43)))).toBeNull()
  expect(m.findByID).not.toHaveBeenCalled()
})

it('accepts the separate Research Clipper callback but keeps token scope bound to the registered client', async () => {
  expect(validConnectRequest({ redirect_uri: RESEARCH_CLIPPER_REDIRECT, state: 's'.repeat(43), code_challenge: pkceChallenge(verifier) })).toBe(true)
  m.query.mockResolvedValue({ rows: [{ ...staff, label: 'Chrome News Clipper' }] })
  expect(await authenticateClipper(payload, request('Bearer nic360_clip_' + 't'.repeat(43), RESEARCH_CLIPPER_ORIGIN), 'research')).toBeNull()
  expect(await authenticateClipper(payload, request('Bearer nic360_clip_' + 't'.repeat(43), RESEARCH_CLIPPER_ORIGIN))).toBeNull()
  m.query.mockResolvedValueOnce({ rows: [{ ...staff, label: 'Chrome Research Clipper' }] }).mockResolvedValueOnce({ rowCount: 1 })
  expect(await authenticateClipper(payload, request('Bearer nic360_clip_' + 't'.repeat(43), RESEARCH_CLIPPER_ORIGIN), 'research')).toMatchObject({ role: 'editor', collection: 'staff' })
})
