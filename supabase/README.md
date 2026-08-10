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
| `migrations/0004_rls_and_storage_policies.sql` | **Row Level Security** — table + storage policies | **Before any real user** |
| `migrations/0005_email_available.sql` | `email_available()` RPC — pre-signup email check (SECURITY DEFINER, RLS-safe) | Always |

### How to apply

Easiest: paste each file into the Supabase dashboard **SQL Editor** and run, in order.

Or with the Supabase CLI (if you adopt it):

```bash
supabase db push        # applies migrations/*.sql in order
```

## ⚠️ RLS is a hard gate (0004)

With RLS **off**, any authenticated client can read/write **any** row in **any**
table — including other people's location, expenses, and itinerary. During early
solo development the live project may run with RLS disabled for convenience, but
`0004` **must be applied before you send a referral code to any real friend**.

## Bootstrap (first user)

`0002` handles the root user automatically: the first-ever signup (when
`user_profiles` is empty) becomes the root with `referred_by = null` — no
referral code needed, no manual SQL insert. Verify:

```sql
select * from user_profiles;   -- exactly one row, referred_by null
```

Every subsequent signup must pass a valid `referral_code` in auth metadata.
