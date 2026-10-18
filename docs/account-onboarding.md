# User signup and migration password transition

Account labels follow [Users, subscribers and attendees](./terminology.md).

Updated October 18, 2026. User accounts use `/login`, `/signup`, `/forgot-password` and `/account`. Staff use the separate `/admin` sign-in.

## Existing users after migration

The migration imported user profiles, verification status, company assignments and subscription-related records, **not old passwords**. New imported accounts received a cryptographically random throwaway password; there is no shared default password to give users. The importer deliberately excludes passwords when updating an existing record, so rerunning it must not replace a password a user has already set. Do not rerun the importer to carry out password recovery or launch communications.

An existing user should:

1. Open **Set a new password** from the sign-in page, or visit `/forgot-password`.
2. Enter the email address used on the previous site.
3. Open the newest reset email and choose a password of at least eight characters. Links last one hour and are single-use; requesting another invalidates the earlier link.
4. Continue to their account. The reset signs them in and invalidates previous sessions. Their company assignment, subscription eligibility, profile and publication preferences stay attached to the same account.

### Historical last login

On October 18, 2026, historical last-login dates were recovered from the original dump. The legacy database has `current_sign_in_at` (most recent), `last_sign_in_at` (previous) and `sign_in_count`; the newest valid sign-in timestamp is used. Naive Rails timestamps are interpreted as UTC and truncated to the CMS's millisecond precision. Missing, invalid and future values are never replaced with migration/confirmation dates.

The original account/domain/status import rules identify 626 eligible users. Of those, 337 have historical login dates and all 337 matched beta users by exact normalized email. **336 blank beta dates were filled; one newer beta login was preserved.** The local development copy received 337 missing dates. A second preview in both environments proposed zero updates. The remaining 289 eligible legacy users have no historical sign-in timestamp.

`migration/backfillUserLogins.ts` previews by default; `--plan-only` prepares a private source plan and `--apply` commits a local backfill. The SQL repair locks/rechecks matching users, snapshots original dates before writing, preserves equal/newer dates, rejects ambiguous identities or a stale preview, and verifies checksums of every other user field. Private before/after snapshots and execution summaries remain in ignored `migration/data` and `tmp` directories. Beta was updated over temporary private Railway SSH, and the key was revoked after verification. No passwords, account status, subscriptions, consent, sessions or update timestamps changed; no email hooks ran. The original user importer now also carries forward historical dates while preserving newer logins on reruns. Do not rerun the full importer solely to repair login dates.

The sign-in page explains this transition, and `/account` includes **Change password** for later use. A verified migrated/staff-created account is directed to recovery when entered in signup; it does not need a second account or a repeated profile form. An unfinished new signup with a verification challenge can still restart.

Resetting a password does not activate a subscription, unsuspend a user, extend a company license or change email consent. An unknown email receives the same generic reset confirmation as a known email. A failed request stays retryable instead of claiming a link was sent. Invalid/expired links offer a way to request a new one.

## New users

Signup asks for a work email, sends a six-digit code valid for 15 minutes, then collects profile details and an eight-character minimum password. Verification allows five wrong guesses; resends have a cooldown. Completion requires the browser's protected verification proof and cannot be replayed.

A verified email matching an existing provider's allowed domain/address can be attached to that company. An unmatched user can enter a company name; that creates a **pending, None-plan** provider for staff review, not a paid subscription. Existing manual company assignments take precedence. Gatekeepers review mismatches, pending companies and address changes before granting access.

## Launch plan

1. **Keep beta email safe mode on.** Current automated tests use a loopback mail inbox; beta account email is redirected to the designated safe mailbox. This is not yet general user delivery.
2. Before cutover, confirm the final HTTPS `SITE_URL`, account email sender/SES permissions, reset-link host, inbox/spam delivery and support contact. Test with a deliberately selected recipient; do not generate reset links for the entire migrated database.
3. Prepare a reviewed launch notice explaining that existing users keep their accounts and company subscriptions but must set a new password. Link to the final site's `/forgot-password`, so users request a fresh link when ready. Do not include passwords, pre-generated reset tokens or a claim that old passwords work. Users who already chose a Nicotine360 password can keep using it.
4. Approve the recipient list and timing separately before sending that notice or changing email safe mode. Account mail and publication audience rollout must both be considered when changing the shared safety setting. No mass reset or migration announcement is authorized by the signup test task.
5. Support staff should check the original address, duplicate/company match, verification, suspended status and license/plan when a user reports trouble. Never request their password or paste a reset token into a support ticket. A changed email address needs staff review; it must not silently create a second account or grant access.
6. After the transition, review support volume and remove the temporary previous-site notice when appropriate. Keep the standard forgot/change-password flow.

## Regression checks

`tests/browser/accounts.spec.ts` exercises signup with and without a matching subscribing access provider, wrong/expired codes, completion proof and replay, recovery of a synthetic migrated account with a deliberate manual company assignment, preserved publication preferences, password minimum, old-password rejection, session invalidation, single-use/expired/replaced reset links, generic unknown-email confirmation, recoverable transport errors and continued suspension/access restrictions after resetting.

Run `pnpm test:e2e:seed`, `pnpm test:e2e:build`, then `pnpm exec playwright test tests/browser/accounts.spec.ts`. The harness requires an isolated loopback `nic360_e2e_test` database, a captured local mail inbox and no external provider credentials. The scenarios run in Chromium, Firefox, WebKit and a phone viewport. This proves application behavior; it does not prove delivery into every user's real inbox. Human inbox review and an approved launch rollout remain necessary.

## October 17 verification record

The 24 account browser scenarios passed locally across all four projects, along with the 522-test offline suite, TypeScript, production build and lint (existing warnings remain). Source commit `cff88dd` deployed successfully to Railway beta as `dbcd5758-def5-4774-b072-e747885077f9`; [GitHub Checks 39076896563](https://github.com/cmoll-nicresource/nic360/actions/runs/39076896563) passed the complete regression workflow, including the 115-check browser matrix and enabled PostgreSQL integrations.

A temporary migrated-style user and Base provider were used to verify the hosted signup-to-recovery link, reset request, password setting, automatic sign-in, old-password rejection, token replay rejection and preservation of the same user, provider, profile and publication preferences. Email safe mode stayed on, and the account email transport was configured for SES. The test consumed the generated token through controlled database access; actual inbox receipt/rendering was not inspected. The temporary user/provider, isolated local test database and temporary Railway SSH key were removed. No existing user password or subscription was changed, and no audience announcement was sent.
