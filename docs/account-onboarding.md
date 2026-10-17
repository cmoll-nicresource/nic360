# Reader signup and migration password transition

Updated October 17, 2026. Reader accounts use `/login`, `/signup`, `/forgot-password` and `/account`. Staff use the separate `/admin` sign-in.

## Existing readers after migration

The migration imported reader profiles, verification status, company assignments and subscription-related records, **not old passwords**. New imported accounts received a cryptographically random throwaway password; there is no shared default password to give readers. The importer deliberately excludes passwords when updating an existing record, so rerunning it must not replace a password a reader has already set. Do not rerun the importer to carry out password recovery or launch communications.

An existing reader should:

1. Open **Set a new password** from the sign-in page, or visit `/forgot-password`.
2. Enter the email address used on the previous site.
3. Open the newest reset email and choose a password of at least eight characters. Links last one hour and are single-use; requesting another invalidates the earlier link.
4. Continue to their account. The reset signs them in and invalidates previous sessions. Their company assignment, subscription eligibility, profile and publication preferences stay attached to the same account.

The sign-in page explains this transition, and `/account` includes **Change password** for later use. A verified migrated/staff-created account is directed to recovery when entered in signup; it does not need a second account or a repeated profile form. An unfinished new signup with a verification challenge can still restart.

Resetting a password does not activate a subscription, unsuspend a reader, extend a company license or change email consent. An unknown email receives the same generic reset confirmation as a known email. A failed request stays retryable instead of claiming a link was sent. Invalid/expired links offer a way to request a new one.

## New readers

Signup asks for a work email, sends a six-digit code valid for 15 minutes, then collects profile details and an eight-character minimum password. Verification allows five wrong guesses; resends have a cooldown. Completion requires the browser's protected verification proof and cannot be replayed.

A verified email matching an existing provider's allowed domain/address can be attached to that company. An unmatched reader can enter a company name; that creates a **pending, None-plan** provider for staff review, not a paid subscription. Existing manual company assignments take precedence. Gatekeepers review mismatches, pending companies and address changes before granting access.

## Launch plan

1. **Keep beta email safe mode on.** Current automated tests use a loopback mail inbox; beta account email is redirected to the designated safe mailbox. This is not yet general reader delivery.
2. Before cutover, confirm the final HTTPS `SITE_URL`, account email sender/SES permissions, reset-link host, inbox/spam delivery and support contact. Test with a deliberately selected recipient; do not generate reset links for the entire migrated database.
3. Prepare a reviewed launch notice explaining that existing readers keep their accounts and company subscriptions but must set a new password. Link to the final site's `/forgot-password`, so readers request a fresh link when ready. Do not include passwords, pre-generated reset tokens or a claim that old passwords work. Readers who already chose a Nicotine360 password can keep using it.
4. Approve the recipient list and timing separately before sending that notice or changing email safe mode. Account mail and publication audience rollout must both be considered when changing the shared safety setting. No mass reset or migration announcement is authorized by the signup test task.
5. Support staff should check the original address, duplicate/company match, verification, suspended status and license/plan when a reader reports trouble. Never request their password or paste a reset token into a support ticket. A changed email address needs staff review; it must not silently create a second membership or grant access.
6. After the transition, review support volume and remove the temporary previous-site notice when appropriate. Keep the standard forgot/change-password flow.

## Regression checks

`tests/browser/accounts.spec.ts` exercises signup with and without a matching member company, wrong/expired codes, completion proof and replay, recovery of a synthetic migrated account with a deliberate manual company assignment, preserved publication preferences, password minimum, old-password rejection, session invalidation, single-use/expired/replaced reset links, generic unknown-email confirmation, recoverable transport errors and continued suspension/access restrictions after resetting.

Run `pnpm test:e2e:seed`, `pnpm test:e2e:build`, then `pnpm exec playwright test tests/browser/accounts.spec.ts`. The harness requires an isolated loopback `nic360_e2e_test` database, a captured local mail inbox and no external provider credentials. The scenarios run in Chromium, Firefox, WebKit and a phone viewport. This proves application behavior; it does not prove delivery into every reader's real inbox. Human inbox review and an approved launch rollout remain necessary.
