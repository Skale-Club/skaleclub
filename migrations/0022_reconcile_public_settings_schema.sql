ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_keywords" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_author" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_canonical_url" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_robots_tag" text DEFAULT 'index, follow';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "og_type" text DEFAULT 'website';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "og_site_name" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "twitter_card" text DEFAULT 'summary_large_image';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "twitter_site" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "twitter_creator" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "schema_local_business" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "gtm_container_id" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "ga4_measurement_id" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "facebook_pixel_id" text DEFAULT '';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "gtm_enabled" boolean DEFAULT false;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "ga4_enabled" boolean DEFAULT false;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "facebook_pixel_enabled" boolean DEFAULT false;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "page_slugs" jsonb DEFAULT '{"thankYou":"thankyou","privacyPolicy":"privacy-policy","termsOfService":"terms-of-service","contact":"contact","faq":"faq","blog":"blog","portfolio":"portfolio","links":"links","vcard":"vcard"}'::jsonb;

ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "excluded_url_rules" jsonb DEFAULT '[]'::jsonb;
