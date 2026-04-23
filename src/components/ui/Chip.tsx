import { ReactNode } from 'react';
import { Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { Text } from './Text';
import { Icon, IconName } from './Icon';

type Props = {
  label: string;
  icon?: IconName;
  tone?: 'neutral' | 'primary' | 'secondary' | 'tertiary';
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Chip({ label, icon, tone = 'neutral', selected, onPress, style }: Props) {
  const colors = useColors();
  const toneBg = {
    neutral: colors.surfaceContainer,
    primary: colors.mode === 'dark' ? 'rgba(160,228,254,0.12)' : 'rgba(0,67,84,0.08)',
    secondary: colors.mode === 'dark' ? 'rgba(78,222,163,0.12)' : 'rgba(0,108,73,0.08)',
    tertiary: colors.mode === 'dark' ? 'rgba(255,155,148,0.12)' : 'rgba(192,48,43,0.08)',
  } as const;
  const toneText = {
    neutral: 'onSurfaceVariant',
    primary: 'primary',
    secondary: 'secondary',
    tertiary: 'tertiary',
  } as const;

  const Comp: any = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: selected ? colors.surfaceContainerHighest : toneBg[tone] },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={14} color={toneText[tone]} />}
      <Text variant="labelSm" color={toneText[tone]}>
        {label}
      </Text>
    </Comp>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
