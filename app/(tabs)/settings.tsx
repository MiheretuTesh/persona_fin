import { useEffect, useState } from 'react';
import { View, StyleSheet, Switch, Alert, Pressable } from 'react-native';
import { Screen, TopBar, Avatar, Card, Text, Icon, Button, Section } from '@/components/ui';
import { palette, radius, spacing, type Color } from '@/theme';
import { useProfile } from '@/features/profile/queries';
import { useAuth } from '@/features/auth/store';
import {
  biometricsAvailable,
  getBiometricType,
  isBiometricEnabled,
  promptBiometric,
  setBiometricEnabled,
} from '@/features/auth/biometrics';

export default function Settings() {
  const profile = useProfile();
  const signOut = useAuth((s) => s.signOut);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabledState] = useState(false);
  const [bioType, setBioType] = useState<'face' | 'touch' | 'none'>('none');

  useEffect(() => {
    (async () => {
      setBioAvailable(await biometricsAvailable());
      setBioEnabledState(await isBiometricEnabled());
      setBioType(await getBiometricType());
    })();
  }, []);

  const toggleBiometric = async (next: boolean) => {
    if (next) {
      const ok = await promptBiometric('Confirm to enable biometric unlock');
      if (!ok) return;
    }
    await setBiometricEnabled(next);
    setBioEnabledState(next);
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out', 'Your session on this device will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <TopBar leading={<Avatar name={profile.data?.display_name ?? undefined} />} title="Settings" subtitle="Your Vault" />
      <Screen contentStyle={styles.content}>
        {/* Profile summary */}
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

        <Section title="Security & Privacy">
          <Card tone="low" padding={0}>
            <Row
              icon="fingerprint"
              label={bioType === 'face' ? 'Face ID unlock' : 'Biometric unlock'}
              hint={bioAvailable ? 'Require biometrics on app launch' : 'Not available on this device'}
              control={
                <Switch
                  value={bioEnabled}
                  onValueChange={toggleBiometric}
                  disabled={!bioAvailable}
                  trackColor={{ true: palette.primary, false: palette.surfaceContainerHigh }}
                  thumbColor={palette.surface}
                  ios_backgroundColor={palette.surfaceContainerHigh}
                />
              }
            />
            <Row icon="password" label="Change password" hint="Via email recovery link" onPress={() => {}} />
            <Row icon="shield" label="Two-factor authentication" hint="Coming soon" onPress={() => {}} />
          </Card>
        </Section>

        <Section title="Preferences">
          <Card tone="low" padding={0}>
            <Row icon="palette" label="Appearance" hint="Dark" onPress={() => {}} />
            <Row icon="currency_exchange" label="Currency" hint={profile.data?.currency ?? 'USD'} onPress={() => {}} />
            <Row icon="notifications" label="Notifications" hint="Weekly digest" onPress={() => {}} />
          </Card>
        </Section>

        <Section title="About">
          <Card tone="low" padding={0}>
            <Row icon="description" label="Privacy Policy" onPress={() => {}} />
            <Row icon="gavel" label="Terms of Service" onPress={() => {}} />
            <Row icon="info" label="Version" hint="0.1.0" />
          </Card>
        </Section>

        <Button variant="danger" size="lg" fullWidth leftIcon="logout" onPress={confirmSignOut} haptic="medium">
          Sign out
        </Button>
      </Screen>
    </View>
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
  const Container = onPress ? Pressable : View;
  return (
    <Container onPress={onPress} style={styles.row}>
      <View style={styles.rowTile}>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  rowTile: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
