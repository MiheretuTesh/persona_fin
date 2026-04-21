/**
 * Architectural Vault — design tokens.
 *
 * This file is the single source of truth for color, type, spacing, radius
 * and shadow. It is derived directly from the Stitch "Architectural Vault"
 * design system (dark, vibrant variant) and the PRD §5 palette.
 *
 * Rules encoded here (do not bypass without reason):
 *   — No 1px borders for sectioning; define boundaries with background shifts.
 *   — Depth is created by surface tone stacking, not heavy drop shadows.
 *   — Labels are UPPERCASE with +0.05em tracking.
 *   — Manrope everywhere; Inter is NOT part of this dark system.
 *   — Primary cyan is a laser pointer — sparing, for the most important action.
 */

export const palette = {
  // base surfaces (deepest → highest) — the "carved volume" stack
  surface: '#080e1a',
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#0d1321',
  surfaceContainer: '#121a28',
  surfaceContainerHigh: '#182030',
  surfaceContainerHighest: '#1d2637',
  surfaceBright: '#232c3f',
  surfaceDim: '#080e1a',

  // typography on surface
  onSurface: '#e6ebfc',
  onSurfaceVariant: '#a5abbb',

  // primary — cyan teal (the laser pointer)
  primary: '#a0e4fe',
  primaryContainer: '#66aac2',
  primaryDim: '#92d6ef',
  onPrimary: '#005468',
  onPrimaryContainer: '#002732',

  // secondary — growth / income
  secondary: '#4edea3',
  secondaryContainer: '#006689',
  onSecondary: '#003824',
  onSecondaryContainer: '#f1f9ff',

  // tertiary — alert / expense
  tertiary: '#ff9b94',
  tertiaryContainer: '#410002',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#ffb4ab',

  // system
  outline: '#707585',
  outlineVariant: '#424856',
  error: '#ff716c',
  errorContainer: '#9f0519',
  onError: '#490006',

  // hero balance card gradient
  heroGradient: ['#004354', '#005c72'] as const, // 135°
  primaryGradient: ['#a0e4fe', '#66aac2'] as const,
  scrimGradient: ['rgba(8,14,26,0.0)', 'rgba(8,14,26,0.85)'] as const,
} as const;

export type Color = keyof typeof palette;

/** Opacity overlays applied atop a named color — kept tiny to match the DS. */
export const alpha = {
  ghostBorder: 0.15, // outlineVariant at 15% — "felt, not seen"
  glass: 0.6,
  pressed: 0.08,
  hairline: 0.1,
} as const;

/** 4-pt rhythm. Usage: spacing[6] === 24. Mirrors the Stitch scale. */
export const spacing = {
  0: 0,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

/** Corner radii — strictly adhere to the ROUND_EIGHT scale. */
export const radius = {
  xs: 4,
  sm: 8, // DS "DEFAULT"
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  pill: 9999,
} as const;

/** Typography. All Manrope for this dark system (per DS). */
export const type = {
  displayLg: { fontFamily: 'Manrope_800ExtraBold', fontSize: 56, lineHeight: 60, letterSpacing: -1.1 },
  displayMd: { fontFamily: 'Manrope_800ExtraBold', fontSize: 44, lineHeight: 48, letterSpacing: -0.9 },
  displaySm: { fontFamily: 'Manrope_700Bold', fontSize: 36, lineHeight: 40, letterSpacing: -0.7 },
  headlineLg: { fontFamily: 'Manrope_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  headlineMd: { fontFamily: 'Manrope_700Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  headlineSm: { fontFamily: 'Manrope_700Bold', fontSize: 20, lineHeight: 26, letterSpacing: 0 },
  titleLg: { fontFamily: 'Manrope_600SemiBold', fontSize: 18, lineHeight: 24 },
  titleMd: { fontFamily: 'Manrope_600SemiBold', fontSize: 16, lineHeight: 22 },
  titleSm: { fontFamily: 'Manrope_600SemiBold', fontSize: 14, lineHeight: 20 },
  bodyLg: { fontFamily: 'Manrope_500Medium', fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: 'Manrope_500Medium', fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 18 },
  labelLg: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  labelMd: { fontFamily: 'Manrope_600SemiBold', fontSize: 11, lineHeight: 14, letterSpacing: 0.55, textTransform: 'uppercase' as const },
  labelSm: { fontFamily: 'Manrope_700Bold', fontSize: 10, lineHeight: 12, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  mono: { fontFamily: 'Manrope_500Medium', fontSize: 14, lineHeight: 20 },
} as const;

export type TypeToken = keyof typeof type;

/**
 * Shadows — ambient luminance, not drop shadows. The second "shadow" is a
 * rim-light effect using the primary tone (iOS only, RN Android clamps to one).
 */
export const shadow = {
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 12,
  },
  lifted: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  rim: {
    shadowColor: '#a0e4fe',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 0,
  },
} as const;

/** Blur amounts for glassmorphism. expo-blur `intensity` is 0-100. */
export const blur = {
  subtle: 20,
  medium: 40,
  strong: 60,
} as const;
