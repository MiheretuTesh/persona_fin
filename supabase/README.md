# Supabase — Equilibrium Finance

## 1. Create the project

1. [supabase.com](https://supabase.com) → New project. Region closest to your users.
2. Grab `Project URL` and `anon` public key from **Project Settings → API**.
3. Paste both into `.env` at the repo root (copy from `.env.example`).

## 2. Apply the schema

Pick whichever path fits your workflow.

### a) Supabase CLI (recommended)

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

### b) Dashboard SQL editor

Open **SQL editor** in the Supabase dashboard and paste the entire contents of
`migrations/20260421000000_init.sql`, then **Run**.

## 3. Verify Row Level Security

Every table in this migration has RLS enabled and user-scoped policies. You can
confirm with:

```sql
select relname, relrowsecurity
from pg_class
where relname in ('profiles','wallets','categories','transactions','budgets');
-- all rows should have relrowsecurity = t
```

Without these policies the anon key would let any authenticated client read
every user's data — do not disable them.

## 4. Auth configuration

In **Authentication → Providers → Email**:
- Enable **Email** (password).
- **Turn OFF "Confirm email"** so new users land in the app immediately after
  signup — no inbox round-trip. This is a deliberate trade-off for the current
  MVP; see "Security trade-off" below.
- Set **Site URL** to `equilibrium://` (scheme defined in `app.json`) so
  password-reset deep-links land back in the app.

### Security trade-off of disabling email confirmation

With "Confirm email" off, a user can sign up with an email they do not own.
Real risks:
- The account cannot receive password-reset links until the email is verified
  (Supabase still requires verification for reset flows).
- Someone typing a typo'd address creates an orphan account on the real
  owner's email.
- Breaks deliverability reputation — Supabase rate-limits unverified sends.

Before production, re-enable confirmation and change the signup flow to show a
"check your inbox" state (trivial revert — the code path is already present in
`app/(auth)/sign-up.tsx`'s `onSubmit`).

## 5. That's it

The `on_auth_user_created` trigger in the migration automatically creates a
`profiles` row and a seeded `Main Vault` wallet the moment a new user signs up,
so the app's first post-signup render shows a clean, usable empty dashboard
rather than a "no wallets" error.
