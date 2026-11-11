-- Kueppers rental desk: remove the rent payment uploads (added in 0005).
-- OPTIONAL. The app no longer uses any of this, so it is safe to leave in place.
-- Run it only if you want the stored payment records removed for good.
--
-- !! This permanently deletes every rent payment record tenants sent. !!
--    Download anything you need first (Supabase → Table Editor → rent_payments → Export).
--
-- Run in Supabase: SQL Editor → New query → paste → Run. Safe to run again,
-- and safe to run even if 0005 was never run.
--
-- The screenshots themselves sit in the "payment-proofs" storage bucket. Supabase
-- doesn't allow deleting files with SQL, so remove them in the dashboard:
--   Storage → payment-proofs → select all files → Delete, then ⋯ next to the bucket → Delete bucket.
-- Do that BEFORE running this script while the read policy still lets you see them,
-- or after it as the project owner (the dashboard isn't limited by these policies).

drop policy if exists "payment proofs: tenant upload" on storage.objects;
drop policy if exists "payment proofs: read" on storage.objects;
drop policy if exists "payment proofs: tenant remove own unused" on storage.objects;

drop function if exists public.submit_rent_payment(date, numeric, date, text, text, text, text, text);
drop function if exists public.review_rent_payment(uuid, boolean, text);

drop table if exists public.rent_payments;
