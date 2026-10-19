// Public Chrome identity shared with the packaged extension manifest.
export const CLIPPER_ID = "kcefkjklicckafaelknkgnnjmgnnncpm"
export const CLIPPER_ORIGIN = "chrome-extension://kcefkjklicckafaelknkgnnjmgnnncpm"
export const CLIPPER_REDIRECT = "https://kcefkjklicckafaelknkgnnjmgnnncpm.chromiumapp.org/connect"

export const RESEARCH_CLIPPER_ID = 'lbmeppjclkfpiiaieenckfnphnlhnbge'
export const RESEARCH_CLIPPER_ORIGIN = 'chrome-extension://lbmeppjclkfpiiaieenckfnphnlhnbge'
export const RESEARCH_CLIPPER_REDIRECT = 'https://lbmeppjclkfpiiaieenckfnphnlhnbge.chromiumapp.org/connect'
export const CLIPPER_CLIENTS = [
  // Labels are immutable credential scope identifiers; names are the displayed branding.
  { kind: 'news', origin: CLIPPER_ORIGIN, redirect: CLIPPER_REDIRECT, label: 'Chrome News Clipper', name: 'N360 News Clipper' },
  { kind: 'research', origin: RESEARCH_CLIPPER_ORIGIN, redirect: RESEARCH_CLIPPER_REDIRECT, label: 'Chrome Research Clipper', name: 'N360 Industry Research Clipper' },
] as const

export function clipperDisplayName(label: string) {
  return CLIPPER_CLIENTS.find(client => client.label === label)?.name ?? label
}
