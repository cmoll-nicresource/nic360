# N360 News Clipper

The standalone Manifest V3 extension lives in `tma-ext/`, a separate Git repository excluded from the website build. Preserve its pre-existing work; do not push to its unrelated upstream. Website deployment does not update an installed extension.

## Connect and upgrade

Version **2.2.0** ships with `https://beta.nicotine360.org` fixed in its code. There is no editable endpoint, email or password form. In options, choose **Connect to Nicotine360**, sign in on the website, and approve the browser's limited access. Connections last 12 hours; reconnect after expiry. All staff can use **Disconnect this browser** in extension options. The `/admin/connected-browsers` page and its sidebar link are admin-only; admins can review and revoke their own connections there. A short connection ID distinguishes browsers; timestamps show connection, expiry and last use.

For the one-time upgrade from 2.1 or older: **sign out of the old extension first**, remove it in `chrome://extensions`, extract the 2.2.0 package to a persistent folder, enable Developer mode, and **Load unpacked** that folder. Its new manifest public key gives it a stable ID across machines and install folders. The new installation cannot clear another extension ID's old synced credentials; signing out before removal clears those. Legacy credentials in this installation's own sync namespace are removed, never migrated. Future updates preserving this key can use Reload. Changing to the live site or a Chrome Web Store identity requires a new reviewed package and corresponding server allowlist update.

Credentials are opaque, scoped to draft clipping, existing location catalog reads and recent clips. They live in `chrome.storage.local`, restricted to trusted extension contexts, rather than Chrome sync. Device storage is not a secure hardware vault: someone controlling that Chrome profile can still access credentials. The server stores only hashes. Website password changes, account deletion/lockout, expiry and revocation invalidate connections. Signing out of the website alone does not revoke an approved clipper connection; use Disconnect. A network failure during Disconnect preserves the credential so revocation can be retried.

## Connection protocol

- `/extension/connect`: website staff sign-in and explicit approval. Callback restricted to `https://kcefkjklicckafaelknkgnnjmgnnncpm.chromiumapp.org/connect`.
- `POST /api/extension/authorize`: normal website staff authentication and same-origin check; issues a two-minute authorization code bound to S256 PKCE and the exact callback. Only the code and caller state enter the callback URL.
- `POST /api/extension/token`: validates PKCE, account state and exact extension origin; atomically spends the single-use code and returns a 12-hour opaque credential. No refresh token or general CMS JWT is issued.
- `POST /api/extension/disconnect`: revokes the calling connection.
- `GET/POST /api/extension/connections`: website-authenticated listing/revocation of the current staff member's own connections; no credentials or hashes returned.
- The old password endpoint `/api/extension/login` returns 410. Existing general staff JWTs no longer authenticate clipper routes.

CORS allows only the packaged extension origin on clipper routes. It supplements authentication, not replaces it: an extension ID/manifest public key is public and is not a secret proof of client identity. PKCE, explicit staff approval, scoped opaque credentials and server-side revocation provide the access boundary. Clipper credentials cannot authenticate against general Payload REST routes.

## Clipping behavior

The popup reads Open Graph/Twitter metadata, Article JSON-LD (including graphs), explicit publication metadata and time elements. A social description is the initial draft excerpt; article text is a fallback. Original description/image URL survive edits in `articles.socialPreview`, protected by the same access rule as full excerpts. Images remain external publisher references, not downloaded by the backend. Missing dates remain blank; invalid dates are rejected rather than replaced by the clipping date.

Editors review the title, excerpt, publication date, image URL and selected existing locations before saving. Explicit article location/geographic metadata supplies suggestions; publisher addresses are ignored. Unknown/ambiguous hints stay manual. Subjects, products, final location review and publishing remain CMS tasks. Protected Chrome pages, paywalls or missing metadata may require manual entry.

`GET /api/extension/locations` paginates the existing catalog with ancestor labels. `POST /api/extension/articles` validates metadata, derives the source domain, strips source tracking parameters and creates only drafts. Signed image query parameters are retained. Duplicate canonical URL lookup includes drafts and leaves existing records unchanged. Concurrent identical imports still lack a database uniqueness constraint.

## Deployment and checks

Apply the idempotent [preview migration](../migration/extensionSocialPreview.sql) and [connection schema](../migration/extensionConnections.sql) before deployment. The independent `clipper` schema has staff foreign keys with cascading deletion and is included in full-database backups. Payload schema push does not manage it. No existing article or issue is rewritten.

CMS unit tests cover metadata, fixed callback/origin validation, PKCE, hashing, account invalidation and revocation boundaries. PostgreSQL browser tests exercise staff sign-in/approval, single-use code exchange, invalid verifier rejection, limited-token imports, general CMS rejection, owner-only revocation and draft persistence. Ten standalone Chromium tests cover extraction, popup review, the connection UI, state/PKCE, legacy-sync removal and disconnect retry; Chrome APIs are mocked there. A separate installed-extension smoke check verifies the real Chrome ID and API availability. These checks do not guarantee every publisher's markup or a user's existing browser configuration.

### Verified beta release — October 17, 2026

- CMS commit `d87334c`; Railway deployment `29e8c413-05f7-4aeb-8e0b-81a9b632ca9f` reached `SUCCESS`. Both additive migrations are applied locally and on beta.
- [GitHub Checks run 39053988964](https://github.com/cmoll-nicresource/nic360/actions/runs/39053988964) passed, including 522 offline tests, the enabled PostgreSQL integrations and the 99-check browser matrix. The ten standalone extension tests also passed.
- The packaged extension was loaded in a disposable real Chromium profile against beta. Website staff sign-in, explicit approval, the Chrome identity callback, PKCE exchange, draft import, duplicate detection, website revocation and clearing the revoked credential all passed. The temporary draft, source, staff account, browser profile and Railway SSH key were removed.
- Local distribution artifact: `dist/nic360-news-clipper-2.2.0.zip`; SHA-256 `B1D5EA30749D8507751A57F386103930880475BA3EA65BBED2B7E8A4295525B1`. The unpacked folder is `dist/nic360-news-clipper-2.2.0/`. These artifacts are ignored by Git; the website repository does not distribute or auto-update the extension. Preserve the manifest public key when preparing future packages.


### Current branded package — October 19, 2026

N360 News Clipper 2.2.1 uses the supplied 16/32/48/128px icons. Download the current ZIP at `/api/admin/news-extension` while signed in as staff. Extract it to the installation folder and use **Reload** in `chrome://extensions`; the stable Chrome ID and existing connection are preserved. N360 Industry News Clipper 1.0.2 is available at `/api/admin/research-extension`. Packaging commands are in `scripts/packageClipperExtensions.ps1`; the News source remains in the separate `tma-ext` repository.
