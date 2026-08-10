import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Switch, Alert, Pressable, Linking, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, TopBar, Avatar, Card, Text, Icon, Button, Section } from '@/components/ui';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import type { Color } from '@/theme/tokens';
import { useProfile } from '@/features/profile/queries';
import { useUpdateProfile } from '@/features/profile/mutations';
import { useAuth } from '@/features/auth/store';
import {
  biometricsAvailable,
  getBiometricType,
  isBiometricEnabled,
  promptBiometric,
  setBiometricEnabled,
} from '@/features/auth/biometrics';
import { CurrencyPickerModal } from '@/components/settings/CurrencyPickerModal';
import { CalendarPickerModal } from '@/components/settings/CalendarPickerModal';
import { ConfirmDestructiveModal } from '@/components/settings/ConfirmDestructiveModal';
import { NotificationDevPanel } from '@/components/settings/NotificationDevPanel';
import { usePreferences } from '@/features/preferences/store';
import { useCalendar } from '@/features/preferences/calendar';
import {
  ensureNotificationPermission,
  getNotificationPermission,
  type PermissionSnapshot,
} from '@/features/notifications/permissions';
import { cancelAllScheduledNotifications } from '@/features/notifications/local';
import { useWipeFinanceData } from '@/features/sync/wipe';
import type { CalendarScript, CalendarSystem } from '@/lib/calendar';
import * as LocalAuthentication from 'expo-local-authentication';

