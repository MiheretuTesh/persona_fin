import { useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Text, Input, Button, Chip, Card, Icon, IconName } from '@/components/ui';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import type { Color } from '@/theme/tokens';
import { useWallets } from '@/features/wallets/queries';
import { useCategories } from '@/features/categories/queries';
import { useCreateCategory } from '@/features/categories/mutations';
import { useCurrency } from '@/features/preferences/store';
import { currencySymbol } from '@/lib/formatters';
import type { TransactionKind } from '@/types/database';

const schema = z.object({
  kind: z.enum(['expense', 'income', 'transfer']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  walletId: z.string().uuid('Pick a wallet'),
  categoryId: z.string().uuid('Pick a category'),
  merchant: z.string().max(64).optional(),
  note: z.string().max(240).optional(),
});
export type TransactionFormValues = z.infer<typeof schema>;

const CUSTOM_ICON_CHOICES: IconName[] = [
  'label', 'shopping_cart', 'shopping_bag', 'restaurant', 'local_cafe',
  'home', 'bolt', 'water_drop', 'wifi', 'phone_iphone', 'local_gas_station',
  'directions_car', 'flight_takeoff', 'theaters', 'fitness_center',
  'pets', 'school', 'medication', 'redeem', 'card_giftcard', 'subscriptions',
  'savings', 'trending_up', 'work', 'laptop_mac',
];

export type TransactionFormInitial = Partial<TransactionFormValues> & { occurredAt?: Date };

type Props = {
  /** 'create' shows "New transaction" + Save; 'edit' shows the title with delete. */
  mode: 'create' | 'edit';
  /** Pre-fill the form. For edit, pass the existing transaction's values. */
  initialValues?: TransactionFormInitial;
  occurredAt?: Date;
  /** Called with validated form values + the chosen date. Should resolve when the write completes. */
  onSubmit: (values: TransactionFormValues, occurredAt: Date) => Promise<void>;
  /** Optional delete handler. When provided, a destructive button appears in the footer. */
  onDelete?: () => Promise<void> | void;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  title?: string;
};

/**
 * The single form for creating AND editing a transaction. Keeps both flows in
 * sync — change the kind segmenter or the wallet picker once and both
 * `app/transaction/new.tsx` and `app/transaction/[id].tsx` pick it up.
 *
 * Architecture: the form owns all transient state (typed amount, custom-
 * category in-progress, etc.). The parent owns the *async* part — the actual
 * Supabase write — via `onSubmit`. That keeps this component testable and
 * decouples it from React Query's mutation lifecycle.
 */
export function TransactionForm({
  mode, initialValues, occurredAt: occurredAtProp, onSubmit, onDelete, isSubmitting, isDeleting, title,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const wallets = useWallets();
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const currency = useCurrency();

  // Date lives outside react-hook-form because the picker mutates it through
  // an imperative event API rather than a controlled input.
  const [occurredAt, setOccurredAt] = useState<Date>(initialValues?.occurredAt ?? occurredAtProp ?? new Date());

  // Cross-platform date picker state machine:
  //   - On iOS: setting `pickerMode` to 'date' or 'time' renders the picker
  //     inline on demand. Setting it to null hides the picker.
  //   - On Android: the picker is a system dialog spawned by mounting the
  //     DateTimePicker element. We mount → user dismisses → onChange fires
  //     with `event.type` === 'set' or 'dismissed' → we unmount.
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);

  // Local state for the amount input. Stored as text so we can preserve the
  // user's typed decimals; converted to a number at validation time.
  const [amountText, setAmountText] = useState<string>(
    initialValues?.amount !== undefined ? String(initialValues.amount) : '',
  );
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<IconName>('label');

  const { control, handleSubmit, watch, setValue, formState } = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: initialValues?.kind ?? 'expense',
      amount: initialValues?.amount ?? (undefined as unknown as number),
      walletId: initialValues?.walletId ?? (undefined as unknown as string),
      categoryId: initialValues?.categoryId ?? (undefined as unknown as string),
      merchant: initialValues?.merchant ?? '',
      note: initialValues?.note ?? '',
    },
    mode: 'onBlur',
  });

  const kind = watch('kind');
  const walletId = watch('walletId');
  const categoryId = watch('categoryId');

  // Pre-select the user's first wallet on create when none is set yet.
  useEffect(() => {
    if (mode !== 'create') return;
    if (!walletId && wallets.data && wallets.data[0]) {
      setValue('walletId', wallets.data[0].id, { shouldValidate: false });
    }
  }, [mode, walletId, wallets.data, setValue]);

  const availableCategories = useMemo(
    () => (categories.data ?? []).filter((c) => c.kind === kind),
    [categories.data, kind],
  );

  const submit = (v: TransactionFormValues) => onSubmit(v, occurredAt);

  /**
   * DateTimePicker onChange behavior differs between platforms — encapsulating
   * the differences here so the JSX stays clean:
   *   - iOS spinner: `event.type` is always 'set'; we update value and keep
   *     the picker visible until the user taps elsewhere.
   *   - Android: `event.type` is 'set' (user picked) or 'dismissed' (user
   *     cancelled); either way we unmount the picker. After picking a date
   *     we chain into the time picker for a complete flow.
   */
  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    const isAndroid = Platform.OS === 'android';
    const wasDate = pickerMode === 'date';
    if (isAndroid) setPickerMode(null);

    if (event.type === 'dismissed' || !selected) return;

    setOccurredAt(selected);

    // After a date pick on Android, automatically chain into a time pick so
    // the user only taps once to set both. On iOS we let them tap "Time" if
    // they want — the inline picker affords that.
    if (isAndroid && wasDate) {
      // setTimeout to let the dialog fully dismiss before opening the next.
      setTimeout(() => setPickerMode('time'), 50);
    }
  };

  const saveNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return Alert.alert('Name required', 'Give your category a short name.');
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
  const headerTitle = title ?? (mode === 'edit' ? 'Edit transaction' : 'New transaction');

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.surfaceContainerLow }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={[styles.grabber, { backgroundColor: colors.surfaceContainerHighest }]} />
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Icon name="close" size={22} color="onSurface" />
            </Pressable>
            <Text variant="titleLg" color="onSurface">{headerTitle}</Text>
            <View style={{ width: 22 }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Kind segmented */}
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <View style={[styles.segmented, { backgroundColor: colors.surfaceContainerLow }]}>
                <SegBtn label="Expense" icon="remove_circle" color="tertiary"
                  active={field.value === 'expense'}
                  onPress={() => { field.onChange('expense'); setValue('categoryId', undefined as unknown as string); }} />
                <SegBtn label="Income" icon="add_circle" color="secondary"
                  active={field.value === 'income'}
                  onPress={() => { field.onChange('income'); setValue('categoryId', undefined as unknown as string); }} />
                <SegBtn label="Transfer" icon="swap_horiz" color="primary"
                  active={field.value === 'transfer'}
                  onPress={() => { field.onChange('transfer'); setValue('categoryId', undefined as unknown as string); }} />
              </View>
            )}
          />

          {/* Amount hero */}
          <Card tone="high" padding={spacing[8]} vault>
            <Text variant="labelSm" color="onSurfaceVariant">Amount</Text>
            <Controller
              control={control}
              name="amount"
              render={({ field, fieldState }) => (
                <View>
                  <View style={styles.amountRow}>
                    <Text variant="displayLg" color="onSurface" style={{ marginRight: 8 }}>
                      {currencySymbol(currency)}
                    </Text>
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor={colors.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      value={amountText}
                      onChangeText={(t) => {
                        const cleaned = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                        setAmountText(cleaned);
                        field.onChange(cleaned === '' ? undefined : Number(cleaned));
                      }}
                      onBlur={field.onBlur}
                      selectionColor={colors.primary}
                      cursorColor={colors.primary}
                      style={[styles.amountInput, { color: colors.onSurface }]}
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
            <Text variant="labelMd" color="onSurfaceVariant">Wallet</Text>
            {noWallets ? (
              <Card tone="low" padding={spacing[4]}>
                <Text variant="bodyMd" color="onSurfaceVariant">
                  You don't have a wallet yet. Re-run the migrations in <Text color="primary">supabase/migrations</Text>.
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
              <Text variant="labelMd" color="onSurfaceVariant">Category</Text>
              {kind !== 'transfer' && (
                <Pressable onPress={() => setAddingCategory((v) => !v)} hitSlop={8} style={styles.newBtn}>
                  <Icon name={addingCategory ? 'close' : 'add'} size={14} color="primary" />
                  <Text variant="labelMd" color="primary">{addingCategory ? 'Cancel' : 'New'}</Text>
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
                  <Text variant="labelMd" color="onSurfaceVariant" style={{ marginBottom: spacing[2] }}>Icon</Text>
                  <View style={styles.iconGrid}>
                    {CUSTOM_ICON_CHOICES.map((name) => (
                      <Pressable
                        key={name}
                        onPress={() => setNewCategoryIcon(name)}
                        style={[
                          styles.iconChoice,
                          { backgroundColor: newCategoryIcon === name ? colors.surfaceContainerHighest : colors.surfaceContainer },
                          newCategoryIcon === name && { borderColor: colors.primary },
                        ]}
                      >
                        <Icon name={name} size={18} color={newCategoryIcon === name ? 'primary' : 'onSurfaceVariant'} />
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Button variant="primary" size="md" fullWidth loading={createCategory.isPending} onPress={saveNewCategory} haptic="success">
                  Save category
                </Button>
              </Card>
            )}

            {noCategoriesAtAll ? (
              <Card tone="low" padding={spacing[4]}>
                <Text variant="bodyMd" color="onSurfaceVariant">
                  No categories are seeded. Apply the migrations in <Text color="primary">supabase/migrations/</Text>.
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
                      style={[
                        styles.categoryTile,
                        { backgroundColor: selected ? colors.surfaceContainerHighest : colors.surfaceContainerLow },
                      ]}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
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
            <Pressable
              onPress={() => setPickerMode('date')}
              style={[styles.dateRow, { backgroundColor: colors.surfaceContainerLow }]}
              accessibilityLabel="Change date"
            >
              <Icon name="schedule" size={18} color="primary" />
              <View style={{ flex: 1 }}>
                <Text variant="labelSm" color="onSurfaceVariant">When</Text>
                <Text variant="titleSm" color="onSurface">
                  {format(occurredAt, "EEE, d MMM yyyy · h:mm a")}
                </Text>
              </View>
              <Icon name="chevron_right" size={18} color="onSurfaceVariant" />
            </Pressable>

            {/* Inline picker — iOS shows a wheel below; Android opens a
                system dialog. We chain date → time on Android via onPickerChange. */}
            {pickerMode && (
              <DateTimePicker
                value={occurredAt}
                mode={pickerMode}
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant={colors.mode === 'dark' ? 'dark' : 'light'}
                maximumDate={new Date()}
                onChange={onPickerChange}
                style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
              />
            )}
            {Platform.OS === 'ios' && pickerMode && (
              <View style={styles.iosPickerActions}>
                <Pressable onPress={() => setPickerMode(pickerMode === 'date' ? 'time' : 'date')} hitSlop={8}>
                  <Text variant="labelMd" color="primary">
                    {pickerMode === 'date' ? 'Switch to time' : 'Switch to date'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setPickerMode(null)} hitSlop={8}>
                  <Text variant="labelMd" color="primary">Done</Text>
                </Pressable>
              </View>
            )}
          </View>

          {(formState.errors.walletId || formState.errors.categoryId || formState.errors.amount) && (
            <Card tone="low" padding={spacing[3]}>
              <Text variant="labelSm" color="error">
                {formState.errors.amount?.message ? 'Enter an amount. ' : ''}
                {formState.errors.walletId?.message ? 'Pick a wallet. ' : ''}
                {formState.errors.categoryId?.message ? 'Pick a category.' : ''}
              </Text>
            </Card>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {onDelete ? (
            <Button variant="danger" size="lg" leftIcon="delete" loading={!!isDeleting} onPress={() => onDelete?.()} haptic="medium">
              Delete
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onPress={() => router.back()}>
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={formState.isSubmitting || !!isSubmitting}
            onPress={handleSubmit(submit)}
            haptic="success"
            style={{ flex: 1 }}
          >
            {mode === 'edit' ? 'Save changes' : 'Save'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SegBtn({ label, icon, color, active, onPress }: { label: string; icon: IconName; color: Color; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, active && { backgroundColor: colors.surfaceContainerHighest }]}>
      <Icon name={icon} size={16} color={active ? color : 'onSurfaceVariant'} />
      <Text variant="labelMd" color={active ? color : 'onSurfaceVariant'}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing[6], paddingTop: spacing[3], paddingBottom: spacing[3] },
  grabber: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[4] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { paddingHorizontal: spacing[6], paddingBottom: spacing[12], gap: spacing[6] },
  segmented: { flexDirection: 'row', padding: spacing[1], borderRadius: radius.lg, gap: spacing[1] },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.md,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing[2] },
  amountInput: {
    flex: 1, fontFamily: 'Manrope_700Bold', fontSize: 40, lineHeight: 48,
    padding: 0, includeFontPadding: false,
  },
  block: { gap: spacing[3] },
  chipRow: { gap: spacing[2], paddingVertical: spacing[1] },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    backgroundColor: 'rgba(160,228,254,0.1)', borderRadius: radius.pill,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryTile: {
    width: '31.5%', paddingVertical: spacing[3], paddingHorizontal: spacing[2],
    borderRadius: radius.md, alignItems: 'center', gap: spacing[2],
  },
  categoryIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  iconChoice: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  iosPicker: { alignSelf: 'stretch', height: 200 },
  iosPickerActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  footer: {
    flexDirection: 'row', gap: spacing[3],
    paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[4],
    borderTopWidth: 1, borderTopColor: 'rgba(66,72,86,0.12)',
  },
});
