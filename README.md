# Equilibrium Finance

> A premium personal-finance Vault built on the *Architectural Vault* design system.
> iOS + Android via **Expo** (React Native, TypeScript), data + auth via **Supabase**,
> visual language generated with **Stitch Design**.

![Architectural Vault palette — deep navy `#080e1a` with cyan `#a0e4fe` accents]

---

## 1. Why this stack

| Choice | Reason |
| --- | --- |
| **Expo (managed)** | The PRD mandates React Native. Expo *is* React Native — plus Keychain-backed [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/), [expo-local-authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/) for Face ID/Touch ID, EAS Build for real signed binaries, and EAS Update for OTA bug fixes. The pieces that matter for a finance app are first-party. |
| **Expo Router** | File-based navigation with typed deep-links, a proper `(auth)` / `(tabs)` route grouping, and a native modal preset for the Add Transaction flow. |
| **Zustand** | Small, explicit, no boilerplate. Only *auth* is global state in this app; server state lives in React Query where it belongs. |
| **@tanstack/react-query** | Caching, invalidation, optimistic updates, and AppState-aware focus refresh. |
| **Supabase** | Postgres + Auth + RLS that actually covers the data ownership model a finance app requires. No custom API layer to maintain. |
| **Manrope** (via `@expo-google-fonts/manrope`) | The Architectural Vault specifies Manrope across every tier. |
| **react-native-svg** | We hand-rolled the four charts we need (Donut, Sparkline, AreaChart, ProgressBar) on raw SVG — no Victory / Skia / WebView dependency. Keeps install small and avoids the Skia/React-19 version churn. |
| **react-hook-form + zod** | Validated forms with clean typing and no uncontrolled re-renders. |

Flutter and bare React Native were considered and rejected: Flutter diverges from the PRD, and bare RN would reinvent secure storage, fonts, biometrics, and build tooling that Expo has already solved.

---

## 2. Run it locally

```bash
# 1. Install
npm install

# 2. Render brand assets from SVG → PNG (icon, splash, favicon)
npm run icons

# 3. Create a .env file
cp .env.example .env
#    Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# 4. Apply the Supabase schema  (see supabase/README.md)
supabase link --project-ref YOUR-PROJECT-REF
supabase db push

# 5. Start
npm run ios       # iOS simulator (requires Xcode)
npm run android   # Android emulator (requires Android Studio)
npm start         # Expo Dev menu — scan the QR with Expo Go
```

> **First launch** — sign up with any email + password. Supabase's trigger creates a
> `profiles` row and a default *Main Vault* wallet for you, so the dashboard is
> immediately usable. Add a transaction via the cyan **+** button in the tab bar.

---

## 3. Environment

Only `EXPO_PUBLIC_*` variables are shipped to the client. The **anon key** is safe
client-side *because* every table has Row Level Security policies (see
`supabase/migrations/`). The **service-role key** bypasses RLS and must never be
added here — if you need server-side jobs, run them from a trusted environment.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | e.g. `https://xyz.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public client key |
| `EXPO_PUBLIC_DEFAULT_CURRENCY` | ISO 4217 code, e.g. `USD`. Optional, overridable in Settings. |

For EAS builds, mirror the same keys in `eas.json` → `build.*.env` — see
`https://docs.expo.dev/build-reference/variables/`.

---

## 4. Architecture

```
persona_fin/
├─ app/                       # Expo Router tree
│  ├─ _layout.tsx             #   providers + auth gate (redirects on session change)
│  ├─ index.tsx               #   boot splash + biometric unlock
│  ├─ (auth)/                 #   sign-in, sign-up
│  ├─ (tabs)/                 #   Vault, History, Budget, Insights, Settings
│  └─ transaction/new.tsx     #   Add-transaction modal
├─ src/
│  ├─ theme/                  # tokens.ts — single source of truth for DS tokens
│  ├─ lib/                    # supabase.ts, queryClient.ts, formatters.ts
│  ├─ types/                  # database.ts (mirrors Supabase schema)
│  ├─ components/
│  │  ├─ ui/                  # Button, Card, Input, Text, Icon, Screen, TopBar, GradientHero…
│  │  ├─ charts/              # Donut, Sparkline, AreaChart, ProgressBar
│  │  └─ transactions/        # TransactionRow
│  └─ features/               # domain slices — each owns its queries + mutations
│     ├─ auth/                #   store (Zustand) + schemas (zod) + biometrics
│     ├─ profile/, wallets/, categories/, transactions/, budgets/, insights/
├─ supabase/
│  ├─ migrations/             # 20260421000000_init.sql  — schema + RLS + seeds
│  └─ README.md               # apply instructions
├─ assets/
│  ├─ brand/                  # SVG sources for icon + splash
│  └─ (generated PNGs via `npm run icons`)
├─ scripts/build-icons.mjs    # Sharp-based SVG → PNG rasterizer
└─ app.json, tsconfig, …
```

