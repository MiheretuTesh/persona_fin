import { Tabs, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { spacing, radius, blur } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Icon, IconName } from '@/components/ui/Icon';

type TabDef = { name: 'index' | 'history' | 'budget' | 'insights' | 'settings'; label: string; icon: IconName };

const TABS: TabDef[] = [
  { name: 'index', label: 'Vault', icon: 'account_balance_wallet' },
  { name: 'history', label: 'History', icon: 'history' },
  { name: 'budget', label: 'Budget', icon: 'pie_chart' },
  { name: 'insights', label: 'Insights', icon: 'insights' },
  { name: 'settings', label: 'Settings', icon: 'tune' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
      }}
      tabBar={(props) => <VaultTabBar {...props} />}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

function VaultTabBar({
  state,
  navigation,
}: {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, mode } = useTheme();

  const barBg = mode === 'dark' ? 'rgba(8,14,26,0.65)' : 'rgba(246,248,255,0.75)';
  const hairline = mode === 'dark' ? 'rgba(66,72,86,0.15)' : 'rgba(111,117,133,0.15)';

  const onTab = (name: string, isFocused: boolean) => {
    Haptics.selectionAsync();
    if (!isFocused) navigation.navigate(name);
  };

  const onAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/transaction/new');
  };

  const primaryTabs = TABS.filter((t) => t.name !== 'settings');
  const currentRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}>
      <BlurView
        tint={mode === 'dark' ? 'dark' : 'light'}
        intensity={Platform.OS === 'ios' ? blur.medium : blur.strong}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: barBg }]} />
      <View style={[styles.hairline, { backgroundColor: hairline }]} />
      <View style={styles.row}>
        {primaryTabs.slice(0, 2).map((t) => (
          <TabButton
            key={t.name}
            def={t}
            focused={currentRoute === t.name}
            onPress={() => onTab(t.name, currentRoute === t.name)}
          />
        ))}

        <Pressable onPress={onAdd} style={styles.fab} accessibilityLabel="Add transaction">
          <View
            style={[
              styles.fabInner,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
          >
            <Icon name="add" size={28} color="onPrimary" />
          </View>
          <Text variant="labelSm" color="onSurfaceVariant" style={{ marginTop: 4 }}>
            Add
          </Text>
        </Pressable>

        {primaryTabs.slice(2).map((t) => (
          <TabButton
            key={t.name}
            def={t}
            focused={currentRoute === t.name}
            onPress={() => onTab(t.name, currentRoute === t.name)}
          />
        ))}
      </View>
    </View>
  );
}

function TabButton({ def, focused, onPress }: { def: TabDef; focused: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
      <View
        style={[
          styles.tabInner,
          focused && { backgroundColor: colors.surfaceContainerHighest },
        ]}
      >
        <Icon name={def.icon} size={22} color={focused ? 'primary' : 'onSurfaceVariant'} />
      </View>
      <Text variant="labelSm" color={focused ? 'primary' : 'onSurfaceVariant'} style={{ marginTop: 4 }}>
        {def.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingTop: spacing[2],
    paddingHorizontal: spacing[3],
    overflow: 'hidden',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  hairline: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
  },
  tab: { alignItems: 'center', flex: 1, paddingVertical: spacing[2] },
  tabInner: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
  },
  fab: { alignItems: 'center', marginHorizontal: spacing[2], paddingTop: spacing[1] },
  fabInner: {
    width: 52, height: 52,
    borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
});
