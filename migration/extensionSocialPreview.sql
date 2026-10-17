-- Additive metadata for extension clips, including Payload draft versions.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS social_preview_description varchar;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS social_preview_image_url varchar;
ALTER TABLE public._articles_v ADD COLUMN IF NOT EXISTS version_social_preview_description varchar;
ALTER TABLE public._articles_v ADD COLUMN IF NOT EXISTS version_social_preview_image_url varchar;
COMMIT;
