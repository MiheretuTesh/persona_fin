import { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { spacing, radius } from '@/theme/tokens';
import { Text } from './Text';
import { useSyncStatus } from '@/features/sync/status';

/**
 * Tiny status pip for the TopBar.
 *
 *   - synced  → nothing rendered (cleanest UI)
 *   - syncing → cyan pulsing dot
 *   - offline → coral dot + "Offline · N pending" pill
 */
export function SyncIndicator() {
  const { colors } = useTheme();
  const { status, pendingMutations } = useSyncStatus();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (status !== 'syncing') {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, opacity]);

  if (status === 'synced') return null;

  if (status === 'offline') {
    return (
      <View style={[styles.pill, { backgroundColor: colors.tertiaryContainer }]}>
        <View style={[styles.dot, { backgroundColor: colors.tertiary }]} />
        <Text variant="labelSm" color="onTertiaryContainer">
          Offline{pendingMutations > 0 ? ` · ${pendingMutations} pending` : ''}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.dotWrap, { opacity }]}>
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
  dotWrap: { paddingHorizontal: spacing[2] },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
