# DDA Rental Desk

A private web app for a PEI rental manager: owners → properties → units, renters,
renter ↔ unit matching, tenancy history and maintenance logs.

**Stack:** Next.js (React + TypeScript) · Supabase (PostgreSQL, login) · Vercel (hosting).

## How it's put together

| Path | What it is |
|---|---|
| `supabase/migrations/` | Database changes, run once each, in order, in Supabase's SQL Editor. |
| `src/lib/match.ts` | Matching rules and scoring. Defaults: budget 35, bedrooms 25, area 20, pets 10, parking 5, move-in 5. Adjustable on the Matching tab. |
| `src/lib/store.tsx` | Loads and saves records through Supabase. |
| `src/components/` | Screens: Today, Units, Renters, Owners, detail panels and forms. |
| `tests/` | Tests for the matching rules (`npm test`). |

## Run it locally

```bash
cp .env.example .env.local   # then fill in the two values
npm install
npm run dev
```

## Privacy

- Every row is tied to the signed-in account, and Row Level Security blocks everyone else.
- Public sign-ups should be turned **off** in Supabase (Authentication → Sign In / Providers).
- No fields for protected grounds under the PEI Human Rights Act.
- Each renter has "Copy their data" and "Delete renter" for PIPEDA requests.
