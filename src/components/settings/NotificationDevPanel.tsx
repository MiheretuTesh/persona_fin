import { View, StyleSheet, Alert } from 'react-native';
import { Card, Section, Text, Button } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { useBanners } from '@/features/notifications/store';
import {
  fireLocalNotification,
  scheduleMonthEndReminder,
  cancelAllScheduledNotifications,
} from '@/features/notifications/local';
import { ensureNotificationPermission } from '@/features/notifications/permissions';
import { clearDedup } from '@/features/notifications/dedup';

/**
 * Dev-only test surface for the notification system.
 *
 * Mounted in Settings under `__DEV__` so it never ships to production. Each
 * button exercises one slice of the pipeline — banners (in-app), local push
 * (system), the month-end scheduler, and the dedup reset — so you can verify
 * the plumbing without crafting transactions that hit real budget thresholds.
 */
export function NotificationDevPanel() {
  if (!__DEV__) return null;

  const push = useBanners((s) => s.push);
  const clear = useBanners((s) => s.clear);

  return (
    <Section title="Notifications · Dev">
      <Card tone="low" padding={spacing[5]} style={styles.card}>
        <Text variant="bodySm" color="onSurfaceVariant">
          Visible only in development builds. Use these to verify in-app banners and local push wiring.
        </Text>

        <Text variant="labelMd" color="onSurfaceVariant">In-app banners</Text>
        <View style={styles.row}>
          <Button
            variant="secondary"
            size="md"
            onPress={() =>
              push({
                tone: 'info',
                title: 'Heads-up',
                body: 'This is an info banner — primary tone.',
                autoDismissMs: 4000,
              })
            }
          >
            Info
          </Button>
          <Button
            variant="secondary"
            size="md"
            onPress={() =>
              push({
                tone: 'success',
                title: 'Saved',
                body: 'Confirmation toast — secondary tone.',
                autoDismissMs: 3500,
              })
            }
          >
            Success
          </Button>
        </View>
        <View style={styles.row}>
          <Button
            variant="secondary"
            size="md"
            onPress={() =>
              push({
                tone: 'warn',
                title: 'Food: 82% of budget used',
                body: "Heads-up — you're past 80% of your Food limit.",
                icon: 'warning',
                autoDismissMs: 6000,
              })
            }
          >
            Warn
          </Button>
          <Button
            variant="secondary"
            size="md"
            onPress={() =>
              push({
                tone: 'danger',
                title: 'Expenses are about to exceed income',
                body: "You've spent 96% of this month's income.",
                icon: 'priority_high',
              })
            }
          >
            Danger
          </Button>
        </View>

        <Text variant="labelMd" color="onSurfaceVariant" style={{ marginTop: spacing[3] }}>
          Local push (system)
        </Text>
        <View style={styles.row}>
          <Button
            variant="secondary"
            size="md"
            onPress={async () => {
              const ok = await ensureNotificationPermission();
              if (!ok) {
                Alert.alert(
                  'Notifications disabled',
                  'Enable notifications for Equilibrium in your device Settings, then try again.',
                );
                return;
              }
              const id = await fireLocalNotification({
                title: 'Test push',
                body: 'This is a local push notification fired from Equilibrium.',
                data: { kind: 'dev-test' },
              });
              if (!id) {
                Alert.alert('Could not fire push', 'Permission was not granted.');
              }
            }}
          >
            Fire test push
          </Button>
          <Button
            variant="secondary"
            size="md"
            onPress={async () => {
              await scheduleMonthEndReminder(new Date());
              Alert.alert(
                'Month-end reminder scheduled',
                'Re-scheduled for 9:00 AM, three days before the end of this month.',
              );
            }}
          >
            (Re)schedule month-end
          </Button>
        </View>

        <Text variant="labelMd" color="onSurfaceVariant" style={{ marginTop: spacing[3] }}>
          Reset
        </Text>
        <View style={styles.row}>
          <Button
            variant="secondary"
            size="md"
            onPress={async () => {
              await clearDedup();
              Alert.alert(
                'Dedup cleared',
                'Budget and income alerts will fire again next time the rules engine evaluates.',
              );
            }}
          >
            Reset dedup
          </Button>
          <Button
            variant="secondary"
            size="md"
            onPress={async () => {
              clear();
              await cancelAllScheduledNotifications();
            }}
          >
            Cancel all
          </Button>
        </View>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  row: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
});
