import { useEffect, useState } from 'react';
import { View, KeyboardAvoidingView, Platform, StyleSheet, Alert, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Screen, Text, Input, Button, Icon } from '@/components/ui';
import { palette, radius, spacing } from '@/theme';
import { signInSchema, SignInValues } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/store';
import { biometricsAvailable, getBiometricType, promptBiometric, isBiometricEnabled } from '@/features/auth/biometrics';

export default function SignIn() {
  const signIn = useAuth((s) => s.signIn);
  const sendPasswordReset = useAuth((s) => s.sendPasswordReset);
  const [bioType, setBioType] = useState<'face' | 'touch' | 'none'>('none');
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState, watch } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  // If the user previously opted into biometrics, surface the button.
  useEffect(() => {
    (async () => {
      if ((await biometricsAvailable()) && (await isBiometricEnabled())) {
        setBioType(await getBiometricType());
      }
    })();
  }, []);

  const onSubmit = async (v: SignInValues) => {
    try {
      await signIn(v.email, v.password);
    } catch (e: any) {
      Alert.alert('Sign in failed', e?.message ?? 'Please check your credentials and try again.');
    }
  };

  const onForgot = () => {
    const email = watch('email');
    if (!email) return Alert.alert('Enter your email', 'Type the email address on your account, then tap "Forgot".');
    sendPasswordReset(email)
      .then(() => Alert.alert('Check your email', 'We sent a reset link to your inbox.'))
      .catch((e) => Alert.alert('Could not send', e?.message ?? 'Try again in a moment.'));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen topInset={spacing[20]} bottomInset={spacing[10]}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Icon name="lock" size={18} color="primary" />
            <Text variant="labelSm" color="primary">
              Secured · End-to-end
            </Text>
          </View>
          <Text variant="displaySm" color="onSurface">
            Welcome back
          </Text>
          <Text variant="bodyLg" color="onSurfaceVariant">
            Step back into your financial Vault.
          </Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Input
                label="Email"
                placeholder="you@equilibrium.app"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                leftIcon="alternate_email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Input
                label="Password"
                placeholder="Your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                leftIcon="key"
                rightIcon={showPassword ? 'visibility_off' : 'visibility'}
                onRightIconPress={() => setShowPassword((v) => !v)}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Pressable onPress={onForgot} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
            <Text variant="labelMd" color="primary">
              Forgot password
            </Text>
          </Pressable>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={formState.isSubmitting}
            onPress={handleSubmit(onSubmit)}
            haptic="medium"
          >
            Enter your Vault
          </Button>

          {bioType !== 'none' && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={bioType === 'face' ? 'face' : 'fingerprint'}
              onPress={async () => {
                const ok = await promptBiometric('Unlock Equilibrium');
                if (!ok) return;
                // Biometric success trusts the on-device session: session is already persisted in SecureStore.
                // If no session is present this succeeds then the AuthGate will still route to sign-in.
              }}
            >
              Unlock with {bioType === 'face' ? 'Face ID' : 'Touch ID'}
            </Button>
          )}
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMd" color="onSurfaceVariant">
            New to Equilibrium?{' '}
          </Text>
          <Link href="/(auth)/sign-up">
            <Text variant="titleSm" color="primary">
              Create an account
            </Text>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing[6], gap: spacing[3], marginBottom: spacing[8] },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceContainerLow,
    alignSelf: 'flex-start',
  },
  form: { paddingHorizontal: spacing[6], gap: spacing[4] },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    marginTop: spacing[10],
  },
});
