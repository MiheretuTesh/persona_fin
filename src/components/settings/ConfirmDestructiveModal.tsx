import { useEffect, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, TextInput } from 'react-native';
import { useTheme } from '@/theme';
import { radius, spacing, type } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  /** Word the user must type to enable the destructive button (case-insensitive). Default: "DELETE". */
  confirmationWord?: string;
  /** Label for the destructive button. */
  destructiveLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

/**
 * Type-to-confirm destructive modal — Alert.prompt is iOS-only, so we render
 * a real Modal so Android users can complete the gesture too.
 *
 * Why type-to-confirm:
 *   - A single Alert with "Delete" is too easy to mis-tap, especially
 *     destructive on financial data.
 *   - Forcing the user to type "DELETE" interrupts muscle memory and gives
 *     them a chance to abort.
 *   - GitHub, Stripe, and AWS use this pattern for the same reason.
 */
export function ConfirmDestructiveModal({
  visible,
  title,
  body,
  confirmationWord = 'DELETE',
  destructiveLabel = 'Delete',
  loading,
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const matches = text.trim().toLowerCase() === confirmationWord.toLowerCase();

  // Reset the typed text whenever the modal is dismissed/reopened so a
  // previous run's "DELETE" doesn't carry over and pre-arm the button.
  useEffect(() => {
    if (!visible) setText('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={loading ? undefined : onCancel} />
      <View style={styles.center} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.surfaceContainerLow }]}>
          <View style={[styles.iconOrb, { backgroundColor: colors.errorContainer }]}>
            <Icon name="warning" size={28} color="error" />
          </View>
          <Text variant="headlineSm" color="onSurface" center>{title}</Text>
          <Text variant="bodyMd" color="onSurfaceVariant" center>{body}</Text>

          <View style={styles.confirmHint}>
            <Text variant="labelSm" color="onSurfaceVariant" center>
              Type <Text color="error">{confirmationWord}</Text> to confirm
            </Text>
            <View style={[styles.field, { backgroundColor: colors.surfaceContainer }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={confirmationWord}
                placeholderTextColor={colors.onSurfaceVariant}
                selectionColor={colors.error}
                cursorColor={colors.error}
                style={[styles.input, { color: matches ? colors.error : colors.onSurface }]}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <Button variant="secondary" size="lg" onPress={onCancel} disabled={loading} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="lg"
              onPress={() => onConfirm()}
              disabled={!matches || loading}
              loading={loading}
              haptic="medium"
              style={{ flex: 1 }}
            >
              {destructiveLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  sheet: {
    width: '100%', maxWidth: 420,
    padding: spacing[6],
    borderRadius: radius.xl,
    alignItems: 'center',
    gap: spacing[3],
  },
  iconOrb: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
  },
  confirmHint: { alignSelf: 'stretch', gap: spacing[2], marginTop: spacing[4] },
  field: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  input: { ...type.bodyLg, padding: 0, includeFontPadding: false },
  actions: { flexDirection: 'row', gap: spacing[3], alignSelf: 'stretch', marginTop: spacing[4] },
});
