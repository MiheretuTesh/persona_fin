import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { Screen, TopBar, Card, Section, Text, Icon, EmptyState, Button } from '@/components/ui';
import { useTheme } from '@/theme';
import { spacing, radius } from '@/theme/tokens';
import { useBanners } from '@/features/notifications/store';
import { clearDedup, getAllFired, invalidateDedupCache } from '@/features/notifications/dedup';
import { useCategoryMap } from '@/features/categories/queries';

/**
 * Notifications inbox.
 *
 * Two sections:
 *   1. Active — banners currently rendered by InAppBannerHost. Tapping one
 *      dismisses it from the queue.
 *   2. Recent — a history of every alert that has fired (read from the
 *      AsyncStorage dedup map). Lets users see what they may have missed.
 *
 * Empty state when both are empty: "You're all caught up".
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const banners = useBanners((s) => s.banners);
  const dismiss = useBanners((s) => s.dismiss);
  const categories = useCategoryMap();

  const [history, setHistory] = useState<{ key: string; firedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const items = await getAllFired();
    setHistory(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const empty = banners.length === 0 && history.length === 0;

  const onClearHistory = () => {
    Alert.alert(
      'Clear history?',
      'This also resets dedup, so previously-fired alerts may re-fire next time the rules engine evaluates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearDedup();
            invalidateDedupCache();
            refresh();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar
        leading={
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backTile}>
            <Icon name="close" size={20} color="onSurface" />
          </Pressable>
        }
        title="Notifications"
        subtitle={empty ? 'Nothing to review' : 'Active and recent alerts'}
      />
      <Screen contentStyle={styles.content} refreshing={loading} onRefresh={refresh}>
        {empty ? (
          <Card tone="low" padding={spacing[6]}>
            <EmptyState
              icon="notifications"
              title="You're all caught up"
              body="Budget warnings, spending alerts, and month-end reminders will show up here."
            />
          </Card>
        ) : (
          <>
            {banners.length > 0 ? (
              <Section title="Active">
                <View style={{ gap: spacing[2] }}>
                  {[...banners].reverse().map((b) => (
                    <Card key={b.id} tone="low" padding={spacing[4]} style={styles.itemCard}>
                      <View
                        style={[
                          styles.iconTile,
                          { backgroundColor: tileBg(b.tone, colors.mode) },
                        ]}
                      >
                        <Icon
                          name={(b.icon as string) ?? toneIcon(b.tone)}
                          size={18}
                          color={toneColor(b.tone)}
                        />
                      </View>
                      <View style={styles.itemBody}>
                        <Text variant="titleSm" color="onSurface" numberOfLines={2}>
                          {b.title}
                        </Text>
                        {b.body ? (
                          <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={3}>
                            {b.body}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => dismiss(b.id)} hitSlop={8}>
                        <Icon name="close" size={18} color="onSurfaceVariant" />
                      </Pressable>
                    </Card>
                  ))}
                </View>
              </Section>
            ) : null}

            {history.length > 0 ? (
              <Section
                title="Recent"
                trailing="Clear"
                onTrailingPress={onClearHistory}
              >
                <View style={{ gap: spacing[2] }}>
                  {history.map((h) => {
                    const parsed = parseDedupKey(h.key, categories.byId);
                    return (
                      <Card key={h.key} tone="low" padding={spacing[4]} style={styles.itemCard}>
                        <View
                          style={[
                            styles.iconTile,
                            { backgroundColor: tileBg(parsed.tone, colors.mode) },
                          ]}
                        >
                          <Icon name={parsed.icon} size={18} color={toneColor(parsed.tone)} />
                        </View>
                        <View style={styles.itemBody}>
                          <Text variant="titleSm" color="onSurface" numberOfLines={2}>
                            {parsed.title}
                          </Text>
                          <Text variant="bodySm" color="onSurfaceVariant">
                            {formatFiredAt(h.firedAt)}
                          </Text>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </Section>
            ) : null}
          </>
        )}
      </Screen>
    </View>
  );
}

type Tone = 'info' | 'success' | 'warn' | 'danger';

function toneIcon(tone: Tone): string {
  switch (tone) {
    case 'success': return 'check_circle';
    case 'warn': return 'warning';
    case 'danger': return 'error';
    default: return 'info';
  }
}

function toneColor(tone: Tone): 'primary' | 'secondary' | 'tertiary' {
  switch (tone) {
    case 'success': return 'secondary';
    case 'warn':
    case 'danger': return 'tertiary';
    default: return 'primary';
  }
}

function tileBg(tone: Tone, mode: 'dark' | 'light'): string {
  if (mode === 'dark') {
    if (tone === 'danger' || tone === 'warn') return 'rgba(255,155,148,0.16)';
    if (tone === 'success') return 'rgba(78,222,163,0.16)';
    return 'rgba(160,228,254,0.16)';
  }
  if (tone === 'danger' || tone === 'warn') return 'rgba(192,48,43,0.12)';
  if (tone === 'success') return 'rgba(0,108,73,0.12)';
  return 'rgba(0,67,84,0.12)';
}

/**
 * Turns a dedup key like `budget:hit100:<catId>:2026-05` into a friendly
 * `{ title, tone, icon }`. Falls back to a generic label if the key shape
 * is unrecognised so we never break the inbox UI.
 */
function parseDedupKey(
  key: string,
  categoryById: Map<string, { name: string }>,
): { title: string; tone: Tone; icon: string } {
  const parts = key.split(':');
  const [scope, rule] = parts;

  if (scope === 'budget') {
    const catId = parts[2] ?? '';
    const name = categoryById.get(catId)?.name ?? 'a category';
    if (rule === 'over120') return { title: `${name}: well over budget`, tone: 'danger', icon: 'error' };
    if (rule === 'hit100') return { title: `${name}: budget reached`, tone: 'danger', icon: 'block' };
    if (rule === 'warn80') return { title: `${name}: 80%+ of budget used`, tone: 'warn', icon: 'warning' };
  }
  if (scope === 'income') {
    if (rule === 'over') return { title: 'Expenses exceeded income', tone: 'danger', icon: 'trending_down' };
    if (rule === 'near_overdraw') return { title: 'Expenses near income limit', tone: 'danger', icon: 'priority_high' };
    if (rule === 'warn80') return { title: '80%+ of income spent', tone: 'warn', icon: 'savings' };
  }
  if (scope === 'month') {
    return { title: 'Month is wrapping up', tone: 'info', icon: 'event' };
  }
  return { title: key, tone: 'info', icon: 'info' };
}

function formatFiredAt(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d 'at' h:mm a");
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  backTile: {
    width: 36, height: 36,
    borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  iconTile: {
    width: 36, height: 36,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: spacing[1] },
});
