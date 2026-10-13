import React from 'react'

/**
 * Replaces Payload's default icon mark — collapsed nav, mobile nav,
 * breadcrumb home link (admin.components.graphics.Icon). Payload's own
 * icon is an SVG sized `width="100%" height="100%"`, filling whatever box
 * its container defines (e.g. the breadcrumb's `.step-nav__home` is a fixed
 * 18x18px with `overflow: hidden`) — matching that here instead of a fixed
 * pixel size is what keeps this from overflowing/getting clipped in that
 * and every other context Payload places it in.
 */
export function Icon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.png"
      alt="Nicotine360"
      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
    />
  )
}
