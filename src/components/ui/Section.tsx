import { ReactNode } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { spacing } from '@/theme';
import { Text } from './Text';

type Props = {
  title: string;
  trailing?: string;
  onTrailingPress?: () => void;
  children: ReactNode;
};

/** Repeatable section: "Recent Transactions" / "See All" header + children. */
export function Section({ title, trailing, onTrailingPress, children }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="titleLg" color="primary">
          {title}
        </Text>
        {trailing && (
          <Pressable onPress={onTrailingPress} hitSlop={8}>
            <Text variant="labelMd" color="primary">
              {trailing}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
