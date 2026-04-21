import { View, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '@/theme';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

type Props = {
  icon: IconName;
  title: string;
  body?: string;
};

export function EmptyState({ icon, title, body }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.orb}>
        <Icon name={icon} size={28} color="primary" />
      </View>
      <Text variant="titleMd" color="onSurface" center>
        {title}
      </Text>
      {body && (
        <Text variant="bodyMd" color="onSurfaceVariant" center>
          {body}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing[3], padding: spacing[8] },
  orb: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
