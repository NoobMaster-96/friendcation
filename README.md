# Friendcation

A mobile app for a small friend group (~6–7 people) to coordinate a trip together —
shared itinerary, live location, and expense splitting in one place, instead of
juggling WhatsApp + Google Maps + Splitwise + TripIt.

Solo/personal project. Invite-only (referral-based signup), not published to app stores.

## Stack

- **Frontend:** React Native via Expo (SDK 57) + Expo Router (file-based routing)
- **Backend:** Supabase — Postgres + Auth + Realtime + Storage
- **Language:** TypeScript

## Prerequisites

- Node 20 (pinned per-project via [Volta](https://volta.sh) in `package.json`)
- A Supabase project (free tier is fine)
- Expo Go on your phone, or an iOS/Android simulator

## Setup

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
```

### Apply the database schema

Run the SQL in `supabase/migrations/` against your Supabase project **in order**
(0001 → 0004). See [`supabase/README.md`](supabase/README.md) for details.

> ⚠️ **RLS is a hard gate.** `0004_rls_and_storage_policies.sql` enables Row Level
> Security. It **must** be applied before any real friend uses the app — without it,
> anyone with the anon key can read/write everyone's data.

## Run

```bash
npm start         # dev server + QR for Expo Go
npm run ios       # or: npm run android / npm run web
```

## Project structure

```
app/                   Expo Router routes (_layout.tsx, index.tsx)
context/AuthContext    Supabase session provider (useAuth hook)
lib/supabase.ts        Supabase client
lib/theme.ts           Design tokens (terracotta accent, sage success)
supabase/migrations/   Version-controlled SQL (schema, trigger, storage, RLS)
```

## Status

Groundwork scaffolded: the Expo Router app boots, Supabase client + auth session
wiring are in place, and all SQL migrations are version-controlled. Feature screens
(referral signup, itinerary, live location, expense manager) are next.