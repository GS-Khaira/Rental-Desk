@AGENTS.md

# Kueppers Property Services rental desk ("DDA") — project memory

Read this first. It records what has been decided and built, so a new session can continue without the old chat.
Keep it up to date: when a decision changes or a step is finished, edit this file in the same commit.

## The owner and the goal

- Owner: GS-Khaira of **Kueppers Property Services**, a rental manager in **Prince Edward Island, Canada**. Not a developer: explain steps plainly,
  one at a time, and ask questions one by one. They like a recommendation with each question.
- Goal: track as many listings and renters in the area as possible, keep each renter's and unit's history,
  and match renters to open units.
- Messages from the owner often start with "DDA" — it's their label for this project, not an instruction.
- **Code changes always go through a preview branch** (owner's rule):
  1. Create a new branch from `main` for each change (e.g. `feat/renter-top-units`, `fix/login-error`).
  2. Commit and push the branch. Vercel builds a preview of it automatically.
  3. Give the owner the **preview link** for that branch (plus screenshots when useful), and the GitHub branch link.
  4. Merge into `main` **only after the owner approves**. Never push code changes straight to `main`.
  - Vercel's branch preview address has the pattern `https://rental-desk-git-<branch>-<vercel-team>.vercel.app`
    (slashes in the branch name become `-`). The `<vercel-team>` part isn't known yet; ask the owner for one preview link to learn it.
  - Documentation-only changes (`(docs): …`, e.g. this file) may go straight to `main`.

## Commits (owner's rules)

- **Author every commit as Claude**: `git config user.name Claude` and `git config user.email noreply@anthropic.com`
  (then GitHub shows them as Verified). Don't use the owner's name or email. Still end messages with the attribution lines.
- **Subject prefix** — the type in parentheses, a colon, then the message:
  - `(feat): …` new features
  - `(fix): …` bug fixes
  - `(refactor): …` restructuring code without changing behaviour
  - `(style): …` formatting and visual styling
  - `(docs): …` documentation only, e.g. updating this file or the README
  - Example: `(feat): Let users adjust matching rules`
- Commit or push only when the owner wants it. If they say "don't commit now", leave changes uncommitted.
- **Keep this file current**: whenever you learn something new about the project, the owner's preferences or a decision,
  update CLAUDE.md and commit it as `(docs): …` (alongside the related change, or on its own).
- Older commits (before 2026-11-07) were authored under the owner's email and show as Unverified on GitHub.
  The owner chose to leave them as they are; don't rewrite `main` history.

## Decisions made (with the owner)

| Topic | Decision |
|---|---|
| Roles | **Admin** (sees everything, manages users), **Property manager** (only their own owners/properties/units/renters/tenancies/maintenance/requests, by `user_id`), **Tenant** (only their current home via `tenant_home()` and their own requests). Enforced by RLS in `supabase/migrations/0003_roles_and_requests.sql` via `my_role()`, `is_admin()`, `can_access(user_id)`. Role descriptions live in one place: `src/lib/roles.ts` (`ROLE_INFO`). |
| Users page | Admins only (`#users`, `src/components/UsersView.tsx`). Add user → role cards, name, email, phone; tenants must be linked to a renter record (`profiles.renter_id`). New users get a **temporary password** shown once (copyable message); they must choose their own at first sign-in (`must_change_password`). Admin can change role/details, make a new temporary password, switch access off/on (ban + `profiles.active`). **No hard delete** (records would cascade). Can't demote/deactivate yourself; DB trigger keeps at least one active admin. |
| User admin server | `src/app/api/admin/users` (GET list, POST create) and `.../[id]` (PATCH: update, reset_password, deactivate, reactivate). Server-only helper `src/lib/server/admin.ts` uses **`SUPABASE_SECRET_KEY`** (Vercel env var, never `NEXT_PUBLIC_`, never in chat) and checks the caller's token is an active admin. Browser calls go through `src/lib/adminApi.ts`. Reason: Supabase's free email can't send invites to outsiders, so temporary passwords are used instead of invite emails. |
| Admin view | Header "Viewing" selector (everyone / one manager) narrows every screen (`store.scope`). Cards show "Managed by". Owner and renter forms have "Managed by" for admins; changing an owner's manager calls `reassign_owner()` which moves its properties, units, tenancies, maintenance and requests too. New child rows inherit the parent's manager (`inherit_manager` trigger). |
| Tenant requests | Tenants send requests from the portal (`create_tenant_request()` picks the manager and unit from their current tenancy). Categories: Maintenance, Rent or payment, Lease, Other. Status: Open → In progress → Resolved (staff only; a tenant reply reopens a resolved request). Threads in `request_messages`. Staff see them on the **Requests** tab (badge = open count) and a banner on Today. Tenant portal: `src/components/TenantPortal.tsx`; requests UI: `src/components/Requests.tsx`. |
| Branding | Business name **Kueppers Property Services**. Logo: `public/brand/kueppers-logo.png` (black on transparent, made from the owner's JPG; CSS inverts it to white in dark mode). App icons: `src/app/icon.png`, `src/app/apple-icon.png`. Tab title "Kueppers Property Services". "DDA" is still the owner's chat label, not the app name. |
| Location | PEI. CAD, `en-CA` dates, postal codes start with C. Area dropdown in `src/lib/constants.ts` (Charlottetown split into neighbourhoods; owner hasn't objected). |
| Listings | Only units the owner manages for landlords (not outside Kijiji/Facebook ads). Structure: Owner → Property → Unit → Tenancy; Renters separate. |
| Rent | Tracked outside the app. Tenancies have free-text payment notes and "would rent to again" (Yes/Maybe/No). A monthly rent tracker was offered and declined for v1. |
| Matching | `src/lib/match.ts`. **Defaults**: budget 35, bedrooms 25, area 20, pets 10, parking 5, move-in timing 5. Must-match by default: budget (beyond 5% stretch), bedrooms, pets. Others are warnings. Only Vacant/Listed units and Looking renters. |
| Matching settings | **User-adjustable** on the Matching tab (`#matching`, `src/components/MatchSettingsView.tsx`): points per check, must-match per check, budget stretch %, move-in grace days, renters per unit card, lowest score shown. Saved per user in `match_settings` (jsonb), with "Reset to defaults". Score = points earned ÷ total points × 100, so it's always out of 100. Defaults reproduce the original scores exactly (tested). |
| Units page | Each open unit's card lists its **top N renters by score, descending** (N = setting, default 10; owner's request). |
| Legal | PIPEDA: consent checkbox + date on renters, "Copy their data", "Delete renter" (deletes history too). PEI Human Rights Act: no fields or matching on protected grounds, **including source of income**. Don't add such fields. |
| Data location | Supabase region is **US East (N. Virginia)** — Canada wasn't offered. Allowed under PIPEDA if disclosed. TODO: add "stored with a service provider in the United States" to the consent wording. |
| No scraping | Don't auto-import from Kijiji/Facebook/Rentals.ca (terms of service). |

## Stack and where things live

- **Code**: https://github.com/GS-Khaira/Rental-Desk (branch `main`). Next.js 16 (App Router, see AGENTS.md) + TypeScript, single client page with hash routes (`#home`, `#units`, `#renters`, `#owners`, `#requests`, `#matching`, `#users`); tenants get the portal instead. `src/components/App.tsx` `Gate` decides by account state and role.
- **Database + login**: Supabase project `rental-desk`, URL `https://eqobpekulvvfsfddenhb.supabase.co` (not secret).
  Schema: `supabase/migrations/0001_initial_schema.sql` (run). `0002_match_settings.sql` (**owner must run it**; until then the app uses defaults and the Save button is disabled with a notice). `0003_roles_and_requests.sql` (**owner must run it**; makes every existing account an admin; until then the app runs in "legacy" mode as a single admin and the Users/Requests screens show a notice). New schema changes go in a new numbered migration file that the owner runs in the SQL Editor.
- **Hosting**: Vercel, https://rental-desk-urhh.vercel.app, deploys automatically on every push to `main`.
  Env vars set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Needed for the Users page: `SUPABASE_SECRET_KEY` (server-only; owner adds it in Vercel, Production + Preview).
- **Prototype** (earlier, superseded): claude.ai artifact https://claude.ai/artifact/9v14JtWiTeuJrwEdF2PX2b with example data.
- Never put the `sb_secret_` key or the database password in code, chat, or this file.

| Path | What |
|---|---|
| `src/lib/match.ts` | Matching rules (pure; tested in `tests/match.test.ts`, run `npm test`) |
| `src/lib/store.tsx` | Supabase loading/saving, lookups, matches |
| `src/components/actions.ts` | Add/edit forms, move-in, move-out flows |
| `src/components/Views.tsx` | Today, Units, Renters, Owners screens |
| `src/components/Sheets.tsx` | Detail panels for unit, renter, owner |
| `src/components/App.tsx` | Shell, sign-in, password reset, backups/CSV export |
| `src/components/MatchSettingsView.tsx` | Matching settings page |
| `src/components/UsersView.tsx` | Users & access page (admins) |
| `src/components/Requests.tsx` | Requests tab, request detail, shared message thread |
| `src/components/TenantPortal.tsx` | Tenant's home, manager contact, requests |
| `src/lib/roles.ts` | Role names/descriptions, request categories/statuses |
| `src/lib/server/admin.ts`, `src/app/api/admin/users/**` | Server-side user management (secret key) |
| `src/lib/adminApi.ts` | Browser client for those routes |

Checks before pushing: `npm test`, `npx tsc --noEmit`, `npm run lint`, and a build with dummy env vars:
`NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npm run build`.
The cloud session's network blocks vercel.app and supabase.co, so the owner tests the live site.

## Setup status

- [x] GitHub repo + Claude GitHub App installed on it
- [x] Supabase project, schema run, owner's login created, public sign-ups off
- [x] Vercel deployed
- [ ] Supabase Auth → URL Configuration: Site URL + redirect `https://rental-desk-urhh.vercel.app/**` (asked, not confirmed)
- [ ] Run migration `0002_match_settings.sql` in the Supabase SQL Editor
- [ ] Run migration `0003_roles_and_requests.sql` (after 0002)
- [ ] Add `SUPABASE_SECRET_KEY` in Vercel (Production + Preview) and redeploy
- [ ] Owner's live test checklist (sign in, add owner/property/unit/renter, match, move-in, reload) — not yet reported

## Backlog / ideas offered to the owner

- Supabase's built-in email only reaches project team members: "Forgot password" emails won't reach managers/tenants until custom SMTP is set up. Admins use "Make a new temporary password" instead. Custom SMTP (e.g. Resend) is a possible later step.
- Public "Looking for a rental?" form so renters sign themselves up (with consent) — recommended next feature.
- Same top-10 list on Renters page (top units per renter) — offered, no answer yet.
- Photos for units, map view, email/text alerts for new matches, spreadsheet import.
- Matching tweaks offered: area as hard requirement, 10% budget stretch, more criteria (utilities, furnished, laundry, lease length), weight changes.
- Consent wording: mention US data storage.
