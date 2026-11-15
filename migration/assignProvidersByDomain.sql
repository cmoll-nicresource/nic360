-- Attach users who have no access provider to the provider whose allowed domain (or exact
-- address) matches their email. Same rule as the on-verification hook in
-- src/hooks/assignAccessProviderOnVerify.ts, applied to existing accounts.
--
-- Safe by design:
--   * only users with NO provider are touched; manual assignments are never changed;
--   * a user whose address matches more than one provider is skipped and listed for review;
--   * only `access_provider_id` and `updated_at` change; no passwords, verification, status,
--     consent or email hooks are involved.
--
-- Run with  :apply = 0  (default) for a preview that rolls back, or  -v apply=1  to commit.
\if :{?apply}
\else
  \set apply 0
\endif

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TEMP TABLE domain_matches ON COMMIT DROP AS
SELECT u.id AS user_id,
       lower(u.email) AS email,
       u._verified AS verified,
       p.id AS provider_id,
       p.name AS provider_name,
       p.plan,
       p.status,
       d.domain AS matched_on
FROM public.users u
JOIN public.access_providers_allowed_domains d
  ON lower(trim(d.domain)) IN (lower(trim(u.email)), split_part(lower(trim(u.email)), '@', 2))
JOIN public.access_providers p ON p.id = d._parent_id
WHERE u.access_provider_id IS NULL;

CREATE TEMP TABLE ambiguous ON COMMIT DROP AS
SELECT user_id FROM domain_matches GROUP BY user_id HAVING count(DISTINCT provider_id) > 1;

\echo '== Users with no provider'
SELECT count(*) AS users_without_provider,
       count(*) FILTER (WHERE _verified) AS verified
FROM public.users WHERE access_provider_id IS NULL;

\echo '== Would be assigned (one matching provider)'
SELECT count(DISTINCT user_id) AS users,
       count(DISTINCT user_id) FILTER (WHERE verified) AS verified
FROM domain_matches WHERE user_id NOT IN (SELECT user_id FROM ambiguous);

\echo '== By provider'
SELECT provider_name, plan, status, count(DISTINCT user_id) AS users
FROM domain_matches WHERE user_id NOT IN (SELECT user_id FROM ambiguous)
GROUP BY 1, 2, 3 ORDER BY users DESC, provider_name;

\echo '== Skipped: matches more than one provider (review by hand)'
SELECT m.email, string_agg(DISTINCT m.provider_name, ' | ') AS providers
FROM domain_matches m WHERE m.user_id IN (SELECT user_id FROM ambiguous)
GROUP BY m.email ORDER BY m.email;

\echo '== Sample of changes'
SELECT email, provider_name, matched_on
FROM domain_matches WHERE user_id NOT IN (SELECT user_id FROM ambiguous)
ORDER BY provider_name, email LIMIT 40;

UPDATE public.users u
SET access_provider_id = m.provider_id, updated_at = now()
FROM (SELECT DISTINCT user_id, provider_id FROM domain_matches
      WHERE user_id NOT IN (SELECT user_id FROM ambiguous)) m
WHERE u.id = m.user_id AND u.access_provider_id IS NULL;

\echo '== Users with no provider afterwards'
SELECT count(*) AS users_without_provider FROM public.users WHERE access_provider_id IS NULL;

SELECT CASE WHEN :apply = 1 THEN 'COMMIT' ELSE 'ROLLBACK' END AS finishing \gset
\echo Finishing with :finishing
:finishing;
