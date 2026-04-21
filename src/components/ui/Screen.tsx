import { ReactNode } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { palette } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** Extra top padding to clear the fixed translucent TopBar. Default: 72. */
  topInset?: number;
  /** Extra bottom padding to clear the translucent tab bar. Default: 100. */
  bottomInset?: number;
};

/**
 * Dark-first safe-area screen. Handles scroll, pull-to-refresh, and the
 * insets needed to clear fixed glassmorphism chrome (top bar / tab bar).
 */
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
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingTop: topInset, paddingBottom: bottomInset }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            tintColor={palette.primary}
            colors={[palette.primary]}
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            progressBackgroundColor={palette.surfaceContainer}
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
    <SafeAreaView edges={edges} style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={palette.surface} />
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surface },
  flex: { flex: 1 },
});
