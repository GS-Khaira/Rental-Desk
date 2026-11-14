-- Kueppers rental desk: email notifications for tenant requests.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run. Safe to run again.
-- Needs 0003 (roles and requests) first.
--
-- Adds:
--   profiles.notify_email          each person's "email me about requests" switch (on by default)
--   request_messages.emailed_at     when the email for this message went out, so it's never sent twice
--   tenant_requests.status_emailed  the last status the tenant was emailed about, for the same reason
-- The emails themselves are sent by the app's server (src/app/api/notify), not by the database.

alter table public.profiles         add column if not exists notify_email boolean not null default true;
alter table public.request_messages add column if not exists emailed_at timestamptz;
alter table public.tenant_requests  add column if not exists status_emailed text;

-- Anyone signed in can switch their own request emails on or off (profiles have no update policy).
create or replace function public.set_my_email_notifications(p_on boolean)
returns void language sql security definer set search_path = public as $$
  update public.profiles set notify_email = p_on where id = auth.uid()
$$;
revoke execute on function public.set_my_email_notifications(boolean) from public, anon;
grant execute on function public.set_my_email_notifications(boolean) to authenticated;
