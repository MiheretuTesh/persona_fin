import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Input, Button, Chip, Card, Icon, IconName } from '@/components/ui';
import { palette, radius, spacing, type Color } from '@/theme';
import { useWallets } from '@/features/wallets/queries';
import { useCategories } from '@/features/categories/queries';
import { useCreateTransaction } from '@/features/transactions/mutations';
import type { TransactionKind } from '@/types/database';

const schema = z.object({
  kind: z.enum(['expense', 'income', 'transfer']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  walletId: z.string().uuid('Pick a wallet'),
  categoryId: z.string().uuid('Pick a category'),
  merchant: z.string().max(64).optional(),
  note: z.string().max(240).optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewTransaction() {
  const router = useRouter();
  const wallets = useWallets();
  const categories = useCategories();
  const create = useCreateTransaction();
  const [occurredAt] = useState(new Date());

  const { control, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: 'expense',
      amount: undefined as unknown as number,
      walletId: undefined as unknown as string,
      categoryId: undefined as unknown as string,
      merchant: '',
      note: '',
    },
    mode: 'onBlur',
  });

  const kind = watch('kind');
  const walletId = watch('walletId');
  const categoryId = watch('categoryId');

  // Pre-select the default wallet so the form is usable in one tap.
  useMemo(() => {
    if (!walletId && wallets.data && wallets.data[0]) setValue('walletId', wallets.data[0].id);
  }, [walletId, wallets.data, setValue]);

  const availableCategories = (categories.data ?? []).filter((c) => c.kind === kind);

  const onSubmit = async (v: FormValues) => {
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
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: palette.surfaceContainerLow }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Grabber + header */}
        <View style={styles.header}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Icon name="close" size={22} color="onSurface" />
            </Pressable>
            <Text variant="titleLg" color="onSurface">
              New transaction
            </Text>
            <View style={{ width: 22 }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Kind segmented */}
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <View style={styles.segmented}>
                <SegBtn label="Expense" icon="remove_circle" color="tertiary" active={field.value === 'expense'} onPress={() => { field.onChange('expense'); setValue('categoryId', '' as any); }} />
                <SegBtn label="Income" icon="add_circle" color="secondary" active={field.value === 'income'} onPress={() => { field.onChange('income'); setValue('categoryId', '' as any); }} />
                <SegBtn label="Transfer" icon="swap_horiz" color="primary" active={field.value === 'transfer'} onPress={() => { field.onChange('transfer'); setValue('categoryId', '' as any); }} />
              </View>
            )}
          />

          {/* Amount hero */}
          <Card tone="high" padding={spacing[8]} vault>
            <Text variant="labelSm" color="onSurfaceVariant">
              Amount
            </Text>
            <Controller
              control={control}
              name="amount"
              render={({ field, fieldState }) => (
                <View>
                  <View style={styles.amountRow}>
                    <Text variant="displayLg" color="onSurface" style={{ marginRight: 8 }}>
                      $
                    </Text>
                    <Input
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      value={field.value?.toString() ?? ''}
                      onChangeText={(t) => field.onChange(t.replace(/[^0-9.]/g, ''))}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              )}
            />
          </Card>

          {/* Wallet */}
          <View style={styles.block}>
            <Text variant="labelMd" color="onSurfaceVariant">
              Wallet
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {(wallets.data ?? []).map((w) => (
                <Chip
                  key={w.id}
                  label={w.name}
                  icon={(w.icon as IconName) ?? 'account_balance_wallet'}
                  tone={walletId === w.id ? 'primary' : 'neutral'}
                  selected={walletId === w.id}
                  onPress={() => setValue('walletId', w.id)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Category */}
          <View style={styles.block}>
            <Text variant="labelMd" color="onSurfaceVariant">
              Category
            </Text>
            <View style={styles.categoryGrid}>
              {availableCategories.map((c) => {
                const selected = categoryId === c.id;
                const tone: Color = (c.color_token as Color) ?? 'primary';
                return (
                  <Pressable key={c.id} onPress={() => setValue('categoryId', c.id)} style={[styles.categoryTile, selected && { backgroundColor: palette.surfaceContainerHighest }]}>
                    <View style={[styles.categoryIcon, { backgroundColor: palette.surfaceContainerHighest }]}>
                      <Icon name={c.icon} size={20} color={tone} />
                    </View>
                    <Text variant="labelMd" color={selected ? 'primary' : 'onSurfaceVariant'} center numberOfLines={1}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Merchant + note */}
          <View style={{ gap: spacing[4] }}>
            <Controller
              control={control}
              name="merchant"
              render={({ field }) => (
                <Input label="Merchant (optional)" placeholder="e.g. Apple Store" leftIcon="storefront" value={field.value} onChangeText={field.onChange} />
              )}
            />
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <Input label="Note (optional)" placeholder="Add a detail" leftIcon="edit_note" value={field.value} onChangeText={field.onChange} multiline />
              )}
            />
            <View style={styles.metaRow}>
              <Icon name="schedule" size={16} color="onSurfaceVariant" />
              <Text variant="bodySm" color="onSurfaceVariant">
                {format(occurredAt, "EEE, d MMM · h:mm a")}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button variant="secondary" size="lg" onPress={() => router.back()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={formState.isSubmitting || create.isPending}
            onPress={handleSubmit(onSubmit)}
            haptic="success"
            style={{ flex: 1 }}
          >
            Save
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SegBtn({ label, icon, color, active, onPress }: { label: string; icon: IconName; color: Color; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, active && { backgroundColor: palette.surfaceContainerHighest }]}>
      <Icon name={icon} size={16} color={active ? color : 'onSurfaceVariant'} />
      <Text variant="labelMd" color={active ? color : 'onSurfaceVariant'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing[6], paddingTop: spacing[3], paddingBottom: spacing[3] },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.surfaceContainerHighest,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { paddingHorizontal: spacing[6], paddingBottom: spacing[12], gap: spacing[6] },
  segmented: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceContainerLow,
    padding: spacing[1],
    borderRadius: radius.lg,
    gap: spacing[1],
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[2] },
  block: { gap: spacing[3] },
  chipRow: { gap: spacing[2], paddingVertical: spacing[1] },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryTile: {
    width: '31%',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: palette.surfaceContainerLow,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(66,72,86,0.12)',
  },
});
