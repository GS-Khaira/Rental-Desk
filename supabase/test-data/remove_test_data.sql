-- Kueppers rental desk: remove the TEST DATA added by add_test_data.sql
-- Run in Supabase: SQL Editor → New query → paste → Run.
-- Deletes only the test records (their ids all start with 7e570000-). Your real records are not touched.

delete from public.maintenance where id::text like '7e570000-%';
delete from public.tenancies   where id::text like '7e570000-%';
do $$ begin
  if to_regclass('public.tenant_requests') is not null then
    delete from public.tenant_requests where unit_id::text like '7e570000-%' or renter_id::text like '7e570000-%';
  end if;
  if to_regclass('public.profiles') is not null then
    update public.profiles set renter_id = null where renter_id::text like '7e570000-%';
  end if;
end $$;
delete from public.units       where id::text like '7e570000-%';
delete from public.properties  where id::text like '7e570000-%';
delete from public.owners      where id::text like '7e570000-%';
delete from public.renters     where id::text like '7e570000-%';
