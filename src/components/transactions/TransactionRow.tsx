import { Pressable, View, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { spacing, radius } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { formatDate, formatSignedAmount } from '@/lib/formatters';
import type { Category, Transaction } from '@/types/database';

type Props = {
  transaction: Transaction;
  category: Category | undefined;
  currency?: string;
  onPress?: () => void;
};

export function TransactionRow({ transaction, category, currency = 'USD', onPress }: Props) {
  const colors = useColors();
  const isIncome = transaction.kind === 'income';
  const amountColor = isIncome ? 'secondary' : transaction.kind === 'expense' ? 'tertiary' : 'onSurface';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceContainerLow },
      ]}
    >
      <View style={styles.left}>
        <View style={[styles.iconTile, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Icon name={category?.icon ?? 'label'} size={22} color="primary" />
        </View>
        <View style={styles.textCol}>
          <Text variant="titleSm" color="onSurface" numberOfLines={1}>
            {transaction.merchant ?? category?.name ?? 'Transaction'}
          </Text>
          <Text variant="bodySm" color="onSurfaceVariant" numberOfLines={1}>
            {(category?.name ?? '—') + ' • ' + formatDate(transaction.occurred_at)}
          </Text>
        </View>
      </View>
      <Text variant="titleSm" color={amountColor}>
        {formatSignedAmount(transaction.amount, currency)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.xl,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], flex: 1 },
  iconTile: {
    width: 44, height: 44,
    borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  textCol: { flex: 1, gap: 2 },
});
