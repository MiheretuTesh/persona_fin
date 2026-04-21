-- =============================================================================
-- Equilibrium Finance — expanded category seeds
--
-- Rationale:
--   The initial migration's category set was too thin for real everyday use
--   (no Electricity, no Side Hustle, etc.). This migration:
--     1) adds a unique index on SYSTEM categories (user_id IS NULL) so the
--        seed is idempotent — re-running it is a no-op.
--     2) expands income categories from 5 → 11.
--     3) expands expense categories from 12 → 22 (utilities broken out,
--        common line items like Mortgage, Insurance, Pets added).
--     4) backfills a default wallet for any existing user that signed up
--        before the on_auth_user_created trigger was installed.
--
-- Safe to run on a database that already has the initial migration applied —
-- nothing is destructive.
-- =============================================================================

-- (1) Idempotent seed: dedupe system categories by (name, kind).
create unique index if not exists categories_system_unique
  on public.categories (name, kind)
  where user_id is null;

-- (2,3) Insert with ON CONFLICT DO NOTHING so repeat runs are no-ops.
insert into public.categories (user_id, name, icon, color_token, kind, sort_order) values
  -- Income (sort_order 10..110)
  (null, 'Salary',          'work',              'secondary', 'income',  10),
  (null, 'Side Hustle',     'bolt',              'secondary', 'income',  20),
  (null, 'Freelance',       'laptop_mac',        'secondary', 'income',  30),
  (null, 'Bonus',           'redeem',            'secondary', 'income',  40),
  (null, 'Tips',            'volunteer_activism','secondary', 'income',  50),
  (null, 'Investments',     'trending_up',       'secondary', 'income',  60),
  (null, 'Dividends',       'pie_chart',         'secondary', 'income',  70),
  (null, 'Rental Income',   'cottage',           'secondary', 'income',  80),
  (null, 'Gifts',           'card_giftcard',     'secondary', 'income',  90),
  (null, 'Refunds',         'undo',              'secondary', 'income', 100),
  (null, 'Other Income',    'paid',              'secondary', 'income', 110),

  -- Expense (sort_order 200..410)
  (null, 'Groceries',       'shopping_cart',     'primary',   'expense', 200),
  (null, 'Dining',          'restaurant',        'tertiary',  'expense', 210),
  (null, 'Rent',            'home',              'primary',   'expense', 220),
  (null, 'Mortgage',        'apartment',         'primary',   'expense', 230),
  (null, 'Electricity',     'bolt',              'primary',   'expense', 240),
  (null, 'Water',           'water_drop',        'primary',   'expense', 250),
  (null, 'Internet',        'wifi',              'primary',   'expense', 260),
  (null, 'Phone',           'phone_iphone',      'primary',   'expense', 270),
  (null, 'Gas',             'local_gas_station', 'primary',   'expense', 280),
  (null, 'Transport',       'directions_car',    'primary',   'expense', 290),
  (null, 'Fuel',            'local_gas_station', 'primary',   'expense', 300),
  (null, 'Entertainment',   'theaters',          'tertiary',  'expense', 310),
  (null, 'Shopping',        'shopping_bag',      'tertiary',  'expense', 320),
  (null, 'Clothing',        'checkroom',         'tertiary',  'expense', 330),
  (null, 'Travel',          'flight_takeoff',    'tertiary',  'expense', 340),
  (null, 'Health',          'health_and_safety', 'secondary', 'expense', 350),
  (null, 'Pharmacy',        'medication',        'secondary', 'expense', 360),
  (null, 'Fitness',         'fitness_center',    'secondary', 'expense', 370),
  (null, 'Education',       'school',            'primary',   'expense', 380),
  (null, 'Subscriptions',   'subscriptions',     'primary',   'expense', 390),
  (null, 'Insurance',       'shield',            'primary',   'expense', 400),
  (null, 'Taxes',           'receipt_long',      'tertiary',  'expense', 405),
  (null, 'Gifts Given',     'card_giftcard',     'tertiary',  'expense', 406),
  (null, 'Pets',            'pets',              'onSurfaceVariant', 'expense', 407),
  (null, 'Childcare',       'child_care',        'onSurfaceVariant', 'expense', 408),
  (null, 'Fees',            'account_balance',   'tertiary',  'expense', 409),
  (null, 'Other',           'more_horiz',        'onSurfaceVariant', 'expense', 410),

  (null, 'Transfer',        'swap_horiz',        'onSurfaceVariant', 'transfer', 500)
on conflict (name, kind) where user_id is null do nothing;

-- (4) Defensive wallet backfill for users who signed up before the
--     on_auth_user_created trigger existed. No-op if every user already has one.
insert into public.wallets (user_id, name, icon, currency)
select u.id, 'Main Vault', 'account_balance_wallet', 'USD'
from auth.users u
where not exists (select 1 from public.wallets w where w.user_id = u.id);
