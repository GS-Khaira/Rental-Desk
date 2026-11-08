-- Kueppers rental desk: tenants upload proof of rent payment; managers approve it.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run. Safe to run again.
-- Needs 0003 (roles) first.
--
-- How it works
--   1. A tenant uploads a screenshot/photo/PDF to the private "payment-proofs" storage
--      bucket, into a folder named after their own user id.
--   2. submit_rent_payment() records it as Pending. The manager and unit come from the
--      tenant's current tenancy, so a tenant can only ever send proof to their own manager.
--   3. The manager (or an admin) checks the bank account and calls review_rent_payment():
--      Approved, or Sent back with a reason. A sent-back payment can be uploaded again.
-- Who can see what: the tenant sees their own; the responsible manager and admins see the
-- rest, including the screenshot. Nobody else can.

-- ============================================================ table
create table if not exists public.rent_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,   -- responsible manager
  tenant_id     uuid not null references auth.users(id) on delete cascade,   -- tenant's login
  renter_id     uuid references public.renters(id) on delete set null,
  tenancy_id    uuid references public.tenancies(id) on delete set null,
  unit_id       uuid references public.units(id) on delete set null,
  period        date not null check (extract(day from period) = 1),          -- the month it pays for (1st of month)
  amount        numeric(10,2) not null check (amount > 0),
  expected      numeric(10,2),                                               -- the tenancy's rent when submitted
  paid_on       date not null,
  method        text not null check (method in ('e-Transfer','Bank transfer','Cheque','Cash','Other')),
  reference     text,
  note          text,
  file_path     text not null,
  file_name     text,
  status        text not null default 'Pending' check (status in ('Pending','Approved','Sent back')),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rent_payments_user_idx on public.rent_payments (user_id, status);
create index if not exists rent_payments_tenant_idx on public.rent_payments (tenant_id);
create index if not exists rent_payments_renter_idx on public.rent_payments (renter_id);

drop trigger if exists rent_payments_updated_at on public.rent_payments;
create trigger rent_payments_updated_at before update on public.rent_payments
  for each row execute function public.set_updated_at();

alter table public.rent_payments enable row level security;
drop policy if exists "payments: read" on public.rent_payments;
create policy "payments: read" on public.rent_payments for select to authenticated
  using (public.can_access(user_id) or (tenant_id = auth.uid() and public.my_role() = 'tenant'));
-- No insert/update/delete policies: changes go through the two functions below.

-- ============================================================ tenant: submit
create or replace function public.submit_rent_payment(
  p_period date, p_amount numeric, p_paid_on date, p_method text,
  p_reference text, p_note text, p_file_path text, p_file_name text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_renter uuid; t record; v_id uuid;
begin
  if coalesce(public.my_role(), '') <> 'tenant' then
    raise exception 'Only tenants can send rent payments here.' using errcode = 'P0001';
  end if;
  if p_file_path is null or split_part(p_file_path, '/', 1) <> auth.uid()::text then
    raise exception 'Attach a screenshot of the payment.' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount you paid.' using errcode = 'P0001';
  end if;
  if p_paid_on > current_date + 1 then
    raise exception 'The payment date can''t be in the future.' using errcode = 'P0001';
  end if;
  select renter_id into v_renter from public.profiles where id = auth.uid();
  select x.* into t from public.tenancies x
   where x.renter_id = v_renter and x.move_out is null
   order by x.move_in desc limit 1;
  if t.id is null then
    raise exception 'No current rental is linked to your account. Please contact your property manager.' using errcode = 'P0001';
  end if;
  insert into public.rent_payments (user_id, tenant_id, renter_id, tenancy_id, unit_id, period, amount, expected,
                                    paid_on, method, reference, note, file_path, file_name)
  values (t.user_id, auth.uid(), v_renter, t.id, t.unit_id, date_trunc('month', p_period)::date, round(p_amount, 2), t.rent,
          p_paid_on, p_method, nullif(trim(p_reference), ''), nullif(trim(p_note), ''), p_file_path, p_file_name)
  returning id into v_id;
  return v_id;
end $$;

-- ============================================================ staff: review
create or replace function public.review_rent_payment(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_mgr uuid;
begin
  select user_id into v_mgr from public.rent_payments where id = p_id;
  if v_mgr is null or not public.can_access(v_mgr) then
    raise exception 'You can''t review this payment.' using errcode = 'P0001';
  end if;
  if not p_approve and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Say why you''re sending it back, so the tenant knows what to fix.' using errcode = 'P0001';
  end if;
  update public.rent_payments
     set status = case when p_approve then 'Approved' else 'Sent back' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
   where id = p_id;
end $$;

revoke execute on function public.submit_rent_payment(date, numeric, date, text, text, text, text, text) from public, anon;
revoke execute on function public.review_rent_payment(uuid, boolean, text) from public, anon;
grant execute on function public.submit_rent_payment(date, numeric, date, text, text, text, text, text) to authenticated;
grant execute on function public.review_rent_payment(uuid, boolean, text) to authenticated;

-- ============================================================ private file storage
-- Private bucket: files are only reachable through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment proofs: tenant upload" on storage.objects;
drop policy if exists "payment proofs: read" on storage.objects;
drop policy if exists "payment proofs: tenant remove own unused" on storage.objects;

-- Tenants upload only into their own folder: payment-proofs/<their user id>/...
create policy "payment proofs: tenant upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.my_role() = 'tenant');

-- The tenant reads their own files; the responsible manager and admins read files of payments they can see.
create policy "payment proofs: read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (
           ((storage.foldername(name))[1] = auth.uid()::text and public.my_role() = 'tenant')
           or exists (select 1 from public.rent_payments p where p.file_path = name and public.can_access(p.user_id))));

-- A tenant can delete their own file only if it never became a payment (a failed submit).
create policy "payment proofs: tenant remove own unused" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs'
         and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from public.rent_payments p where p.file_path = name));