**Rules of the road:**

- **Theme tokens are the single source of truth.** Never hardcode a color or size in a component — import it from `@/theme`.
- **No dividers.** Per the DS, sections are separated by background tone and whitespace, not `1px` borders.
- **Labels are UPPERCASE + `+0.05em` tracking.** Use `labelSm` / `labelMd` / `labelLg` — never set `textTransform` ad-hoc.
- **Manrope only.** Inter is explicitly excluded from the dark Architectural Vault.
- **Primary cyan is a laser pointer.** Reserve `palette.primary` for the most important action on screen.

---

## 5. Security posture

- Sessions live in **Keychain / EncryptedSharedPreferences** via `expo-secure-store`, never AsyncStorage.
- **Biometric unlock** gates app boot if the user has opted in — failed unlock signs out rather than falling open.
- **Row Level Security** on every table. The migration encodes user-scoped policies and verifies on insert that referenced wallets/categories belong to the caller (defense in depth vs. a tampered client).
- **PKCE flow** for Supabase auth — the client never holds a long-lived refresh token in the wrong place.
- The `anon` key is the only Supabase secret in the bundle. The service-role key stays server-side, always.

---

## 6. Design provenance

The design system is **Architectural Vault** from the Stitch project [*Add Transaction*](https://stitch.withgoogle.com/projects/13348944637769447180):

- Surfaces: `#080e1a` → `#0d1321` → `#121a28` → `#182030` → `#1d2637` (tonal stack, no borders).
- Primary: `#a0e4fe` (cyan teal) — sparingly, as a *laser pointer*.
- Secondary/Tertiary: `#4edea3` (income / growth), `#ff9b94` (expense / alert).
- Typography: **Manrope** — `displayLg 56/60 -1.1`, `headlineLg 28/34 -0.3`, `titleLg 18/24`, `bodyMd 14/20`, `labelSm 10 UPPERCASE +0.5`.
- Depth: Glassmorphism (`expo-blur` 20–60) on TopBar and TabBar; 135° teal gradient on the balance hero (`#004354 → #005c72`); cyan rim-light shadow on floating surfaces.
- Radius: ROUND_EIGHT scale — never 90°.

The dashboard layout (glass TopBar → balance hero → monthly summary grid with sparklines → recent transactions list → bento save-goal) is a faithful translation of the Stitch *Dashboard (Dark Mode)* screen.

---

## 7. What ships today vs. what's pending

### Ready-to-run feature set (PRD §4.1)

- Splash + root-level session gate
- Email / password sign-in + sign-up, PKCE
- Face ID / Touch ID unlock toggle
- Dashboard with Net Worth hero, monthly income/expense cards + sparklines, recent transactions
- Searchable & filterable Transaction History
- Add Transaction modal (amount + wallet + category + merchant + note, client-side validation, optimistic invalidation)
- Budget Planner with category progress bars
- Insights — donut breakdown + 6-month area trend + top categories
- Settings — biometrics toggle, preference scaffolding, sign-out

### Production follow-ups (human-in-the-loop before App Store / Play Store)

1. **Legal** — privacy policy + terms URLs in Settings. Supabase data-processing agreement if you operate in the EU.
2. **App Store submission** — EAS Build + `eas submit`, TestFlight screenshots (the Stitch screens are a good source), App Store Connect metadata, age rating, export-compliance answer.
3. **Google Play** — separate package ID / keystore, Data Safety form, monetization settings if any.
4. **Email sender** — Supabase's built-in email works for dev; switch to a production SMTP/SES/Resend provider before launch. Customize templates with the Equilibrium brand.
5. **Push notifications** — `expo-notifications` + APNs key + FCM credentials. The weekly-digest toggle in Settings is scaffolded, not wired.
6. **CI** — run `npm run typecheck` on PRs; add `eas workflows` for release builds.
7. **Wallets CRUD UI** — the schema supports multiple wallets, the UI currently shows them in the Add flow but doesn't let you create/rename/archive from Settings.
8. **Budget CRUD UI** — viewing works; the "+ New" affordance on the Budget tab is a stub.
9. **Export** — CSV / PDF download for year-end review.
10. **Account deletion** — required by Apple; call the Supabase admin API from a trusted server to cascade.
11. **Analytics + crash reporting** — Sentry (`sentry-expo`) + a privacy-respecting analytics tool.

---

## 8. Useful commands

```bash
npm run typecheck    # tsc --noEmit — zero errors expected after `npm install`
npm run ios          # cold boot in the iOS simulator
npm run android      # cold boot in an Android emulator
npm run icons        # re-render icon / splash PNGs from assets/brand/*.svg
npm run prebuild     # generate native projects (only needed for bare workflow)
supabase db reset    # reset the linked database and re-apply migrations
```

---

*Built for people who value order, precision, and privacy.*
