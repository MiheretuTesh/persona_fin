import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useAuth } from './store';
import { biometricsAvailable, getBiometricType, isBiometricEnabled, promptBiometric } from './biometrics';

/** Grace period before re-locking on foreground. Short enough to defeat shoulder-surfing,
 * long enough to tolerate momentary switches (e.g., system password prompt). */
const LOCK_GRACE_MS = 30_000;

type Status = 'idle' | 'locked' | 'unlocked';

/**
 * Session lock for authenticated users.
 *
 *   - First mount while signed in & opt-in → immediately prompt biometric.
 *   - Foregrounding after >30s background → re-lock and re-prompt.
 *   - Failed prompt doesn't sign the user out; shows an overlay with retry + "use password".
 *
 * Mount this once, inside the authenticated tree (not in the auth screens).
 */
export function BiometricLockOverlay() {
  const { colors } = useTheme();
  const status = useAuth((s) => s.status);
  const signOut = useAuth((s) => s.signOut);
  const [lockState, setLockState] = useState<Status>('idle');
  const [bioType, setBioType] = useState<'face' | 'touch' | 'none'>('none');
  const lastBackgroundedAt = useRef<number>(0);
  const hasCheckedInit = useRef(false);

  const tryPrompt = useCallback(async () => {
    const ok = await promptBiometric('Unlock your Vault');
    if (ok) setLockState('unlocked');
    // Otherwise keep lockState === 'locked'; user can tap Try again or Use password.
  }, []);

  // Initial check when user lands here authenticated for the first time.
  useEffect(() => {
    if (status !== 'authenticated' || hasCheckedInit.current) return;
    hasCheckedInit.current = true;
    (async () => {
      const [avail, enabled, t] = await Promise.all([
        biometricsAvailable(),
        isBiometricEnabled(),
        getBiometricType(),
      ]);
      setBioType(t);
      if (avail && enabled) {
        setLockState('locked');
        tryPrompt();
      } else {
        setLockState('unlocked');
      }
    })();
  }, [status, tryPrompt]);

  // AppState foreground gate.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        lastBackgroundedAt.current = Date.now();
        return;
      }
      if (next !== 'active') return;
      if (status !== 'authenticated') return;
      const away = Date.now() - (lastBackgroundedAt.current || Date.now());
      if (away < LOCK_GRACE_MS) return;
      const [avail, enabled] = await Promise.all([biometricsAvailable(), isBiometricEnabled()]);
      if (!avail || !enabled) return;
      setLockState('locked');
      tryPrompt();
    });
    return () => sub.remove();
  }, [status, tryPrompt]);

  // Reset when user signs out so the next session re-evaluates from scratch.
  useEffect(() => {
    if (status !== 'authenticated') {
      hasCheckedInit.current = false;
      setLockState('idle');
    }
  }, [status]);

  if (lockState !== 'locked' || status !== 'authenticated') return null;

  const title = bioType === 'face' ? 'Face ID required' : 'Unlock required';
  const icon = bioType === 'face' ? 'face' : 'fingerprint';

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]} pointerEvents="auto">
      <BlurView tint={colors.mode === 'dark' ? 'dark' : 'light'} intensity={60} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.mode === 'dark' ? 'rgba(8,14,26,0.85)' : 'rgba(246,248,255,0.9)' }]} />
      <View style={styles.center}>
        <View style={[styles.iconOrb, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.primary }]}>
          <Icon name={icon} size={48} color="primary" />
        </View>
        <Text variant="displaySm" color="onSurface" center>
          {title}
        </Text>
        <Text variant="bodyLg" color="onSurfaceVariant" center style={{ maxWidth: 280 }}>
          Your Vault is protected. Verify to continue where you left off.
        </Text>
        <View style={styles.actions}>
          <Button variant="primary" size="lg" fullWidth leftIcon={icon} onPress={tryPrompt} haptic="medium">
            Try again
          </Button>
          <Button variant="ghost" size="md" fullWidth onPress={signOut} haptic="light">
            Use password instead
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 200 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    paddingHorizontal: spacing[8],
  },
  iconOrb: {
    width: 112, height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[4],
  },
  actions: { alignSelf: 'stretch', gap: spacing[3], marginTop: spacing[6] },
});
