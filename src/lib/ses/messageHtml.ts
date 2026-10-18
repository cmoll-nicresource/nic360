/** Shared final newsletter footer. Preview supplies inert links, never a user token. */
export function newsletterMessageHtml(
  html: string,
  unsubscribe: string,
  account: string,
  test = false,
) {
  const footer = `<div style="padding:24px;text-align:center;font:12px Arial;color:#526174">${test ? 'Test message; unsubscribe does not change user preferences. ' : ''}<a href="${unsubscribe}">Unsubscribe from publication emails</a> · <a href="${account}">Manage preferences</a></div>`
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : html + footer
}
