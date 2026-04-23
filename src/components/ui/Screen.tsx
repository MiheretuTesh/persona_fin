import { ReactNode } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, ViewStyle, RefreshControl, Platform } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  topInset?: number;
  bottomInset?: number;
};

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  refreshing,
  onRefresh,
  contentStyle,
  topInset = 72,
  bottomInset = 100,
}: Props) {
  const { colors, mode } = useTheme();

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingTop: topInset, paddingBottom: bottomInset }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            tintColor={colors.primary}
            colors={[colors.primary]}
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={colors.surfaceContainer}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { paddingTop: topInset, paddingBottom: bottomInset }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.surface }]}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, flex: { flex: 1 } });
