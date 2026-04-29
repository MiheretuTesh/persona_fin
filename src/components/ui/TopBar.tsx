import { ReactNode } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { spacing, radius, shadow, blur } from '@/theme/tokens';
import { Text } from './Text';
import { Icon, IconName } from './Icon';
import { SyncIndicator } from './SyncIndicator';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailingIcon?: IconName;
  onTrailingPress?: () => void;
  onLeadingPress?: () => void;
};

export function TopBar({ title, subtitle, leading, trailingIcon, onTrailingPress, onLeadingPress }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const bgTint = mode === 'dark' ? 'rgba(8,14,26,0.55)' : 'rgba(246,248,255,0.65)';
  const hairline = mode === 'dark' ? 'rgba(66,72,86,0.15)' : 'rgba(111,117,133,0.15)';

  return (
    <View style={[styles.root, { paddingTop: insets.top }, shadow.rim]}>
      <BlurView
        tint={mode === 'dark' ? 'dark' : 'light'}
        intensity={Platform.OS === 'ios' ? blur.medium : blur.strong}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: bgTint }]} />
      <View style={[styles.hairline, { backgroundColor: hairline }]} />
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
        <View style={styles.trailingGroup}>
          <SyncIndicator />
          {trailingIcon && (
            <Pressable onPress={onTrailingPress} style={styles.trailing} hitSlop={10}>
              <Icon name={trailingIcon} size={22} color="primary" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 50,
    overflow: 'hidden',
  },
  hairline: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
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
  trailingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  trailing: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
