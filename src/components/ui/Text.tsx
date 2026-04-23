import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { type TypeToken, type Color, type as typeScale } from '@/theme/tokens';

type TextProps = RNTextProps & {
  variant?: TypeToken;
  color?: Color;
  center?: boolean;
};

export function Text({ variant = 'bodyMd', color = 'onSurface', center, style, ...rest }: TextProps) {
  const colors = useColors();
  return (
    <RNText
      {...rest}
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      style={[
        styles.base,
        typeScale[variant],
        { color: colors[color] as string },
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
