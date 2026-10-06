# Supabase — schema & migrations

SQL for the Friendcation backend (Postgres + Auth + Realtime + Storage).
Transcribed from the handoff doc (§4, §5, §7, §8).

## Apply order

Run these against your Supabase project **in order**:

| File | What it does | Apply when |
| ---- | ------------ | ---------- |
| `migrations/0001_schema.sql` | 9 core tables | Always |
| `migrations/0002_signup_trigger.sql` | Referral-based signup trigger on `auth.users` | Always |
| `migrations/0003_storage.sql` | Private `itinerary-attachments` storage bucket | Always |
| `migrations/0004_rls_and_storage_policies.sql` | No-op — superseded by `0008` (kept so numbering stays in order) | — |
| `migrations/0005_email_available.sql` | `email_available()` RPC — pre-signup email check (SECURITY DEFINER, RLS-safe) | Always |
| `migrations/0006_itinerary_item_participants.sql` | `itinerary_item_participants` join table (the "People" on an itinerary item) | Always |
| `migrations/0007_itinerary_attachments_storage.sql` | `storage.objects` read/insert/delete policies for the attachments bucket | **Always** (attachment upload fails without it) |
| `migrations/0008_enable_rls.sql` | **Row Level Security** for every table, membership helpers, and the `join_trip_by_code` / `add_trip_member_by_email` RPCs | **Before any real user** |
| `migrations/0009_expenses_editable_by_members.sql` | Any trip member can edit/delete expenses and splits; atomic `save_expense()` RPC | After 0008 |
| `migrations/0010_invite_codes.sql` | Invite-code checks for the invite-first Create account flow: each user's 6-character referral code gets an optional use limit + expiry (`invite_codes`), `verify_invite_code()` for step 1, and the signup trigger validates and consumes the invite | After 0008 |

### How to apply

Easiest: paste each file into the Supabase dashboard **SQL Editor** and run, in order.

Or with the Supabase CLI (if you adopt it):

```bash
supabase db push        # applies migrations/*.sql in order
```

## ⚠️ RLS is a hard gate (0008)

With RLS **off**, any authenticated client can read/write **any** row in **any**
table — including other people's location, expenses, and itinerary. During early
solo development the live project may run with RLS disabled for convenience, but
`0008` **must be applied before you send an invite code to any real friend**.
It also adds the RPCs the app now uses to join by invite code and add people by email.

## Bootstrap (first user)

`0002` handles the root user automatically: the first-ever signup (when
`user_profiles` is empty) becomes the root with `referred_by = null` — no
referral code needed, no manual SQL insert. Verify:

```sql
select * from user_profiles;   -- exactly one row, referred_by null
```

Every subsequent signup must pass a valid `referral_code` in auth metadata.
