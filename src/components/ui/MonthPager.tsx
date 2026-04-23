import { View, Pressable, StyleSheet } from 'react-native';
import { addMonths, format, isSameMonth, startOfMonth } from 'date-fns';
import { useColors } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  /** Disables the "next" arrow when value is the current calendar month. Default: true. */
  capAtToday?: boolean;
};

/**
 * Compact month navigator — prev/next arrows flanking the month label, with
 * a tap-to-jump-to-current gesture on the label. Used at the top of the
 * Vault/Insights screens to change the period under review.
 */
export function MonthPager({ value, onChange, capAtToday = true }: Props) {
  const colors = useColors();
  const atCurrent = isSameMonth(value, new Date());
  const nextDisabled = capAtToday && atCurrent;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(addMonths(value, -1))}
        hitSlop={12}
        style={[styles.btn, { backgroundColor: colors.surfaceContainer }]}
      >
        <Icon name="chevron_left" size={18} color="onSurface" />
      </Pressable>
      <Pressable
        onPress={() => onChange(startOfMonth(new Date()))}
        disabled={atCurrent}
        hitSlop={6}
        style={styles.label}
      >
        <Text variant="titleSm" color="onSurface">
          {format(value, 'MMMM yyyy')}
        </Text>
        {!atCurrent && (
          <Text variant="labelSm" color="primary">
            Tap for current
          </Text>
        )}
      </Pressable>
      <Pressable
        onPress={() => !nextDisabled && onChange(addMonths(value, 1))}
        disabled={nextDisabled}
        hitSlop={12}
        style={[styles.btn, { backgroundColor: colors.surfaceContainer, opacity: nextDisabled ? 0.35 : 1 }]}
      >
        <Icon name="chevron_right" size={18} color="onSurface" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { alignItems: 'center', flex: 1 },
});
