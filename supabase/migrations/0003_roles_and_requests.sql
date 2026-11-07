-- Kueppers rental desk: roles (admin / property manager / tenant), user profiles,
-- and tenant requests.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again. Run 0001 and 0002 first.
--
-- IMPORTANT: every account that already exists becomes an ADMIN (on a first run
-- that is just the owner). Change roles afterwards on the app's Users page.
--
-- Who can do what (enforced here by Row Level Security, not just by the screens):
--   admin    – everything: all records of every manager, all requests, user management
--   manager  – only the owners, properties, units, renters, tenancies, maintenance
--              and requests they are responsible for (user_id = their id)
--   tenant   – nothing in those tables; only their own home via tenant_home(),
--              and their own requests and messages
-- Deactivated users (profiles.active = false) can do nothing.

-- ============================================================ profiles
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  full_name             text,
  phone                 text,
  role                  text not null default 'tenant' check (role in ('admin','manager','tenant')),
  renter_id             uuid references public.renters(id) on delete set null,   -- tenants: who they are
  active                boolean not null default true,
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists profiles_one_login_per_renter on public.profiles (renter_id) where renter_id is not null;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Existing accounts become admins (first run: just the owner).
insert into public.profiles (id, email, role)
select id, email, 'admin' from auth.users
on conflict (id) do nothing;

-- New accounts get a profile automatically. The app's Users page sets the role;
-- an account made any other way (e.g. in the Supabase dashboard) starts as a
-- tenant with no rental linked, so it can see nothing until an admin changes it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email, new.raw_user_meta_data->>'full_name',
    case when new.raw_app_meta_data->>'role' in ('admin','manager','tenant')
         then new.raw_app_meta_data->>'role' else 'tenant' end
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Never leave the app without an active admin.
create or replace function public.keep_one_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.profiles where role = 'admin' and active and id <> old.id) then
    raise exception 'The app needs at least one active admin.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists profiles_keep_one_admin on public.profiles;
create trigger profiles_keep_one_admin before update or delete on public.profiles
  for each row execute function public.keep_one_admin();

-- ============================================================ role helpers
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- Staff access to a record owned by row_user.
create or replace function public.can_access(row_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case public.my_role()
           when 'admin' then true
           when 'manager' then row_user = auth.uid()
           else false
         end
$$;

-- Lets a user clear "must change password" after setting their own password.
create or replace function public.clear_password_flag()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid()
$$;

alter table public.profiles enable row level security;
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
-- No insert/update/delete policies: profiles change only through the app's
-- server (admin actions) and the functions above.

-- ============================================================ staff tables
-- Replace the "own rows" policies from 0001 with role-aware ones.
do $$
declare t text;
begin
  foreach t in array array['owners','properties','units','renters','tenancies','maintenance'] loop
    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);
    execute format('drop policy if exists "staff: select" on public.%I', t);
    execute format('drop policy if exists "staff: insert" on public.%I', t);
    execute format('drop policy if exists "staff: update" on public.%I', t);
    execute format('drop policy if exists "staff: delete" on public.%I', t);
    execute format('create policy "staff: select" on public.%I for select to authenticated using (public.can_access(user_id))', t);
    execute format('create policy "staff: insert" on public.%I for insert to authenticated with check (public.can_access(user_id))', t);
    execute format('create policy "staff: update" on public.%I for update to authenticated using (public.can_access(user_id)) with check (public.can_access(user_id))', t);
    execute format('create policy "staff: delete" on public.%I for delete to authenticated using (public.can_access(user_id))', t);
  end loop;
end $$;

-- A new property, unit, tenancy or maintenance entry belongs to the same manager
-- as the record it hangs off (so an admin adding a unit to a manager's property
-- keeps it with that manager).
create or replace function public.inherit_manager()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent uuid;
begin
  if tg_table_name = 'properties' then
    select user_id into parent from public.owners where id = new.owner_id;
  elsif tg_table_name = 'units' then
    select user_id into parent from public.properties where id = new.property_id;
  elsif tg_table_name in ('tenancies','maintenance') then
    select user_id into parent from public.units where id = new.unit_id;
  end if;
  if parent is not null then new.user_id := parent; end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['properties','units','tenancies','maintenance'] loop
    execute format('drop trigger if exists %1$s_inherit_manager on public.%1$s', t);
    execute format('create trigger %1$s_inherit_manager before insert on public.%1$s
                    for each row execute function public.inherit_manager()', t);
  end loop;
end $$;

-- ============================================================ tenant requests
create table if not exists public.tenant_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,  -- responsible manager
  tenant_id        uuid not null references auth.users(id) on delete cascade,  -- tenant's login
  renter_id        uuid references public.renters(id) on delete set null,
  unit_id          uuid references public.units(id) on delete set null,
  category         text not null check (category in ('Maintenance','Rent or payment','Lease','Other')),
  subject          text not null check (length(trim(subject)) > 0),
  status           text not null default 'Open' check (status in ('Open','In progress','Resolved')),
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists tenant_requests_user_idx on public.tenant_requests (user_id);
create index if not exists tenant_requests_tenant_idx on public.tenant_requests (tenant_id);

create table if not exists public.request_messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.tenant_requests(id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);
create index if not exists request_messages_request_idx on public.request_messages (request_id);

drop trigger if exists tenant_requests_updated_at on public.tenant_requests;
create trigger tenant_requests_updated_at before update on public.tenant_requests
  for each row execute function public.set_updated_at();

alter table public.tenant_requests enable row level security;
alter table public.request_messages enable row level security;

drop policy if exists "requests: read" on public.tenant_requests;
drop policy if exists "requests: staff update" on public.tenant_requests;
create policy "requests: read" on public.tenant_requests for select to authenticated
  using (public.can_access(user_id) or (tenant_id = auth.uid() and public.my_role() = 'tenant'));
create policy "requests: staff update" on public.tenant_requests for update to authenticated
  using (public.can_access(user_id)) with check (public.can_access(user_id));
-- Tenants create requests only through create_tenant_request() below.

-- Messages follow their request: whoever can see the request can read and add to it.
drop policy if exists "messages: read" on public.request_messages;
drop policy if exists "messages: add" on public.request_messages;
create policy "messages: read" on public.request_messages for select to authenticated
  using (exists (select 1 from public.tenant_requests r where r.id = request_id));
create policy "messages: add" on public.request_messages for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.tenant_requests r where r.id = request_id));

