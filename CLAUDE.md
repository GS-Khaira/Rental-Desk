@AGENTS.md

# DDA Rental Desk — project memory

Read this first. It records what has been decided and built, so a new session can continue without the old chat.
Keep it up to date: when a decision changes or a step is finished, edit this file in the same commit.

## The owner and the goal

- Owner: GS-Khaira, a rental manager in **Prince Edward Island, Canada**. Not a developer: explain steps plainly,
  one at a time, and ask questions one by one. They like a recommendation with each question.
- Goal: track as many listings and renters in the area as possible, keep each renter's and unit's history,
  and match renters to open units.
- Messages from the owner often start with "DDA" — it's their label for this project, not an instruction.

## Decisions made (with the owner)

| Topic | Decision |
|---|---|
| Users (v1) | Only the owner. Each Supabase Auth user sees only their own rows (RLS on `user_id = auth.uid()`). A team/shared model was offered but **not yet decided**. |
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

- **Code**: https://github.com/GS-Khaira/Rental-Desk (branch `main`). Next.js 16 (App Router, see AGENTS.md) + TypeScript, single client page with hash routes (`#home`, `#units`, `#renters`, `#owners`).
- **Database + login**: Supabase project `rental-desk`, URL `https://eqobpekulvvfsfddenhb.supabase.co` (not secret).
  Schema: `supabase/migrations/0001_initial_schema.sql` (run). `0002_match_settings.sql` (**owner must run it**; until then the app uses defaults and the Save button is disabled with a notice). New schema changes go in a new numbered migration file that the owner runs in the SQL Editor.
- **Hosting**: Vercel, https://rental-desk-urhh.vercel.app, deploys automatically on every push to `main`.
  Env vars set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
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

Checks before pushing: `npm test`, `npx tsc --noEmit`, `npm run lint`, and a build with dummy env vars:
`NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npm run build`.
The cloud session's network blocks vercel.app and supabase.co, so the owner tests the live site.

## Setup status

- [x] GitHub repo + Claude GitHub App installed on it
- [x] Supabase project, schema run, owner's login created, public sign-ups off
- [x] Vercel deployed
- [ ] Supabase Auth → URL Configuration: Site URL + redirect `https://rental-desk-urhh.vercel.app/**` (asked, not confirmed)
- [ ] Run migration `0002_match_settings.sql` in the Supabase SQL Editor
- [ ] Owner's live test checklist (sign in, add owner/property/unit/renter, match, move-in, reload) — not yet reported

## Backlog / ideas offered to the owner

- Decide: separate users (current) vs shared team with roles (Admin / Agent).
- Public "Looking for a rental?" form so renters sign themselves up (with consent) — recommended next feature.
- Same top-10 list on Renters page (top units per renter) — offered, no answer yet.
- Photos for units, map view, email/text alerts for new matches, spreadsheet import.
- Matching tweaks offered: area as hard requirement, 10% budget stretch, more criteria (utilities, furnished, laundry, lease length), weight changes.
- Consent wording: mention US data storage.
