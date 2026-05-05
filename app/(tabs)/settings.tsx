import { useEffect, useState } from 'react';
import { View, StyleSheet, Switch, Alert, Pressable } from 'react-native';
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
import { ConfirmDestructiveModal } from '@/components/settings/ConfirmDestructiveModal';
import { NotificationDevPanel } from '@/components/settings/NotificationDevPanel';
import { usePreferences } from '@/features/preferences/store';
import { useWipeFinanceData } from '@/features/sync/wipe';
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
  const [wipeOpen, setWipeOpen] = useState(false);
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
            <Row icon="notifications" label="Notifications" hint="Coming soon" onPress={() => {}} />
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
