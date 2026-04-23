import { useMemo, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, FlatList, TextInput } from 'react-native';
import { useTheme } from '@/theme';
import { radius, spacing, type } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { currencySymbol } from '@/lib/formatters';

type Props = {
  visible: boolean;
  current: string;
  onClose: () => void;
  onPick: (code: string) => void;
};

export type CurrencyOption = { code: string; name: string; region?: string };

/**
 * Curated shortlist. ETB first per primary persona. If a user wants something
 * not on the list they can still type to filter — every ISO 4217 code is
 * rendered as-is because Intl in Hermes carries the full ICU set.
 */
const CURRENCIES: CurrencyOption[] = [
  { code: 'ETB', name: 'Ethiopian Birr', region: 'Ethiopia' },
  { code: 'USD', name: 'US Dollar', region: 'United States' },
  { code: 'EUR', name: 'Euro', region: 'Eurozone' },
  { code: 'GBP', name: 'British Pound', region: 'United Kingdom' },
  { code: 'KES', name: 'Kenyan Shilling', region: 'Kenya' },
  { code: 'NGN', name: 'Nigerian Naira', region: 'Nigeria' },
  { code: 'ZAR', name: 'South African Rand', region: 'South Africa' },
  { code: 'AED', name: 'UAE Dirham', region: 'United Arab Emirates' },
  { code: 'SAR', name: 'Saudi Riyal', region: 'Saudi Arabia' },
  { code: 'INR', name: 'Indian Rupee', region: 'India' },
  { code: 'CAD', name: 'Canadian Dollar', region: 'Canada' },
  { code: 'AUD', name: 'Australian Dollar', region: 'Australia' },
  { code: 'JPY', name: 'Japanese Yen', region: 'Japan' },
  { code: 'CHF', name: 'Swiss Franc', region: 'Switzerland' },
];

export function CurrencyPickerModal({ visible, current, onClose, onPick }: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.region?.toLowerCase().includes(q) ?? false),
    );
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Dimmed scrim */}
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surfaceContainerLow }]}>
        <View style={[styles.grabber, { backgroundColor: colors.surfaceContainerHighest }]} />
        <View style={styles.header}>
          <Text variant="titleLg" color="onSurface">
            Choose currency
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="close" size={22} color="onSurface" />
          </Pressable>
        </View>

        <View style={[styles.search, { backgroundColor: colors.surfaceContainer }]}>
          <Icon name="search" size={18} color="onSurfaceVariant" />
          <TextInput
            placeholder="Search currency or region"
            placeholderTextColor={colors.onSurfaceVariant}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
            autoCorrect={false}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            style={[styles.searchInput, { color: colors.onSurface }]}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const active = item.code === current;
            return (
              <Pressable
                onPress={() => {
                  onPick(item.code);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: active
                      ? colors.surfaceContainerHighest
                      : pressed
                        ? colors.surfaceContainer
                        : 'transparent',
                  },
                ]}
              >
                <View style={[styles.codeBadge, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <Text variant="titleSm" color={active ? 'primary' : 'onSurface'}>
                    {currencySymbol(item.code)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSm" color="onSurface">
                    {item.name}
                  </Text>
                  <Text variant="bodySm" color="onSurfaceVariant">
                    {item.code}
                    {item.region ? ` · ${item.region}` : ''}
                  </Text>
                </View>
                {active && <Icon name="check_circle" size={22} color="primary" />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: spacing[8], alignItems: 'center' }}>
              <Text variant="bodyMd" color="onSurfaceVariant">
                No currency matches "{query}".
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    maxHeight: '82%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[6],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, ...type.bodyLg, padding: 0, includeFontPadding: false },
  list: { paddingHorizontal: spacing[3], paddingTop: spacing[4], gap: spacing[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
  },
  codeBadge: {
    minWidth: 44, height: 44,
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
});
