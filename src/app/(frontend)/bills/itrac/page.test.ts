import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('@/lib/frontendContext', () => ({ frontendContext: vi.fn() }))
vi.mock('@/components/SiteNav', () => ({ SiteNav: () => null }))
import { frontendContext } from '@/lib/frontendContext'
import StateNetITracPage from './page'

afterEach(() => vi.unstubAllEnvs())
describe('iTrac member page', () => {
  it('never includes the portal URL or an iframe for an ineligible visitor', async () => {
    vi.stubEnv('STATENET_ITRAC_URL', 'https://portal.example/private-portal?key=member-only')
    vi.mocked(frontendContext).mockResolvedValue({ canRead: false } as never)
    const html = renderToStaticMarkup(await StateNetITracPage())
    expect(html).not.toContain('private-portal')
    expect(html).not.toContain('<iframe')
    expect(html).toContain('Sign in with a Base or Premium')
  })
  it('embeds the configured member portal with a title and new-tab fallback', async () => {
    vi.stubEnv('STATENET_ITRAC_URL', 'https://portal.example/itrac?portal=123')
    vi.mocked(frontendContext).mockResolvedValue({ canRead: true } as never)
    const html = renderToStaticMarkup(await StateNetITracPage())
    expect(html).toContain('<iframe src="https://portal.example/itrac?portal=123"')
    expect(html).toContain('title="StateNet iTrac legislative portal"')
    expect(html).toContain('Open portal in a new tab')
  })
  it('shows a useful bill-library fallback when the portal is not configured', async () => {
    vi.stubEnv('STATENET_ITRAC_URL', '')
    vi.mocked(frontendContext).mockResolvedValue({ canRead: true } as never)
    const html = renderToStaticMarkup(await StateNetITracPage())
    expect(html).not.toContain('<iframe')
    expect(html).toContain('Browse the bill library')
  })
})
