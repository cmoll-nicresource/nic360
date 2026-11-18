-- Additive: the "story-digest" (weekly Executive Summary PDF) format for
-- publications and issues. Adds enum values only; no row is changed. Safe to
-- run more than once. Requires migration/executiveSummaryStories.sql first.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TYPE public.enum_publications_format ADD VALUE IF NOT EXISTS 'story-digest' AFTER 'story-list';
ALTER TYPE public.enum_publication_issues_format ADD VALUE IF NOT EXISTS 'story-digest' AFTER 'story-list';
ALTER TYPE public.enum__publication_issues_v_version_format ADD VALUE IF NOT EXISTS 'story-digest' AFTER 'story-list';

COMMIT;
