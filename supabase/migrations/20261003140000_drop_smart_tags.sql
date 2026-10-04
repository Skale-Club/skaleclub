-- ============================================================================
-- DROP SMART TAGS — PERMANENTLY DELETES ALL SMART TAGS DATA.
--
-- The QR/NFC tag system (Smart Tags, the /nfc phone app and the desktop NFC
-- provisioner) moved to Xpot, which keeps its own tables (tag_*, tags). This
-- removes what Skale Club created for it in:
--   20261001120000_smart_tags.sql
--   20261001130000_smart_tag_provisioning.sql
--   20261003120000_smart_tag_direct_writes.sql
--   20261003130000_admin_passkeys.sql   (passkeys existed only for /nfc)
--
-- Every tag, batch, customer, scan event, destination history row,
-- provisioning device/job/event, direct-write log and admin passkey is gone
-- after this runs. There is no undo: take a backup / export first if any of it
-- is still wanted. Xpot's own tables are not touched.
--
-- Idempotent: IF EXISTS everywhere, safe to run twice.
-- No CASCADE on purpose: if anything outside this list still depends on these
-- tables (a view, a foreign key from another table), the migration fails and
-- rolls back instead of silently dropping it.
-- Indexes, RLS policies, the smart_tag_destination_history_no_update trigger,
-- the bigserial sequences and the CHECK constraints (including the
-- smart_tags.nfc_* columns added by the provisioning migration) go with their
-- tables. No enum types were created (status columns are text + CHECK).
-- ============================================================================

-- One statement, so the foreign keys between these tables need no ordering.
DROP TABLE IF EXISTS
  -- smart_tag_journey_entries / smart_tag_plans exist in production without a
  -- migration in this repo (created directly); both reference smart_tags, so
  -- leaving them out would make this statement fail (no CASCADE).
  public.smart_tag_journey_entries,
  public.smart_tag_plans,
  public.smart_tag_direct_writes,
  public.smart_tag_provisioning_events,
  public.smart_tag_provisioning_jobs,
  public.smart_tag_events,
  public.smart_tag_destination_history,
  public.smart_tags,
  public.smart_tag_provisioning_devices,
  public.smart_tag_batches,
  public.smart_tag_customers,
  public.admin_passkeys;

-- The trigger went with smart_tag_destination_history; its function stays
-- until dropped explicitly.
DROP FUNCTION IF EXISTS public.smart_tag_destination_history_immutable();
DROP FUNCTION IF EXISTS public.smart_tag_journey_entries_append_only();
