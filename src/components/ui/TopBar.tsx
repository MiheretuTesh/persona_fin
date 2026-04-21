import { ReactNode } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, spacing, radius, shadow, blur } from '@/theme';
import { Text } from './Text';
import { Icon, IconName } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode; // usually the user avatar
  trailingIcon?: IconName;
  onTrailingPress?: () => void;
  onLeadingPress?: () => void;
};

/**
 * Fixed, translucent top bar. Matches the Stitch header pattern:
 * backdrop-blur-xl, 60% bg-opacity, rim-shadow below.
 */
export function TopBar({ title, subtitle, leading, trailingIcon, onTrailingPress, onLeadingPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <BlurView
        tint="dark"
        intensity={Platform.OS === 'ios' ? blur.medium : blur.strong}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bg} />
      <View style={styles.row}>
        <Pressable onPress={onLeadingPress} style={styles.leading} hitSlop={8}>
          {leading}
          <View style={{ flexShrink: 1 }}>
            {subtitle && (
              <Text variant="bodySm" color="onSurfaceVariant">
                {subtitle}
              </Text>
            )}
            <Text variant="titleLg" color="onSurface" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </Pressable>
        {trailingIcon && (
          <Pressable onPress={onTrailingPress} style={styles.trailing} hitSlop={10}>
            <Icon name={trailingIcon} size={22} color="primary" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    overflow: 'hidden',
    ...shadow.rim,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,14,26,0.55)',
  },
  row: {
    height: 64,
    paddingHorizontal: spacing[6],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  trailing: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
