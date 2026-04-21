import { ReactNode } from 'react';
import { Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import { palette, radius, spacing } from '@/theme';
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

const toneBg = {
  neutral: palette.surfaceContainer,
  primary: 'rgba(160,228,254,0.12)',
  secondary: 'rgba(78,222,163,0.12)',
  tertiary: 'rgba(255,155,148,0.12)',
} as const;

const toneText = {
  neutral: 'onSurfaceVariant',
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
} as const;

/** Rounded pill used for metadata (month filter, category tag, trend indicator). */
export function Chip({ label, icon, tone = 'neutral', selected, onPress, style }: Props) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp onPress={onPress} style={[styles.base, { backgroundColor: selected ? palette.surfaceContainerHighest : toneBg[tone] }, style]}>
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
