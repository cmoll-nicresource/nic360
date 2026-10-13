import React from 'react'

/** Replaces Payload's default wordmark on the login screen (admin.components.graphics.Logo). */
export function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Nicotine360" style={{ maxWidth: 220, width: '100%', height: 'auto' }} />
  )
}
