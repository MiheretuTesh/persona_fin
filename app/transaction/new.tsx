import { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
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
import { useCreateCategory } from '@/features/categories/mutations';
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

/** Icons the user can pick when creating a custom category (common finance ones). */
const CUSTOM_ICON_CHOICES: IconName[] = [
  'label', 'shopping_cart', 'shopping_bag', 'restaurant', 'local_cafe',
  'home', 'bolt', 'water_drop', 'wifi', 'phone_iphone', 'local_gas_station',
  'directions_car', 'flight_takeoff', 'theaters', 'fitness_center',
  'pets', 'school', 'medication', 'redeem', 'card_giftcard', 'subscriptions',
  'savings', 'trending_up', 'work', 'laptop_mac',
];

export default function NewTransaction() {
  const router = useRouter();
  const wallets = useWallets();
  const categories = useCategories();
  const create = useCreateTransaction();
  const createCategory = useCreateCategory();
  const [occurredAt] = useState(new Date());
  const [amountText, setAmountText] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<IconName>('label');

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

  // Pre-select the user's first wallet the moment wallets load.
  // NOTE: previous revision used useMemo here — that was wrong, useMemo is for
  // derived *values*, not side effects. useEffect is the correct hook.
  useEffect(() => {
    if (!walletId && wallets.data && wallets.data[0]) {
      setValue('walletId', wallets.data[0].id, { shouldValidate: false });
    }
  }, [walletId, wallets.data, setValue]);

  const availableCategories = useMemo(
    () => (categories.data ?? []).filter((c) => c.kind === kind),
    [categories.data, kind],
  );

  const onSubmit = async (v: FormValues) => {
    try {
      console.log('Submitting', v);
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

  const saveNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give your category a short name.');
      return;
    }
    try {
      const created = await createCategory.mutateAsync({
        name: trimmed,
        icon: newCategoryIcon,
        kind,
      });
      setValue('categoryId', created.id, { shouldValidate: true });
      setAddingCategory(false);
      setNewCategoryName('');
      setNewCategoryIcon('label');
    } catch (e: any) {
      Alert.alert('Could not create category', e?.message ?? 'Please try again.');
    }
  };

  const noWallets = !wallets.isLoading && (wallets.data?.length ?? 0) === 0;
  const noCategoriesAtAll = !categories.isLoading && (categories.data?.length ?? 0) === 0;

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

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Kind segmented */}
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <View style={styles.segmented}>
                <SegBtn
                  label="Expense"
                  icon="remove_circle"
                  color="tertiary"
                  active={field.value === 'expense'}
                  onPress={() => {
                    field.onChange('expense');
                    setValue('categoryId', undefined as unknown as string);
                  }}
                />
                <SegBtn
                  label="Income"
                  icon="add_circle"
                  color="secondary"
                  active={field.value === 'income'}
                  onPress={() => {
                    field.onChange('income');
                    setValue('categoryId', undefined as unknown as string);
                  }}
                />
                <SegBtn
                  label="Transfer"
                  icon="swap_horiz"
                  color="primary"
                  active={field.value === 'transfer'}
                  onPress={() => {
                    field.onChange('transfer');
                    setValue('categoryId', undefined as unknown as string);
                  }}
                />
              </View>
            )}
          />

          {/* Amount — display-as-hero */}
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
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor={palette.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      value={amountText}
                      onChangeText={(t) => {
                        // Strip everything but digits and a single decimal.
                        const cleaned = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                        setAmountText(cleaned);
                        field.onChange(cleaned === '' ? undefined : Number(cleaned));
                      }}
                      onBlur={field.onBlur}
                      selectionColor={palette.primary}
                      style={styles.amountInput}
                    />
                  </View>
                  {fieldState.error?.message && (
                    <Text variant="bodySm" color="error" style={{ marginTop: spacing[2] }}>
                      {fieldState.error.message}
                    </Text>
                  )}
                </View>
              )}
            />
          </Card>

          {/* Wallet */}
          <View style={styles.block}>
            <Text variant="labelMd" color="onSurfaceVariant">
              Wallet
            </Text>
            {noWallets ? (
              <Card tone="low" padding={spacing[4]}>
                <Text variant="bodyMd" color="onSurfaceVariant">
                  You don't have a wallet yet. A "Main Vault" is created automatically on signup — if you see this message, the Supabase migration probably hasn't finished applying. Re-run the migration from <Text color="primary">supabase/migrations</Text>.
                </Text>
              </Card>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {(wallets.data ?? []).map((w) => (
                  <Chip
                    key={w.id}
                    label={w.name}
                    icon={(w.icon as IconName) ?? 'account_balance_wallet'}
                    tone={walletId === w.id ? 'primary' : 'neutral'}
                    selected={walletId === w.id}
                    onPress={() => setValue('walletId', w.id, { shouldValidate: true })}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          {/* Category */}
          <View style={styles.block}>
            <View style={styles.categoryHeader}>
              <Text variant="labelMd" color="onSurfaceVariant">
                Category
              </Text>
              {kind !== 'transfer' && (
                <Pressable onPress={() => setAddingCategory((v) => !v)} hitSlop={8} style={styles.newBtn}>
                  <Icon name={addingCategory ? 'close' : 'add'} size={14} color="primary" />
                  <Text variant="labelMd" color="primary">
                    {addingCategory ? 'Cancel' : 'New'}
                  </Text>
                </Pressable>
              )}
            </View>

            {addingCategory && (
              <Card tone="low" padding={spacing[5]} style={{ gap: spacing[4] }}>
                <Input
                  label="Category name"
                  placeholder={kind === 'income' ? 'e.g. Side Hustle' : 'e.g. Coffee'}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={saveNewCategory}
                />
                <View>
                  <Text variant="labelMd" color="onSurfaceVariant" style={{ marginBottom: spacing[2] }}>
                    Icon
                  </Text>
                  <View style={styles.iconGrid}>
                    {CUSTOM_ICON_CHOICES.map((name) => (
                      <Pressable
                        key={name}
                        onPress={() => setNewCategoryIcon(name)}
                        style={[
                          styles.iconChoice,
                          newCategoryIcon === name && { backgroundColor: palette.surfaceContainerHighest, borderColor: palette.primary },
                        ]}
                      >
                        <Icon name={name} size={18} color={newCategoryIcon === name ? 'primary' : 'onSurfaceVariant'} />
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  loading={createCategory.isPending}
                  onPress={saveNewCategory}
                  haptic="success"
                >
                  Save category
                </Button>
              </Card>
            )}

            {noCategoriesAtAll ? (
              <Card tone="low" padding={spacing[4]}>
                <Text variant="bodyMd" color="onSurfaceVariant">
                  No categories are seeded in your Supabase project. Apply the migrations in <Text color="primary">supabase/migrations/</Text> and the defaults will appear here.
                </Text>
              </Card>
            ) : availableCategories.length === 0 && !addingCategory ? (
              <Card tone="low" padding={spacing[4]}>
                <Text variant="bodyMd" color="onSurfaceVariant">
                  No {kind} categories yet. Tap <Text color="primary">New</Text> to create one.
                </Text>
              </Card>
            ) : (
              <View style={styles.categoryGrid}>
                {availableCategories.map((c) => {
                  const selected = categoryId === c.id;
                  const tone: Color = (c.color_token as Color) ?? 'primary';
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setValue('categoryId', c.id, { shouldValidate: true })}
                      style={[styles.categoryTile, selected && { backgroundColor: palette.surfaceContainerHighest }]}
                    >
                      <View style={styles.categoryIcon}>
                        <Icon name={c.icon} size={20} color={tone} />
                      </View>
                      <Text variant="labelMd" color={selected ? 'primary' : 'onSurfaceVariant'} center numberOfLines={1}>
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
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

          {/* Debug: show why submit might be disabled */}
          {(formState.errors.walletId || formState.errors.categoryId || formState.errors.amount) && (
            <Card tone="low" padding={spacing[3]}>
              <Text variant="labelSm" color="error">
                {formState.errors.amount?.message
                  ? 'Enter an amount. '
                  : ''}
                {formState.errors.walletId?.message
                  ? 'Pick a wallet. '
                  : ''}
                {formState.errors.categoryId?.message
                  ? 'Pick a category.'
                  : ''}
              </Text>
            </Card>
          )}
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
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing[2] },
  amountInput: {
    flex: 1,
    color: palette.onSurface,
    fontFamily: 'Manrope_700Bold',
    fontSize: 40,
    lineHeight: 48,
    padding: 0,
    includeFontPadding: false,
  },
  block: { gap: spacing[3] },
  chipRow: { gap: spacing[2], paddingVertical: spacing[1] },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    backgroundColor: 'rgba(160,228,254,0.1)',
    borderRadius: radius.pill,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryTile: {
    width: '31.5%',
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
    backgroundColor: palette.surfaceContainerHighest,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  iconChoice: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceContainer,
    borderWidth: 1,
    borderColor: 'transparent',
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
