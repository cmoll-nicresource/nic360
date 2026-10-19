// The packaged site cannot be changed by a remote page or synced preference.
export const SITE_URL = 'https://beta.nicotine360.org';
const LOCAL_KEYS = ['token', 'tokenExp', 'staffName', 'staffRole', 'connectionId'];
const LEGACY_KEYS = ['apiEndpoint', ...LOCAL_KEYS];
let initialized;
function initialize() {
  return initialized ||= (async () => {
    await chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
    // Never migrate full staff JWTs from the old extension.
    await chrome.storage.sync.remove(LEGACY_KEYS);
  })();
}
export async function getSettings() {
  await initialize();
  return { ...(await chrome.storage.local.get(LOCAL_KEYS)), apiEndpoint: SITE_URL };
}
export async function setSettings(values) {
  await initialize();
  const safe = Object.fromEntries(LOCAL_KEYS.filter(key => key in values).map(key => [key, values[key]]));
  await chrome.storage.local.set(safe);
}
async function clearSettings() { await chrome.storage.local.remove(LOCAL_KEYS); }
export function isSignedIn(settings) {
  return !!settings.token?.startsWith('nic360_clip_') && settings.tokenExp * 1000 > Date.now();
}
export async function signOut() {
  const settings = await getSettings();
  if (isSignedIn(settings)) await apiFetch('/api/extension/disconnect', { method: 'POST' });
  await clearSettings();
}
export async function apiFetch(path, options = {}) {
  const settings = await getSettings();
  if (!isSignedIn(settings)) throw new Error('Connection expired. Open extension options and connect to Nicotine360.');
  let response;
  try {
    response = await fetch(`${SITE_URL}${path}`, { ...options, credentials: 'omit', headers: {
      'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${settings.token}`,
    } });
  } catch { throw new Error('Could not reach Nicotine360. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { await clearSettings(); throw new Error('Connection expired or disconnected. Open extension options to reconnect.'); }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
function randomSecret() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export async function connect() {
  const state = randomSecret(), verifier = randomSecret();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const redirect = chrome.identity.getRedirectURL('connect');
  const url = new URL('/extension/connect', SITE_URL);
  url.search = new URLSearchParams({ state, code_challenge: challenge, redirect_uri: redirect }).toString();
  const returned = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
  if (!returned) throw new Error('Connection cancelled.');
  const callback = new URL(returned), expected = new URL(redirect);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname || callback.hash ||
      callback.searchParams.getAll('state').length !== 1 || callback.searchParams.get('state') !== state ||
      callback.searchParams.getAll('code').length !== 1) throw new Error('Invalid connection response. Please try again.');
  const response = await fetch(`${SITE_URL}/api/extension/token`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: callback.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirect }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Connection failed.');
  await setSettings({ token: data.token, tokenExp: data.exp, connectionId: data.connectionId, staffName: data.user.name, staffRole: data.user.role });
}
export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
