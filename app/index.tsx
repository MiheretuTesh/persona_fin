import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { palette, spacing } from '@/theme';
import { Text } from '@/components/ui';
import { useAuth } from '@/features/auth/store';
import { isBiometricEnabled, promptBiometric } from '@/features/auth/biometrics';

/**
 * Boot route. Renders the Equilibrium mark for a beat while we check session
 * (and optionally prompt for biometric unlock), then redirects. The native
 * splash is already hidden by root layout once fonts + session are ready —
 * this is the in-app splash that bridges into the Vault.
 */
export default function Index() {
  const status = useAuth((s) => s.status);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    (async () => {
      if (status !== 'authenticated') return;
      if (!(await isBiometricEnabled())) return;
      const ok = await promptBiometric('Unlock your Vault');
      if (!ok) await signOut();
    })();
  }, [status, signOut]);

  if (status === 'authenticated') return <Redirect href="/(tabs)" />;
  if (status === 'guest') return <Redirect href="/(auth)/sign-in" />;

  // Unknown → brief in-app splash while hydration finishes.
  return (
    <View style={styles.root}>
      <View style={styles.mark}>
        <Mark />
      </View>
      <View style={styles.copy}>
        <Text variant="displaySm" color="onSurface" center>
          Equilibrium
        </Text>
        <Text variant="labelMd" color="onSurfaceVariant" center>
          FINANCE
        </Text>
      </View>
    </View>
  );
}

function Mark() {
  return (
    <Svg width={96} height={96} viewBox="0 0 96 96">
      <Defs>
        <LinearGradient id="spine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.primary} />
          <Stop offset="1" stopColor={palette.primaryContainer} />
        </LinearGradient>
      </Defs>
      <Rect x={26} y={12} width={6} height={72} rx={3} fill="url(#spine)" opacity={0.95} />
      <Rect x={32} y={18} width={48} height={10} rx={5} fill={palette.onSurface} />
      <Rect x={32} y={43} width={38} height={10} rx={5} fill={palette.primary} />
      <Rect x={32} y={68} width={48} height={10} rx={5} fill={palette.onSurface} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
  },
  mark: {
    width: 128,
    height: 128,
    borderRadius: 32,
    backgroundColor: palette.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: spacing[1], alignItems: 'center' },
});
