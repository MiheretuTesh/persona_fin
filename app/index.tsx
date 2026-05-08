import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme';
import { spacing } from '@/theme/tokens';
import { Text } from '@/components/ui';
import { useAuth } from '@/features/auth/store';

/**
 * Boot route. Briefly shows the Equilibrium mark while session hydrates,
 * then redirects to /(tabs) or /(auth)/sign-in based on auth status.
 *
 * Important: this route does NOT prompt for biometric. Biometric unlock
 * is handled exclusively by <BiometricLockOverlay/> mounted in the root
 * layout — having a second prompt here was racing the overlay's prompt
 * and (worse) calling signOut() on failure, which kicked the user back
 * to the login screen on every cold start.
 */
export default function Index() {
  const { colors } = useTheme();
  const status = useAuth((s) => s.status);

  if (status === 'authenticated') return <Redirect href="/(tabs)" />;
  if (status === 'guest') return <Redirect href="/(auth)/sign-in" />;

  // status === 'unknown' → still hydrating. Show the in-app splash.
  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.mark, { backgroundColor: colors.surfaceContainerHighest }]}>
        <Svg width={96} height={96} viewBox="0 0 96 96">
          <Defs>
            <LinearGradient id="spine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="1" stopColor={colors.primaryContainer} />
            </LinearGradient>
          </Defs>
          <Rect x={26} y={12} width={6} height={72} rx={3} fill="url(#spine)" opacity={0.95} />
          <Rect x={32} y={18} width={48} height={10} rx={5} fill={colors.onSurface} />
          <Rect x={32} y={43} width={38} height={10} rx={5} fill={colors.primary} />
          <Rect x={32} y={68} width={48} height={10} rx={5} fill={colors.onSurface} />
        </Svg>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[6],
  },
  mark: {
    width: 128,
    height: 128,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: spacing[1], alignItems: 'center' },
});
