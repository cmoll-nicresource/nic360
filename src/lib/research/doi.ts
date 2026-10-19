/** DOI destinations are normalized, never arbitrary links or executable schemes. */
export function normalizeDoi(value: unknown): string | undefined {
  if (value == null || value === '') return undefined
  if (typeof value !== 'string') throw new Error('Enter a DOI or doi.org link.')
  let doi = value.trim().replace(/^doi:\s*/i, '')
  if (/^https?:/i.test(doi)) {
    const url = new URL(doi)
    if (
      !['doi.org', 'dx.doi.org'].includes(url.hostname.toLowerCase()) ||
      url.username ||
      url.password
    )
      throw new Error('Use a doi.org link.')
    doi = decodeURIComponent(url.pathname.slice(1))
  }
  if (!/^10\.\d{4,9}\/[^\s<>"?#]+$/i.test(doi))
    throw new Error('Enter a valid DOI, such as 10.1234/example.')
  return new URL(`https://doi.org/${doi}`).href
}
