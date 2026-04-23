import { View, Image, StyleSheet } from 'react-native';
import { useColors } from '@/theme';
import { Text } from './Text';

type Props = {
  name?: string | null;
  uri?: string | null;
  size?: number;
};

function initials(n?: string | null) {
  if (!n) return 'E';
  const parts = n.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'E';
}

export function Avatar({ name, uri, size = 40 }: Props) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceContainerHighest,
          borderColor: colors.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text variant="titleSm" color="primary">
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
});
