-- Kueppers rental desk: "Income verified" on renters
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run. Safe to run again.
--
-- Records only THAT the manager confirmed a renter can afford the rent, and when.
-- Never record where the income comes from: source of income is a protected ground
-- under the PEI Human Rights Act.

alter table public.renters add column if not exists income_verified boolean not null default false;
alter table public.renters add column if not exists income_verified_date date;
