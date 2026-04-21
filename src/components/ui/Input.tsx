import { forwardRef, useState } from 'react';
import { TextInput, TextInputProps, View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { palette, radius, spacing, type } from '@/theme';
import { Text } from './Text';
import { Icon, IconName } from './Icon';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  style?: ViewStyle;
};

/**
 * Input architecture (per DS):
 *   — surface_container_low background, no four-sided border
 *   — 2px bottom bar of surface_container_highest
 *   — on focus, bottom bar transitions to secondary (cyan glow) via color swap
 *   — on error, bottom bar becomes error, label flips to error
 */
export const Input = forwardRef<TextInput, Props>(function Input(
  { label, hint, error, leftIcon, rightIcon, onRightIconPress, style, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const barColor = error
    ? palette.error
    : focused
      ? palette.secondary
      : palette.surfaceContainerHighest;

  return (
    <View style={[styles.wrap, style]}>
      {label && (
        <Text variant="labelMd" color={error ? 'error' : 'onSurfaceVariant'} style={styles.label}>
          {label}
        </Text>
      )}
      <View style={[styles.field, { borderBottomColor: barColor }]}>
        {leftIcon && (
          <View style={styles.sideIcon}>
            <Icon name={leftIcon} size={20} color="onSurfaceVariant" />
          </View>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={palette.onSurfaceVariant}
          selectionColor={palette.primary}
          cursorColor={palette.primary}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={styles.input}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} hitSlop={8} style={styles.sideIcon}>
            <Icon name={rightIcon} size={20} color="onSurfaceVariant" />
          </Pressable>
        )}
      </View>
      {(error || hint) && (
        <Text variant="bodySm" color={error ? 'error' : 'onSurfaceVariant'} style={styles.hint}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing[1.5] },
  label: { paddingLeft: spacing[1] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surfaceContainerLow,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderBottomLeftRadius: radius.xs,
    borderBottomRightRadius: radius.xs,
    borderBottomWidth: 2,
    paddingHorizontal: spacing[4],
    minHeight: 56,
  },
  input: {
    flex: 1,
    color: palette.onSurface,
    ...type.bodyLg,
    paddingVertical: spacing[3],
  },
  sideIcon: { paddingHorizontal: spacing[2] },
  hint: { paddingLeft: spacing[1] },
});
