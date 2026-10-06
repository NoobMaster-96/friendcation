# Friendcation

A mobile app for a small friend group (~6–7 people) to coordinate a trip together —
shared itinerary, live location, and expense splitting in one place, instead of
juggling WhatsApp + Google Maps + Splitwise + TripIt.

Solo/personal project. Invite-only (referral-based signup); shared privately through TestFlight
and Google Play internal testing, not listed publicly.

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
(0001 → 0010). See [`supabase/README.md`](supabase/README.md) for details.

> ⚠️ **RLS is a hard gate.** `0008_enable_rls.sql` enables Row Level
> Security. It **must** be applied before any real friend uses the app — without it,
> anyone with the anon key can read/write everyone's data.

## Run

```bash
npm start         # dev server + QR for Expo Go
npm run ios       # or: npm run android / npm run web
```

### Install on your iPhone (standalone)

Builds a Release app with the JS bundle embedded (no dev server needed) and installs it
with Xcode's `devicectl`, which works over Wi-Fi (Expo CLI's installer can hang on
wireless devices). The iPhone must be paired with Xcode, have Developer Mode on, and
stay unlocked. Run `npx expo prebuild --platform ios` first if `ios/` doesn't exist.

```bash
xcodebuild -workspace ios/Friendcation.xcworkspace -scheme Friendcation \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build -allowProvisioningUpdates build
xcrun devicectl list devices    # copy your iPhone's Identifier
xcrun devicectl device install app --device <identifier> \
  ios/build/Build/Products/Release-iphoneos/Friendcation.app
```

> With a free Apple ID the install **expires after 7 days** — rerun the commands to reinstall.

## Release to friends (TestFlight + Play internal testing)

Store builds are made in the cloud with [EAS](https://docs.expo.dev/build/introduction/) using
`eas.json` (`production` profile; build numbers auto-increment on EAS). Nothing is listed publicly.

> ⚠️ Apply the RLS migration before inviting anyone — the anon key ships inside the app.

**One-time setup**

1. Accounts: Apple Developer Program (paid), Google Play Console, and a free Expo account.
2. `npx eas-cli@latest login`, then `npx eas-cli@latest init` to link the project.
3. `.env` isn't committed, so give EAS the Supabase settings:
   ```bash
   npx eas-cli@latest env:set --environment production --visibility plaintext \
     --name EXPO_PUBLIC_SUPABASE_URL --value <project URL>
   npx eas-cli@latest env:set --environment production --visibility plaintext \
     --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
   ```
4. Android: create the app in Play Console and give EAS a
   [Google Service Account key](https://expo.fyi/creating-google-service-account).

**iOS → TestFlight**

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

Then in App Store Connect → TestFlight, add friends as external testers (the first build gets a
short beta review). TestFlight builds expire after 90 days.

**Android → Play internal testing**

```bash
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android
```

The first submission creates a release on the internal testing track (up to 100 testers, no
review). Add testers' Google accounts in Play Console and share the opt-in link. The Play listing
icon is `assets/store/playstore-512.png`.

## Project structure

```
app/                   Expo Router routes (_layout.tsx, index.tsx)
context/AuthContext    Supabase session provider (useAuth hook)
lib/supabase.ts        Supabase client
lib/theme.ts           Design tokens (terracotta accent, sage success)
plugins/               Local Expo config plugins (iOS 27 UIScene adoption)
assets/                App icons (light/dark, Android adaptive + themed), splash, store icon
eas.json               EAS build/submit profiles (preview APK, production store builds)
supabase/migrations/   Version-controlled SQL (schema, trigger, storage, RLS)
```

## Status

Groundwork scaffolded: the Expo Router app boots, Supabase client + auth session
wiring are in place, and all SQL migrations are version-controlled. Feature screens
(referral signup, itinerary, live location, expense manager) are next.