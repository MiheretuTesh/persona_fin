import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/theme';
import { spacing, radius } from '@/theme/tokens';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import type { Banner } from '@/features/notifications/store';

/**
 * Single in-app banner. Slides down from the top with a small bounce, holds
 * for `autoDismissMs` (or sticks if 0), then slides back up. Tappable to
 * dismiss; the optional CTA fires `action.onPress` and dismisses.
 *
 * Visual language matches the existing SyncIndicator pill — flat surface
 * with a tone-colored icon tile, no heavy shadow.
 */

const TONE_DEFAULTS: Record<Banner['tone'], { icon: IconName; color: 'primary' | 'secondary' | 'tertiary' }> = {
  info: { icon: 'info', color: 'primary' },
  success: { icon: 'check_circle', color: 'secondary' },
  warn: { icon: 'warning', color: 'tertiary' },
  danger: { icon: 'error', color: 'tertiary' },
};

export function InAppBanner({
  banner,
  onDismiss,
  topOffset,
}: {
  banner: Banner;
  onDismiss: (id: string) => void;
  /** Stack offset for multiple banners — added to safe area inset. */
  topOffset: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translate = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const tone = TONE_DEFAULTS[banner.tone];
  const iconName = (banner.icon as IconName | undefined) ?? tone.icon;

  useEffect(() => {
    if (banner.tone === 'danger') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    else if (banner.tone === 'warn') Haptics.selectionAsync().catch(() => {});

    Animated.parallel([
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    if (banner.autoDismissMs && banner.autoDismissMs > 0) {
      const t = setTimeout(() => slideOut(), banner.autoDismissMs);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function slideOut() {
    Animated.parallel([
      Animated.timing(translate, { toValue: -120, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onDismiss(banner.id));
  }

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          top: insets.top + topOffset,
          transform: [{ translateY: translate }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={slideOut}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconTile,
            { backgroundColor: colors.mode === 'dark'
              ? tone.color === 'tertiary'
                ? 'rgba(255,155,148,0.16)'
                : tone.color === 'secondary'
                  ? 'rgba(78,222,163,0.16)'
                  : 'rgba(160,228,254,0.16)'
              : tone.color === 'tertiary'
                ? 'rgba(192,48,43,0.12)'
                : tone.color === 'secondary'
                  ? 'rgba(0,108,73,0.12)'
                  : 'rgba(0,67,84,0.12)' },
          ]}
        >
          <Icon name={iconName} size={18} color={tone.color} />
        </View>
        <View style={styles.body}>
          <Text variant="titleSm" color="onSurface" numberOfLines={2}>
            {banner.title}
          </Text>
          {banner.body ? (
            <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={3}>
              {banner.body}
            </Text>
          ) : null}
          {banner.action ? (
            <Pressable
              onPress={() => {
                banner.action?.onPress();
                slideOut();
              }}
              style={styles.actionRow}
              hitSlop={6}
            >
              <Text variant="labelMd" color={tone.color}>
                {banner.action.label}
              </Text>
              <Icon name="chevron_right" size={14} color={tone.color} />
            </Pressable>
          ) : null}
        </View>
        <Icon name="close" size={16} color="onSurfaceVariant" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    zIndex: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconTile: {
    width: 36, height: 36,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing[1] },
  actionRow: {
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
