import { Alert, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TransactionForm, TransactionFormValues } from '@/components/transactions/TransactionForm';
import { useTransaction } from '@/features/transactions/queries';
import { useUpdateTransaction, useDeleteTransaction } from '@/features/transactions/mutations';
import { useTheme } from '@/theme';

/**
 * Edit screen for an existing transaction. The route param `id` is the
 * transaction's UUID. We pull the row via `useTransaction(id)` which uses
 * cache as initialData (so navigating from History paints instantly), then
 * pre-fill TransactionForm with its values.
 *
 * Save → useUpdateTransaction (optimistic).
 * Delete → confirmed Alert → useDeleteTransaction (optimistic).
 */
export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const transaction = useTransaction(id);
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  if (!transaction.data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const t = transaction.data;
  // Amount is stored signed in DB; the form expects a positive number.
  const initialValues = {
    kind: t.kind,
    amount: Math.abs(Number(t.amount)),
    walletId: t.wallet_id,
    categoryId: t.category_id,
    merchant: t.merchant ?? '',
    note: t.note ?? '',
    occurredAt: new Date(t.occurred_at),
  };

  const onSubmit = async (v: TransactionFormValues, occurredAt: Date) => {
    try {
      await update.mutateAsync({
        id: t.id,
        walletId: v.walletId,
        categoryId: v.categoryId,
        kind: v.kind,
        amount: v.amount,
        merchant: v.merchant,
        note: v.note,
        occurredAt,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    }
  };

  const onDelete = () => {
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(t.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Could not delete', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <TransactionForm
      mode="edit"
      initialValues={initialValues}
      onSubmit={onSubmit}
      onDelete={onDelete}
      isSubmitting={update.isPending}
      isDeleting={remove.isPending}
    />
  );
}
