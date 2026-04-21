import { Tabs, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { palette, spacing, radius, blur } from '@/theme';
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.surface },
      }}
      tabBar={(props) => <VaultTabBar {...props} />}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

/**
 * Custom glassmorphism bar matching the Stitch design: floating rounded-top bar,
 * selected tab has a surface_container_highest pill highlight, Add sits as a
 * centered floating cyan orb that opens the transaction/new modal.
 */
function VaultTabBar({
  state,
  navigation,
}: {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void; emit: (event: any) => any };
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const onTab = (name: string, isFocused: boolean) => {
    Haptics.selectionAsync();
    if (!isFocused) navigation.navigate(name);
  };

  const onAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/transaction/new');
  };

  // Render order: [Vault, History, <ADD>, Budget, Insights]. Settings is NOT
  // on the bar per DS — it's reached via the top bar avatar.
  const primaryTabs = TABS.filter((t) => t.name !== 'settings');

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}>
      <BlurView tint="dark" intensity={Platform.OS === 'ios' ? blur.medium : blur.strong} style={StyleSheet.absoluteFill} />
      <View style={styles.bg} />
      <View style={styles.hairline} />
      <View style={styles.row}>
        {primaryTabs.slice(0, 2).map((t) => (
          <TabButton
            key={t.name}
            def={t}
            focused={state.routes[state.index]?.name === t.name}
            onPress={() => onTab(t.name, state.routes[state.index]?.name === t.name)}
          />
        ))}

        {/* Floating add */}
        <Pressable onPress={onAdd} style={styles.fab} accessibilityLabel="Add transaction">
          <View style={styles.fabInner}>
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
            focused={state.routes[state.index]?.name === t.name}
            onPress={() => onTab(t.name, state.routes[state.index]?.name === t.name)}
          />
        ))}
      </View>
    </View>
  );
}

function TabButton({ def, focused, onPress }: { def: TabDef; focused: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }}>
      <View style={[styles.tabInner, focused && { backgroundColor: palette.surfaceContainerHighest }]}>
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
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing[2],
    paddingHorizontal: spacing[3],
    overflow: 'hidden',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,14,26,0.65)' },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(66,72,86,0.15)',
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
  fab: {
    alignItems: 'center',
    marginHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
});
