import { afterEach, describe, expect, it, vi } from 'vitest'
import { stateNetITracUrl } from './stateNetITrac'

afterEach(() => vi.unstubAllEnvs())
describe('StateNet embed configuration', () => {
  it('retains the provider query parameters on a configured HTTPS portal URL', () => {
    expect(stateNetITracUrl(' https://portal.example/itrac?portal=123&view=bills '))
      .toBe('https://portal.example/itrac?portal=123&view=bills')
  })
  it.each(['', ' ', '<iframe src="https://portal.example"></iframe>', '/relative',
    'http://portal.example', 'javascript:alert(1)', 'https://user:secret@portal.example'])
  ('rejects missing, insecure or malformed embed settings: %s', value => {
    expect(stateNetITracUrl(value)).toBeNull()
  })
  it('reads the server environment at request time', () => {
    vi.stubEnv('STATENET_ITRAC_URL', 'https://portal.example/itrac')
    expect(stateNetITracUrl()).toBe('https://portal.example/itrac')
    vi.stubEnv('STATENET_ITRAC_URL', '')
    expect(stateNetITracUrl()).toBeNull()
  })
})
