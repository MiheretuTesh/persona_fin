import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TransactionForm, TransactionFormValues } from '@/components/transactions/TransactionForm';
import { useCreateTransaction } from '@/features/transactions/mutations';

/**
 * Thin wrapper around <TransactionForm>. The form owns all UI state; this
 * component only owns the create mutation and back-navigation.
 */
export default function NewTransaction() {
  const router = useRouter();
  const create = useCreateTransaction();

  const onSubmit = async (v: TransactionFormValues, occurredAt: Date) => {
    try {
      await create.mutateAsync({
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

  return (
    <TransactionForm
      mode="create"
      onSubmit={onSubmit}
      isSubmitting={create.isPending}
    />
  );
}