-- New message: bump the request; a tenant writing on a resolved request reopens it.
create or replace function public.on_request_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.tenant_requests
     set last_message_at = now(),
         status = case when status = 'Resolved' and new.author_id = tenant_id then 'Open' else status end
   where id = new.request_id;
  return new;
end $$;
drop trigger if exists request_messages_bump on public.request_messages;
create trigger request_messages_bump after insert on public.request_messages
  for each row execute function public.on_request_message();

-- A tenant sends a request. The manager and unit come from their current tenancy,
-- so a tenant can only ever reach the manager of the place they rent.
create or replace function public.create_tenant_request(p_category text, p_subject text, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_renter uuid; v_unit uuid; v_mgr uuid; v_id uuid;
begin
  if coalesce(public.my_role(), '') <> 'tenant' then
    raise exception 'Only tenants can send requests here.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_message, ''))) = 0 then
    raise exception 'Write a message first.' using errcode = 'P0001';
  end if;
  select renter_id into v_renter from public.profiles where id = auth.uid();
  select t.unit_id, t.user_id into v_unit, v_mgr
    from public.tenancies t
   where t.renter_id = v_renter and t.move_out is null
   order by t.move_in desc limit 1;
  if v_mgr is null then
    raise exception 'No current rental is linked to your account. Please contact your property manager.' using errcode = 'P0001';
  end if;
  insert into public.tenant_requests (user_id, tenant_id, renter_id, unit_id, category, subject)
  values (v_mgr, auth.uid(), v_renter, v_unit, p_category, trim(p_subject))
  returning id into v_id;
  insert into public.request_messages (request_id, author_id, body) values (v_id, auth.uid(), trim(p_message));
  return v_id;
end $$;

-- What a tenant sees about their home: only these fields, nothing internal
-- (no owner details, notes or other units).
create or replace function public.tenant_home()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', coalesce(r.name, me.full_name),
    'tenancy', case when t.id is null then null else jsonb_build_object('move_in', t.move_in, 'rent', t.rent) end,
    'unit', case when u.id is null then null else jsonb_build_object(
              'label', u.label, 'beds', u.beds, 'baths', u.baths, 'utilities', u.utilities,
              'pets', u.pets, 'parking', u.parking) end,
    'property', case when p.id is null then null else jsonb_build_object(
              'address', p.address, 'area', p.area, 'postal', p.postal) end,
    'manager', case when m.id is null then null else jsonb_build_object(
              'name', coalesce(m.full_name, m.email), 'email', m.email, 'phone', m.phone) end
  )
  from public.profiles me
  left join public.renters r on r.id = me.renter_id
  left join lateral (
    select * from public.tenancies x where x.renter_id = r.id and x.move_out is null order by x.move_in desc limit 1
  ) t on true
  left join public.units u on u.id = t.unit_id
  left join public.properties p on p.id = u.property_id
  left join public.profiles m on m.id = t.user_id
  where me.id = auth.uid() and me.active and me.role = 'tenant'
$$;

-- ============================================================ admin: hand an owner to another manager
-- Moves the owner and everything under it (properties, units, tenancies,
-- maintenance, requests) to another manager in one step.
create or replace function public.reassign_owner(p_owner uuid, p_manager uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reassign records.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_manager and role in ('admin','manager') and active) then
    raise exception 'Choose an active property manager or admin.' using errcode = 'P0001';
  end if;
  update public.owners     set user_id = p_manager where id = p_owner;
  update public.properties set user_id = p_manager where owner_id = p_owner;
  update public.units      set user_id = p_manager where property_id in (select id from public.properties where owner_id = p_owner);
  update public.maintenance set user_id = p_manager where unit_id in
    (select u.id from public.units u join public.properties p on p.id = u.property_id where p.owner_id = p_owner);
  update public.tenancies  set user_id = p_manager where unit_id in
    (select u.id from public.units u join public.properties p on p.id = u.property_id where p.owner_id = p_owner);
  update public.tenant_requests set user_id = p_manager where unit_id in
    (select u.id from public.units u join public.properties p on p.id = u.property_id where p.owner_id = p_owner);
end $$;

-- Only signed-in users may call these.
revoke execute on function public.create_tenant_request(text, text, text) from public, anon;
revoke execute on function public.tenant_home() from public, anon;
revoke execute on function public.reassign_owner(uuid, uuid) from public, anon;
revoke execute on function public.clear_password_flag() from public, anon;
grant execute on function public.create_tenant_request(text, text, text) to authenticated;
grant execute on function public.tenant_home() to authenticated;
grant execute on function public.reassign_owner(uuid, uuid) to authenticated;
grant execute on function public.clear_password_flag() to authenticated;
