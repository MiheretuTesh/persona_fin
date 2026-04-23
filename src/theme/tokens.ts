/**
 * Architectural Vault — design tokens (dark + light).
 *
 * Two palettes, one shape. `palette` is the legacy dark-only export kept for
 * backwards compatibility; new code should use `useTheme()` from
 * `ThemeProvider.tsx` to read the live palette for the current mode.
 */

export type ThemeMode = 'dark' | 'light';

/**
 * Explicit shape for a palette. Both `darkColors` and `lightColors` conform to
 * this, so `colorsForMode()` can return either without TypeScript complaining
 * about literal-type mismatches between the two.
 */
export type Colors = {
  mode: ThemeMode;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceBright: string;
  surfaceDim: string;
  onSurface: string;
  onSurfaceVariant: string;
  primary: string;
  primaryContainer: string;
  primaryDim: string;
  onPrimary: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;
  tertiary: string;
  tertiaryContainer: string;
  onTertiary: string;
  onTertiaryContainer: string;
  outline: string;
  outlineVariant: string;
  error: string;
  errorContainer: string;
  onError: string;
  heroGradient: readonly [string, string];
  primaryGradient: readonly [string, string];
  scrimGradient: readonly [string, string];
};

/** Dark mode — the primary design intent, per PRD §5 and Stitch "Architectural Vault". */
export const darkColors: Colors = {
  mode: 'dark',

  surface: '#080e1a',
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#0d1321',
  surfaceContainer: '#121a28',
  surfaceContainerHigh: '#182030',
  surfaceContainerHighest: '#1d2637',
  surfaceBright: '#232c3f',
  surfaceDim: '#080e1a',

  onSurface: '#e6ebfc',
  onSurfaceVariant: '#a5abbb',

  primary: '#a0e4fe',
  primaryContainer: '#66aac2',
  primaryDim: '#92d6ef',
  onPrimary: '#000000',
  onPrimaryContainer: '#ffffff',

  secondary: '#4edea3',
  secondaryContainer: '#006689',
  onSecondary: '#003824',
  onSecondaryContainer: '#f1f9ff',

  tertiary: '#ff9b94',
  tertiaryContainer: '#410002',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#ffb4ab',

  outline: '#707585',
  outlineVariant: '#424856',
  error: '#ff716c',
  errorContainer: '#9f0519',
  onError: '#490006',

  heroGradient: ['#004354', '#005c72'],
  primaryGradient: ['#a0e4fe', '#66aac2'],
  scrimGradient: ['rgba(8,14,26,0.0)', 'rgba(8,14,26,0.85)'],
};

/** Light mode — the Financial Atelier variant from the Stitch project. */
export const lightColors: Colors = {
  mode: 'light',

  surface: '#f6f8ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#eff3ff',
  surfaceContainer: '#e7eeff',
  surfaceContainerHigh: '#dee8ff',
  surfaceContainerHighest: '#d8e3fb',
  surfaceBright: '#ffffff',
  surfaceDim: '#cfdaf2',

  onSurface: '#111c2d',
  onSurfaceVariant: '#4a5568',

  primary: '#004354',
  primaryContainer: '#005c72',
  primaryDim: '#18667d',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#ffffff',

  secondary: '#006c49',
  secondaryContainer: '#6cf8bb',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#00281b',

  tertiary: '#c0302b',
  tertiaryContainer: '#ffdad6',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#5a0007',

  outline: '#70787d',
  outlineVariant: '#bfc8cc',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',

  // Hero keeps the signature deep-teal gradient in light mode too — it becomes
  // a "contrast island" against the lighter background, which is what premium
  // fintech products (Monzo, Revolut, Copilot) do.
  heroGradient: ['#004354', '#005c72'],
  primaryGradient: ['#004354', '#005c72'],
  scrimGradient: ['rgba(246,248,255,0.0)', 'rgba(246,248,255,0.85)'],
};

export type Color = Exclude<keyof Colors, 'mode' | 'heroGradient' | 'primaryGradient' | 'scrimGradient'>;

/** Legacy / dark-only export. New code should use `useTheme().colors`. */
export const palette = darkColors;

export const alpha = {
  ghostBorder: 0.15,
  glass: 0.6,
  pressed: 0.08,
  hairline: 0.1,
} as const;

export const spacing = {
  0: 0, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
  8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96,
} as const;

export const radius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, pill: 9999,
} as const;

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

export const shadow = {
  floating: {
    shadowColor: '#000000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4, shadowRadius: 32, elevation: 12,
  },
  lifted: {
    shadowColor: '#000000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 6,
  },
  rim: {
    shadowColor: '#a0e4fe', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 24, elevation: 0,
  },
} as const;

export const blur = { subtle: 20, medium: 40, strong: 60 } as const;

export function colorsForMode(mode: ThemeMode): Colors {
  return mode === 'light' ? lightColors : darkColors;
}
