-- =============================================================================
-- Calendar system + notification preferences
--
-- Adds four cross-device preference columns to profiles:
--
--   calendar_system  — 'gregorian' | 'ethiopian'. Drives period boundaries
--                      (budget windows, month totals, insights buckets) and
--                      every date label in the UI. See src/lib/calendar.ts.
--   calendar_script  — 'amharic' | 'latin'. How Ethiopian month names render
--                      (ነሐሴ vs Nehase). Ignored when calendar_system is
--                      'gregorian'.
--   push_enabled     — master switch for OS-level local notifications.
--   inapp_enabled    — master switch for in-app banners.
--
-- All four are additive with defaults, so existing rows stay valid and the
-- migration is safe to apply to a live database. `if not exists` keeps it
-- re-runnable.
-- =============================================================================

alter table public.profiles
  add column if not exists calendar_system text not null default 'gregorian'
    check (calendar_system in ('gregorian', 'ethiopian'));

alter table public.profiles
  add column if not exists calendar_script text not null default 'amharic'
    check (calendar_script in ('amharic', 'latin'));

alter table public.profiles
  add column if not exists push_enabled boolean not null default true;

alter table public.profiles
  add column if not exists inapp_enabled boolean not null default true;

comment on column public.profiles.calendar_system is
  'Which calendar drives period boundaries and date rendering for this user.';
comment on column public.profiles.calendar_script is
  'Script for Ethiopian month names. Only meaningful when calendar_system = ''ethiopian''.';
