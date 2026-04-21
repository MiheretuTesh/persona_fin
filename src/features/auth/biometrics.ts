import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIO_ENABLED_KEY = 'eq.biometric.enabled';

export async function biometricsAvailable() {
  const [has, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return has && enrolled;
}

export async function getBiometricType(): Promise<'face' | 'touch' | 'none'> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'touch';
  return 'none';
}

export async function promptBiometric(reason = 'Unlock your Vault'): Promise<boolean> {
  const ok = await biometricsAvailable();
  if (!ok) return false;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Use password',
    disableDeviceFallback: false,
  });
  return res.success;
}

export async function setBiometricEnabled(enabled: boolean) {
  if (enabled) await SecureStore.setItemAsync(BIO_ENABLED_KEY, '1');
  else await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
}

export async function isBiometricEnabled() {
  return (await SecureStore.getItemAsync(BIO_ENABLED_KEY)) === '1';
}
