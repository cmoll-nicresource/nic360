import Link from 'next/link'
import React from 'react'

/** Shared footer for every front-end page. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Nicotine360" />
          <p className="muted">
            Industry news and intelligence for the nicotine and tobacco trade, published by a
            501(c)(6) trade organization.
          </p>
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
      </div>
    </footer>
  )
}
