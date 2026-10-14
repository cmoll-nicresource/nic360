import Link from 'next/link'
import React from 'react'

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.03-1.85-3.03-1.86 0-2.14 1.45-2.14 2.94v5.66H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  )
}

/** Shared footer for every front-end page. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Nicotine360" />
          <p className="site-footer-org">A publication of the Nicotine Resource Consortium</p>
          <p className="muted">
            Industry news and intelligence for the nicotine and tobacco trade, published by a
            501(c)(6) trade organization.
          </p>
          {/* TODO: swap in the organization's real LinkedIn company page URL. */}
          <a
            href="https://www.linkedin.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Nicotine Resource Consortium on LinkedIn"
            style={{ display: 'inline-flex', marginTop: 8, color: 'rgba(255,255,255,0.7)' }}
          >
            <LinkedInIcon />
          </a>
        </div>
        <div className="site-footer-links">
          <div>
            <h4>Tracking</h4>
            <Link href="/articles">News</Link>
            <Link href="/bills">Legislation</Link>
            <Link href="/trademarks">Trademarks</Link>
          </div>
          <div>
            <h4>Content</h4>
            <Link href="/datasets">Data</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/publications">Publications</Link>
          </div>
          <div>
            <h4>Organization</h4>
            <Link href="/events">Events</Link>
            <a href="mailto:membership@nicotine360.org">Contact us</a>
            <Link href="/signup">Sign up</Link>
          </div>
          <div>
            <h4>Contact</h4>
            <a href="mailto:membership@nicotine360.org">membership@nicotine360.org</a>
            <a href="tel:+19199177449">(919) 917-7449</a>
            <span className="muted">Raleigh, North Carolina</span>
          </div>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span className="muted">
          © {new Date().getFullYear()} Nicotine Resource Consortium. All rights reserved.
        </span>
        <div className="site-footer-legal">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of use</Link>
        </div>
      </div>
    </footer>
  )
}
