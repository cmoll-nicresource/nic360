import { headers } from 'next/headers'
import Link from 'next/link'
import { after } from 'next/server'
import { frontendContext } from '@/lib/frontendContext'
import { logPageView } from '@/lib/logPageView'
import { LogoutButton } from './LogoutButton'
import { MobileNavToggle } from './frontend/MobileNavToggle'
import { NavDropdown } from './frontend/NavDropdown'

export async function SiteNav() {
  const { payload, user, isStaff, canRead, plan } = await frontendContext()
  const pathname = (await headers()).get('x-pathname') || ''
  if (pathname) after(() => logPageView(payload, pathname, user))
  const isUser = user?.collection === 'users'
  const [datasets, guides, publications, events] = await Promise.all([
    payload.find({
      collection: 'datasets',
      limit: 50,
      sort: 'title',
      depth: 0,
      overrideAccess: false,
    }),
    canRead
      ? payload.find({
          collection: 'guides',
          limit: 20,
          sort: 'title',
          depth: 0,
          user,
          overrideAccess: false,
          where: {
            and: [
              { _status: { equals: 'published' } },
              ...(!isStaff && plan !== 'premium' ? [{ requiresPremium: { equals: false } }] : []),
            ],
          },
        })
      : null,
    canRead
      ? payload.find({
          collection: 'publications',
          limit: 50,
          sort: 'title',
          depth: 0,
          user,
          overrideAccess: false,
        })
      : null,
    payload.find({
      collection: 'events',
      where: {
        and: [
          { _status: { equals: 'published' } },
          { endDate: { greater_than_equal: new Date().toISOString() } },
        ],
      },
      limit: 10,
      sort: 'startsAt',
      depth: 0,
      overrideAccess: false,
    }),
  ])
  const initials = isUser
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : ''
  return (
    <nav className="topnav" aria-label="Main navigation">
      <Link href={isUser ? '/dashboard' : '/'} className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Nicotine360" />
      </Link>
      <MobileNavToggle key={pathname} />
      <div className="nav-links" id="primary-links">
        <Link href="/articles" aria-current={pathname.startsWith('/articles') ? 'page' : undefined}>
          News
        </Link>
        <NavDropdown label="Legislation" active={pathname.startsWith('/bills')}>
          <Link href="/bills">Bill library</Link>
          <Link href="/bills/itrac">StateNet iTrac</Link>
        </NavDropdown>
        <Link href="/trademarks" aria-current={pathname.startsWith('/trademarks') ? 'page' : undefined}>
          Trademarks
        </Link>
        <NavDropdown label="Data" active={pathname.startsWith('/datasets')} wide>
          {['policy', 'markets', 'trade'].map((category) => (
            <div className="nav-dropdown-group" key={category}>
              <h4>{category}</h4>
              {datasets.docs
                .filter((d) => d.category === category)
                .map((d) => (
                  <Link href={`/datasets/${d.slug}`} key={d.id}>
                    {d.title}
                  </Link>
                ))}
            </div>
          ))}
          <div className="edition-nav-all">
            <Link href="/datasets">Explore all data ↗</Link>
          </div>
        </NavDropdown>
        <NavDropdown label="Publications" active={pathname.startsWith('/publications')}>
          {publications?.docs.map((p) => (
            <Link key={p.id} href={`/publications/${p.slug}`}>
              {p.title}
            </Link>
          ))}
          <Link href="/publications">View all publications ↗</Link>
        </NavDropdown>
        <NavDropdown label="Guides" active={pathname.startsWith('/guides')}>
          {guides?.docs.slice(0, 6).map((g) => (
            <Link key={g.id} href={`/guides/${g.slug}`}>{g.title}</Link>
          ))}
          <Link href="/guides">View all guides ↗</Link>
        </NavDropdown>
        <NavDropdown label="Events" active={pathname.startsWith('/events')}>
          {events.docs.map((event) => (
            <Link href={`/events/${event.id}`} key={event.id}>
              {event.name}
            </Link>
          ))}
          <Link href="/events">View all events ↗</Link>
        </NavDropdown>
        <Link
          href="/search"
          className="edition-nav-search"
          aria-current={pathname === '/search' ? 'page' : undefined}
        >
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          Search
        </Link>
      </div>
      <div className="nav-right">
        {isStaff && (
          <>
            <Link href="/admin">Admin</Link>
            <LogoutButton collection="staff" />
          </>
        )}
        {!user && (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn btn-access">
              Get access
            </Link>
          </>
        )}
        {isUser && (
          <NavDropdown label={initials} active={pathname === '/account'}>
            <Link href="/dashboard">Your briefing</Link>
            <Link href="/account">Account & preferences</Link>
            <div className="edition-nav-logout">
              <LogoutButton collection="users" />
            </div>
          </NavDropdown>
        )}
      </div>
    </nav>
  )
}