export default function Settings() {
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const signOut = useAuth((s) => s.signOut);
  const [bioHasHardware, setBioHasHardware] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioEnabled, setBioEnabledState] = useState(false);
  const [bioType, setBioType] = useState<'face' | 'touch' | 'none'>('none');
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<PermissionSnapshot | null>(null);
  const wipe = useWipeFinanceData();

  useEffect(() => {
    (async () => {
      const [hw, enrolled, enabled, t] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        isBiometricEnabled(),
        getBiometricType(),
      ]);
      setBioHasHardware(hw);
      setBioEnrolled(enrolled);
      setBioEnabledState(enabled);
      setBioType(t);
    })();
  }, []);

  // OS-level notification permission. Re-read on foreground, because the only
  // way back from a hard denial is the system settings app — and returning
  // from it must not leave this screen showing stale "blocked" copy.
  const refreshNotifPermission = useCallback(() => {
    getNotificationPermission()
      .then(setNotifPermission)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshNotifPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshNotifPermission();
    });
    return () => sub.remove();
  }, [refreshNotifPermission]);

  const bioAvailable = bioHasHardware && bioEnrolled;
  const bioHint = !bioHasHardware
    ? 'This device has no biometric hardware'
    : !bioEnrolled
      ? `Enroll ${bioType === 'face' ? 'Face ID' : 'a fingerprint'} in Settings first`
      : bioEnabled
        ? 'Required every time Equilibrium opens'
        : 'Require biometrics on app launch';

  const toggleBiometric = async (next: boolean) => {
    if (next) {
      if (!bioHasHardware) {
        Alert.alert('Not supported', 'This device has no biometric sensor.');
        return;
      }
      if (!bioEnrolled) {
        Alert.alert(
          'Set up biometrics first',
          `Enroll ${bioType === 'face' ? 'Face ID' : 'a fingerprint'} in your device Settings, then come back.`,
        );
        return;
      }
      const ok = await promptBiometric('Confirm to enable biometric unlock');
      if (!ok) return;
    }
    await setBiometricEnabled(next);
    setBioEnabledState(next);
    // Mirror the change into the profile so other devices know the preference exists
    updateProfile.mutate({ biometric_enabled: next });
  };

  const currency = usePreferences((s) => s.currency);
  const setLocalCurrency = usePreferences((s) => s.setCurrency);

  const pickCurrency = (code: string) => {
    if (code === currency) return;
    // 1) Update the local store *first* — UI reacts immediately, and the choice
    //    survives offline / cold restart even if Supabase is unreachable.
    setLocalCurrency(code);
    // 2) Fire-and-forget to Supabase so the preference follows the user to
    //    other devices. Surface any failure so we don't silently diverge.
    updateProfile.mutate(
      { currency: code },
      {
        onError: (err: any) => {
          Alert.alert(
            'Saved on this device, but not synced',
            err?.message ?? 'Your currency is set locally. We could not reach Supabase to sync it across devices.',
          );
        },
      },
    );
  };

  const calendar = useCalendar();
  const calendarSystem = usePreferences((s) => s.calendar);
  const calendarScript = usePreferences((s) => s.calendarScript);
  const setCalendar = usePreferences((s) => s.setCalendar);
  const setCalendarScript = usePreferences((s) => s.setCalendarScript);

  /**
   * Switching calendars redefines every period boundary in the app, so the
   * cached month totals, budgets, insights, and tracking rows are all keyed to
   * the *old* calendar. The queries key on the calendar-scoped period, so they
   * refetch on their own — we just mirror the choice to Supabase so it follows
   * the user to other devices.
   */
  const pickCalendar = (system: CalendarSystem) => {
    if (system === calendarSystem) return;
    setCalendar(system);
    updateProfile.mutate(
      { calendar_system: system },
      {
        onError: (err: any) => {
          Alert.alert(
            'Saved on this device, but not synced',
            err?.message ?? 'Your calendar is set locally. We could not reach Supabase to sync it.',
          );
        },
      },
    );
  };

  const pickCalendarScript = (script: CalendarScript) => {
    if (script === calendarScript) return;
    setCalendarScript(script);
    updateProfile.mutate({ calendar_script: script });
  };

  const pushEnabled = usePreferences((s) => s.pushEnabled);
  const inAppEnabled = usePreferences((s) => s.inAppEnabled);
  const setPushEnabled = usePreferences((s) => s.setPushEnabled);
  const setInAppEnabled = usePreferences((s) => s.setInAppEnabled);

  /**
   * Turning push on has to clear the OS permission gate too — a preference
   * that says "on" while the system says "blocked" is exactly the silent
   * failure this screen exists to prevent.
   */
  const togglePush = async (next: boolean) => {
    if (!next) {
      setPushEnabled(false);
      updateProfile.mutate({ push_enabled: false });
      await cancelAllScheduledNotifications();
      return;
    }
    const granted = await ensureNotificationPermission();
    refreshNotifPermission();
    if (!granted) {
      Alert.alert(
        'Notifications are blocked',
        'Equilibrium needs notification permission to send budget alerts. Enable it in your device settings, then come back.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ],
      );
      return;
    }
    setPushEnabled(true);
    updateProfile.mutate({ push_enabled: true });
  };

  const toggleInApp = (next: boolean) => {
    setInAppEnabled(next);
    updateProfile.mutate({ inapp_enabled: next });
  };

  const pushBlocked = notifPermission !== null && !notifPermission.granted;
  const pushHint = !pushEnabled
    ? 'Budget and spending alerts are muted'
    : pushBlocked
      ? 'Blocked in device settings — tap to fix'
      : 'Budget warnings, limit alerts, and period-end reminders';

  const confirmSignOut = () =>
    Alert.alert('Sign out', 'Your session on this device will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  const onWipeConfirm = async () => {
    try {
      await wipe.mutateAsync();
      setWipeOpen(false);
      Alert.alert(
        'All clear',
        'Your transactions, budgets, and custom categories have been removed from this device and from Supabase.',
      );
    } catch (e: any) {
      Alert.alert('Could not clear data', e?.message ?? 'Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar
        leading={<Avatar name={profile.data?.display_name ?? undefined} />}
        title="Settings"
        subtitle="Your Vault"
        trailingIcon="notifications"
        onTrailingPress={() => router.push('/notifications')}
      />
      <Screen contentStyle={styles.content}>
        <Card tone="high" padding={spacing[6]} vault>
          <View style={styles.profileRow}>
            <Avatar name={profile.data?.display_name ?? undefined} size={56} />
            <View style={{ flex: 1 }}>
              <Text variant="titleLg" color="onSurface" numberOfLines={1}>
                {profile.data?.display_name ?? 'Your name'}
              </Text>
              <View style={styles.membership}>
                <Icon name="verified" size={14} color="primary" />
                <Text variant="labelSm" color="primary">
                  Architect · Member
                </Text>
              </View>
            </View>
            <Icon name="chevron_right" size={22} color="onSurfaceVariant" />
          </View>
        </Card>

        {/* Appearance — new section for theme toggle */}
        <Section title="Appearance">
          <Card tone="low" padding={spacing[5]}>
            <View style={styles.rowBetween}>
              <View>
                <Text variant="titleSm" color="onSurface">
                  Theme
                </Text>
                <Text variant="bodySm" color="onSurfaceVariant">
                  Dark is the default. Light mirrors the Architectural Vault in a premium light palette.
                </Text>
              </View>
            </View>
            <View style={styles.themeRow}>
              <ThemeChip
                label="Dark"
                icon="dark_mode"
                active={mode === 'dark'}
                onPress={() => setMode('dark')}
              />
              <ThemeChip
                label="Light"
                icon="light_mode"
                active={mode === 'light'}
                onPress={() => setMode('light')}
              />
            </View>
          </Card>
        </Section>

        <Section title="Security & Privacy">
          <Card tone="low" padding={0}>
            <Row
              icon={bioType === 'face' ? 'face' : 'fingerprint'}
              label={bioType === 'face' ? 'Face ID unlock' : bioType === 'touch' ? 'Touch ID unlock' : 'Biometric unlock'}
              hint={bioHint}
              control={
                <Switch
                  value={bioEnabled}
                  onValueChange={toggleBiometric}
                  disabled={!bioAvailable}
                  trackColor={{ true: colors.primary, false: colors.surfaceContainerHigh }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.surfaceContainerHigh}
                />
              }
            />
            <Row icon="password" label="Change password" hint="Via email recovery link" onPress={() => {}} />
            <Row icon="shield" label="Two-factor authentication" hint="Coming soon" onPress={() => {}} />
          </Card>
        </Section>

        <Section title="Preferences">
          <Card tone="low" padding={0}>
            <Row
              icon="currency_exchange"
              label="Currency"
              hint={currency}
              onPress={() => setCurrencyPickerOpen(true)}
            />
            <Row
              icon="calendar_month"
              label="Calendar"
              hint={
                calendarSystem === 'ethiopian'
                  ? `Ethiopian · ${calendar.formatPeriod(new Date())}`
                  : `Gregorian · ${calendar.formatPeriod(new Date())}`
              }
              onPress={() => setCalendarPickerOpen(true)}
            />
          </Card>
        </Section>

        <Section title="Notifications">
          <Card tone="low" padding={0}>
            <Row
              icon="notifications_active"
              label="Push alerts"
              hint={pushHint}
              onPress={pushBlocked && pushEnabled ? () => Linking.openSettings().catch(() => {}) : undefined}
              control={
                <Switch
                  value={pushEnabled && !pushBlocked}
                  onValueChange={togglePush}
                  trackColor={{ true: colors.primary, false: colors.surfaceContainerHigh }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.surfaceContainerHigh}
                />
              }
            />
            <Row
              icon="campaign"
              label="In-app banners"
              hint={
                inAppEnabled
                  ? 'Alerts slide in over the app while you use it'
                  : 'Alerts will only reach you as push notifications'
              }
              control={
                <Switch
                  value={inAppEnabled}
                  onValueChange={toggleInApp}
                  trackColor={{ true: colors.primary, false: colors.surfaceContainerHigh }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.surfaceContainerHigh}
                />
              }
            />
            <Row
              icon="inbox"
              label="Alert history"
              hint="Everything Equilibrium has sent you"
              onPress={() => router.push('/notifications')}
            />
          </Card>
        </Section>

        <NotificationDevPanel />

        <Section title="About">
          <Card tone="low" padding={0}>
            <Row icon="description" label="Privacy Policy" onPress={() => {}} />
            <Row icon="gavel" label="Terms of Service" onPress={() => {}} />
            <Row icon="info" label="Version" hint="0.1.0" />
          </Card>
        </Section>

        <Section title="Danger Zone">
          <Card tone="low" padding={spacing[5]} style={{ gap: spacing[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] }}>
              <View style={[styles.rowTile, { backgroundColor: colors.errorContainer }]}>
                <Icon name="delete_forever" size={18} color="error" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleSm" color="onSurface">
                  Clear all finance data
                </Text>
                <Text variant="bodySm" color="onSurfaceVariant">
                  Removes every transaction, budget, and custom category from this device and from
                  Supabase. Your account, wallets, and preferences stay. This cannot be undone.
                </Text>
              </View>
            </View>
            <Button
              variant="danger"
              size="md"
              fullWidth
              leftIcon="delete_forever"
              onPress={() => setWipeOpen(true)}
              haptic="medium"
            >
              Clear data…
            </Button>
          </Card>
        </Section>

        <Button variant="danger" size="lg" fullWidth leftIcon="logout" onPress={confirmSignOut} haptic="medium">
          Sign out
        </Button>
      </Screen>

      <CurrencyPickerModal
        visible={currencyPickerOpen}
        current={currency}
        onClose={() => setCurrencyPickerOpen(false)}
        onPick={pickCurrency}
      />
      <CalendarPickerModal
        visible={calendarPickerOpen}
        system={calendarSystem}
        script={calendarScript}
        onClose={() => setCalendarPickerOpen(false)}
        onPickSystem={pickCalendar}
        onPickScript={pickCalendarScript}
      />
      <ConfirmDestructiveModal
        visible={wipeOpen}
        title="Clear all finance data?"
        body="This deletes every transaction, budget, and custom category — both locally and on Supabase. Your account stays signed in."
        confirmationWord="DELETE"
        destructiveLabel="Clear data"
        loading={wipe.isPending}
        onCancel={() => (wipe.isPending ? undefined : setWipeOpen(false))}
        onConfirm={onWipeConfirm}
      />
    </View>
  );
}

function ThemeChip({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.themeChip,
        {
          backgroundColor: active ? colors.surfaceContainerHighest : colors.surfaceContainer,
          borderColor: active ? colors.primary : 'transparent',
        },
      ]}
    >
      <Icon name={icon} size={18} color={active ? 'primary' : 'onSurfaceVariant'} />
      <Text variant="titleSm" color={active ? 'primary' : 'onSurfaceVariant'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({
  icon,
  label,
  hint,
  control,
  onPress,
  tone = 'onSurface',
}: {
  icon: string;
  label: string;
  hint?: string;
  control?: React.ReactNode;
  onPress?: () => void;
  tone?: Color;
}) {
  const { colors } = useTheme();
  const Container: any = onPress ? Pressable : View;
  return (
    <Container onPress={onPress} style={styles.row}>
      <View style={[styles.rowTile, { backgroundColor: colors.surfaceContainerHighest }]}>
        <Icon name={icon} size={18} color="primary" />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleSm" color={tone}>
          {label}
        </Text>
        {hint && (
          <Text variant="bodySm" color="onSurfaceVariant">
            {hint}
          </Text>
        )}
      </View>
      {control ?? (onPress && <Icon name="chevron_right" size={20} color="onSurfaceVariant" />)}
    </Container>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[6], gap: spacing[6] },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  membership: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  themeRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  rowTile: {
    width: 36, height: 36,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
});
