import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { palette, type, type TypeToken, type Color } from '@/theme';

type TextProps = RNTextProps & {
  variant?: TypeToken;
  color?: Color;
  center?: boolean;
};

/**
 * Typed, token-driven text. Consumers should never pass `fontFamily` or
 * `fontSize` directly — use a `variant` so type stays consistent across screens.
 */
export function Text({ variant = 'bodyMd', color = 'onSurface', center, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      style={[
        styles.base,
        type[variant],
        { color: palette[color] },
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
  center: { textAlign: 'center' },
});
