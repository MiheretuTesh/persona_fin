import { ReactNode, useRef } from 'react';
import {
  Pressable,
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
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
  const colors = useColors();
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
      if (haptic === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (haptic === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    onPress?.(e);
  };

  const height = size === 'lg' ? 56 : 48;
  const textColor =
    variant === 'primary'
      ? 'onPrimary'
      : variant === 'danger'
        ? 'onError'
        : variant === 'secondary'
          ? 'primary'
          : 'onSurface';

  const body = (
    <View style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
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
            colors={[...colors.primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={base}
          >
            {body}
          </LinearGradient>
        ) : variant === 'danger' ? (
          <View style={[base, { backgroundColor: colors.errorContainer }]}>{body}</View>
        ) : variant === 'secondary' ? (
          <View style={[base, { backgroundColor: colors.surfaceContainerHigh }]}>{body}</View>
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
