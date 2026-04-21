import { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, StyleSheet, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Screen, Text, Input, Button } from '@/components/ui';
import { palette, spacing } from '@/theme';
import { signUpSchema, SignUpValues } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/store';

export default function SignUp() {
  const signUp = useAuth((s) => s.signUp);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (v: SignUpValues) => {
    try {
      await signUp(v.email, v.password, v.displayName);
      // With email confirmation disabled in Supabase, signUp returns an active
      // session and onAuthStateChange fires — the root AuthGate redirects into
      // (tabs) automatically, so there's nothing to do here. If confirmation
      // is still on in the project, the user lands back at sign-in without a
      // session; surface that as a hint.
    } catch (e: any) {
      Alert.alert('Could not create account', e?.message ?? 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen topInset={spacing[16]} bottomInset={spacing[10]}>
        <View style={styles.hero}>
          <Text variant="displaySm" color="onSurface">
            Open your Vault
          </Text>
          <Text variant="bodyLg" color="onSurfaceVariant">
            A quiet, deliberate space for your finances.
          </Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="displayName"
            render={({ field, fieldState }) => (
              <Input
                label="Your name"
                placeholder="How should we greet you?"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                leftIcon="person"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

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
                placeholder="8+ characters, letters & numbers"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
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

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <Input
                label="Confirm password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                leftIcon="shield"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          <Text variant="bodySm" color="onSurfaceVariant">
            By creating an account you agree to our Terms and acknowledge our Privacy Policy.
          </Text>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={formState.isSubmitting}
            onPress={handleSubmit(onSubmit)}
            haptic="success"
          >
            Create my Vault
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMd" color="onSurfaceVariant">
            Already have an account?{' '}
          </Text>
          <Link href="/(auth)/sign-in">
            <Text variant="titleSm" color="primary">
              Sign in
            </Text>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: spacing[6], gap: spacing[3], marginBottom: spacing[8] },
  form: { paddingHorizontal: spacing[6], gap: spacing[4] },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    marginTop: spacing[10],
  },
});
