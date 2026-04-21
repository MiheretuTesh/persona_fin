import { ReactNode, useRef } from 'react';
import { Pressable, View, ActivityIndicator, StyleSheet, ViewStyle, GestureResponderEvent, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { palette, radius, spacing, type } from '@/theme';
import { Text } from './Text';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type Props = {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: IconName;
  rightIcon?: IconName;
  fullWidth?: boolean;
  haptic?: 'light' | 'medium' | 'success' | 'none';
  style?: ViewStyle;
};

/**
 * Primary: gradient-filled cyan CTA. Secondary: submerged (surfaceContainerHigh
 * + primary text). Ghost: no background. Danger: error-surface filled.
 *
 * All press states use a 96% scale-down and an optional haptic — matches the
 * Stitch active:scale-95 duration-200 motif.
 */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  leftIcon,
  rightIcon,
  fullWidth,
  haptic = 'light',
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to: number) =>
    Animated.timing(scale, {
      toValue: to,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const handlePress = (e: GestureResponderEvent) => {
    if (disabled || loading) return;
    if (haptic !== 'none') {
      const style =
        haptic === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : haptic === 'medium'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
      if (haptic === 'success') Haptics.notificationAsync(style as Haptics.NotificationFeedbackType);
      else Haptics.impactAsync(style as Haptics.ImpactFeedbackStyle);
    }
    onPress?.(e);
  };

  const height = size === 'lg' ? 56 : 48;
  const textColor = variant === 'primary' ? 'onPrimary' : variant === 'danger' ? 'onError' : variant === 'secondary' ? 'primary' : 'onSurface';

  const body = (
    <View style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.onPrimary : palette.primary} />
      ) : (
        <>
          {leftIcon && <Icon name={leftIcon} size={20} color={textColor} />}
          <Text variant={size === 'lg' ? 'titleMd' : 'titleSm'} color={textColor}>
            {children}
          </Text>
          {rightIcon && <Icon name={rightIcon} size={20} color={textColor} />}
        </>
      )}
    </View>
  );

  const base: ViewStyle = {
    height,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
  };

  return (
    <Animated.View style={[{ transform: [{ scale }], alignSelf: fullWidth ? 'stretch' : 'flex-start' }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={[...palette.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={base}
          >
            {body}
          </LinearGradient>
        ) : variant === 'danger' ? (
          <View style={[base, { backgroundColor: palette.errorContainer }]}>{body}</View>
        ) : variant === 'secondary' ? (
          <View style={[base, { backgroundColor: palette.surfaceContainerHigh }]}>{body}</View>
        ) : (
          <View style={[base, { backgroundColor: 'transparent' }]}>{body}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
