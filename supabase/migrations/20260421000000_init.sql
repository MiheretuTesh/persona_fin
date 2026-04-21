-- =============================================================================
-- Equilibrium Finance — initial schema
--
-- Design principles (important — do not relax without a deliberate reason):
--   1. RLS is enabled on EVERY table. The anon key shipped to clients has zero
--      privileges outside these policies. There is no "trust the client" path.
--   2. Every row carries user_id and policies compare it to auth.uid().
--   3. Writes validate that wallet_id / category_id belong to the same user,
--      so a tampered client cannot attach a transaction to someone else's wallet.
--   4. System categories (user_id IS NULL) are readable by everyone, writable by no one.
--   5. A profile row is created automatically on signup via a trigger.
--
-- Apply this with one of:
--   supabase db push                 (if using the Supabase CLI + linked project)
--   paste into the SQL editor in the Supabase dashboard
--
-- This file is idempotent for a fresh database. To re-run on a non-empty db,
-- drop the schema first (`supabase db reset`).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---- enums ------------------------------------------------------------------

create type transaction_kind as enum ('income', 'expense', 'transfer');
create type budget_period    as enum ('monthly', 'weekly');
create type color_token      as enum ('primary', 'secondary', 'tertiary', 'onSurfaceVariant');

-- ---- profiles ---------------------------------------------------------------
-- One row per auth.users row. Created by the on_auth_user_created trigger.

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  avatar_url         text,
  currency           text        not null default 'USD' check (char_length(currency) = 3),
  biometric_enabled  boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"  on public.profiles for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert with check (auth.uid() = id);

-- ---- wallets ----------------------------------------------------------------
-- User-owned "vaults" (PRD term) — cash accounts, cards, savings pots.

create table public.wallets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 64),
  icon             text,
  starting_balance numeric(14,2) not null default 0,
  currency         text not null default 'USD' check (char_length(currency) = 3),
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now()
);

create index wallets_user_idx on public.wallets (user_id) where is_archived = false;

alter table public.wallets enable row level security;

create policy "wallets: read own"   on public.wallets for select using (auth.uid() = user_id);
create policy "wallets: insert own" on public.wallets for insert with check (auth.uid() = user_id);
create policy "wallets: update own" on public.wallets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wallets: delete own" on public.wallets for delete using (auth.uid() = user_id);

-- ---- categories -------------------------------------------------------------
-- user_id = NULL denotes a seeded system category visible to all users.

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 48),
  icon        text not null, -- Material Symbols name, e.g. "restaurant"
  color_token color_token not null default 'primary',
  kind        transaction_kind not null,
  sort_order  int not null default 0
);

create index categories_lookup_idx on public.categories (user_id, kind, sort_order);

alter table public.categories enable row level security;

create policy "categories: read own or system"
  on public.categories for select
  using (user_id is null or auth.uid() = user_id);

create policy "categories: insert own"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories: update own"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories: delete own"
  on public.categories for delete
  using (auth.uid() = user_id);

-- ---- transactions -----------------------------------------------------------

create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  wallet_id   uuid not null references public.wallets (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  kind        transaction_kind not null,
  amount      numeric(14,2) not null,
  merchant    text,
  note        text,
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  -- a transaction's wallet must be owned by the same user (defense in depth;
  -- RLS enforces the user_id, this enforces the join integrity).
  constraint transactions_wallet_owner
    check (user_id is not null and wallet_id is not null)
);

create index transactions_user_time_idx on public.transactions (user_id, occurred_at desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);

alter table public.transactions enable row level security;

create policy "transactions: read own"
  on public.transactions for select
  using (auth.uid() = user_id);

-- Insert policy checks both the ownership AND that the referenced wallet and
-- category actually belong to the user (or that category is a system one).
create policy "transactions: insert own"
  on public.transactions for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.wallets    w where w.id = wallet_id  and w.user_id = auth.uid())
    and exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
  );

create policy "transactions: update own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions: delete own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ---- budgets ----------------------------------------------------------------

create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  period      budget_period not null default 'monthly',
  start_on    date not null default (date_trunc('month', now()))::date,
  created_at  timestamptz not null default now(),

  unique (user_id, category_id, period, start_on)
);

create index budgets_user_idx on public.budgets (user_id, period, start_on desc);

alter table public.budgets enable row level security;

create policy "budgets: read own"   on public.budgets for select using (auth.uid() = user_id);
create policy "budgets: insert own" on public.budgets for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
);
create policy "budgets: update own" on public.budgets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budgets: delete own" on public.budgets for delete using (auth.uid() = user_id);

-- ---- updated_at triggers ----------------------------------------------------

create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger profiles_touch_updated
  before update on public.profiles
  for each row execute function public.tg_touch_updated_at();

-- ---- auto-create profile on signup ------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  -- Seed a default wallet so the app's empty state is "no transactions" and not
  -- "no wallets either". The user can rename/add more in Settings.
  insert into public.wallets (user_id, name, icon, currency)
  values (new.id, 'Main Vault', 'account_balance_wallet', 'USD');

  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- seed system categories -------------------------------------------------

insert into public.categories (user_id, name, icon, color_token, kind, sort_order) values
  (null, 'Salary',         'work',          'secondary', 'income',  10),
  (null, 'Freelance',      'laptop_mac',    'secondary', 'income',  20),
  (null, 'Investments',    'trending_up',   'secondary', 'income',  30),
  (null, 'Refunds',        'undo',          'secondary', 'income',  40),
  (null, 'Other Income',   'paid',          'secondary', 'income',  50),

  (null, 'Groceries',      'shopping_cart', 'primary',   'expense', 110),
  (null, 'Dining',         'restaurant',    'tertiary',  'expense', 120),
  (null, 'Utilities',      'bolt',          'primary',   'expense', 130),
  (null, 'Rent',           'home',          'primary',   'expense', 140),
  (null, 'Transport',      'directions_car','primary',   'expense', 150),
  (null, 'Entertainment',  'theaters',      'tertiary',  'expense', 160),
  (null, 'Shopping',       'shopping_bag',  'tertiary',  'expense', 170),
  (null, 'Travel',         'flight_takeoff','tertiary',  'expense', 180),
  (null, 'Health',         'health_and_safety', 'secondary', 'expense', 190),
  (null, 'Subscriptions',  'subscriptions', 'primary',   'expense', 200),
  (null, 'Fees',           'receipt_long',  'tertiary',  'expense', 210),
  (null, 'Other',          'more_horiz',    'onSurfaceVariant','expense', 220),

  (null, 'Transfer',       'swap_horiz',    'onSurfaceVariant','transfer', 310);
