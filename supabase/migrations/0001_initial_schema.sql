-- DDA Rental Desk: initial schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
-- Every row belongs to the signed-in account that created it (user_id).
-- Row Level Security means a signed-in user can only ever see and change
-- their own rows; anyone not signed in sees nothing.

create extension if not exists "pgcrypto";

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- owners ----------
create table public.owners (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  phone         text,
  email         text,
  contact_pref  text check (contact_pref in ('Phone','Text','Email')),
  address       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- properties ----------
create table public.properties (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_id         uuid not null references public.owners(id) on delete restrict,
  address          text not null check (length(trim(address)) > 0),
  area             text not null,
  postal           text check (postal is null or postal ~* '^C[0-9][A-Z] ?[0-9][A-Z][0-9]$'),
  type             text,
  agreement_start  date,
  agreement_end    date,
  fee_type         text check (fee_type in ('% of rent','Flat monthly')),
  fee_value        numeric(10,2) check (fee_value is null or fee_value >= 0),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- units ----------
create table public.units (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id     uuid not null references public.properties(id) on delete cascade,
  label           text,
  rent            numeric(10,2) not null check (rent >= 0),
  beds            smallint not null check (beds >= 0),
  baths           numeric(3,1) check (baths is null or baths >= 0),
  status          text not null default 'Vacant' check (status in ('Vacant','Listed','Rented','Not available')),
  pets            boolean not null default false,
  parking         boolean not null default false,
  utilities       text,
  available_date  date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------- renters ----------
-- Deliberately no fields for protected grounds under the PEI Human Rights Act
-- (age, family status, disability, religion, source of income, etc.).
create table public.renters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  phone         text,
  email         text,
  budget        numeric(10,2) not null check (budget >= 0),
  beds          smallint check (beds is null or beds >= 0),
  move_in       date,
  areas         text[] not null default '{}',
  pets          boolean not null default false,
  parking       boolean not null default false,
  source        text,
  status        text not null default 'Looking' check (status in ('Looking','Placed','Inactive')),
  consent       boolean not null default false,
  consent_date  date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- tenancies (rental history) ----------
-- Deleting a renter deletes their history (PIPEDA deletion request).
-- Deleting a unit keeps the history but unlinks it.
create table public.tenancies (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unit_id           uuid references public.units(id) on delete set null,
  renter_id         uuid not null references public.renters(id) on delete cascade,
  unit_snapshot     text,   -- address + unit label at move-in, kept if the unit is later deleted
  move_in           date not null,
  move_out          date check (move_out is null or move_out >= move_in),
  rent              numeric(10,2) check (rent is null or rent >= 0),
  deposit           numeric(10,2) check (deposit is null or deposit >= 0),
  would_rent_again  text check (would_rent_again in ('Yes','Maybe','No')),
  payment_notes     text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Only one current (not moved-out) tenancy per unit.
create unique index tenancies_one_current_per_unit
  on public.tenancies (unit_id) where move_out is null and unit_id is not null;

-- ---------- maintenance ----------
create table public.maintenance (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unit_id      uuid not null references public.units(id) on delete cascade,
  date         date not null default current_date,
  description  text not null check (length(trim(description)) > 0),
  vendor       text,
  cost         numeric(10,2) check (cost is null or cost >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- indexes, triggers, security ----------
do $$
declare t text;
begin
  foreach t in array array['owners','properties','units','renters','tenancies','maintenance'] loop
    execute format('create index %1$s_user_idx on public.%1$s (user_id)', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%1$s enable row level security', t);
    execute format('create policy "own rows: select" on public.%1$s for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "own rows: insert" on public.%1$s for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: update" on public.%1$s for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: delete" on public.%1$s for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

create index properties_owner_idx   on public.properties (owner_id);
create index units_property_idx     on public.units (property_id);
create index tenancies_unit_idx     on public.tenancies (unit_id);
create index tenancies_renter_idx   on public.tenancies (renter_id);
create index maintenance_unit_idx   on public.maintenance (unit_id);
