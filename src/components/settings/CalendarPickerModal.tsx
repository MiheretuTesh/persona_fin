import { Modal, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import {
  formatPeriod,
  formatDayMonth,
  type CalendarScript,
  type CalendarSystem,
} from '@/lib/calendar';

type Props = {
  visible: boolean;
  system: CalendarSystem;
  script: CalendarScript;
  onClose: () => void;
  onPickSystem: (system: CalendarSystem) => void;
  onPickScript: (script: CalendarScript) => void;
};

/**
 * Calendar chooser.
 *
 * Two axes, presented in order of consequence:
 *   1. Which calendar — changes what "this period" means for budgets, month
 *      totals, insights, and alert windows. Consequential enough to be worth
 *      spelling out, hence the explanatory line under each option.
 *   2. Which script for Ethiopian month names — cosmetic, so it only appears
 *      once the Ethiopian calendar is selected.
 *
 * Each option previews today's date in its own format. Abstract labels like
 * "Ethiopian calendar" don't convey much; "4 ነሐሴ 2018" does immediately.
 */
export function CalendarPickerModal({
  visible,
  system,
  script,
  onClose,
  onPickSystem,
  onPickScript,
}: Props) {
  const { colors } = useTheme();
  const today = new Date();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surfaceContainerLow }]}>
        <View style={[styles.grabber, { backgroundColor: colors.surfaceContainerHighest }]} />
        <View style={styles.header}>
          <Text variant="titleLg" color="onSurface">
            Calendar
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="close" size={22} color="onSurface" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text variant="bodySm" color="onSurfaceVariant">
            Your calendar decides how dates are shown and where each period starts and ends —
            budgets, summaries, and spending alerts all follow it.
          </Text>

          <Option
            active={system === 'gregorian'}
            icon="calendar_month"
            title="Gregorian"
            subtitle="Months run 1–28/31. The international standard."
            preview={`${formatPeriod(today, 'gregorian')} · ${formatDayMonth(today, 'gregorian')}`}
            onPress={() => onPickSystem('gregorian')}
          />
          <Option
            active={system === 'ethiopian'}
            icon="public"
            title="Ethiopian"
            subtitle="13 months: twelve of 30 days plus ጳጉሜ (5–6 days). New year falls in September."
            preview={`${formatPeriod(today, 'ethiopian', { script })} · ${formatDayMonth(today, 'ethiopian', { script })}`}
            onPress={() => onPickSystem('ethiopian')}
          />

          {system === 'ethiopian' && (
            <>
              <Text variant="labelMd" color="onSurfaceVariant" style={{ marginTop: spacing[4] }}>
                Month names
              </Text>
              <View style={styles.scriptRow}>
                <ScriptChip
                  label="አማርኛ"
                  hint={formatPeriod(today, 'ethiopian', { script: 'amharic' })}
                  active={script === 'amharic'}
                  onPress={() => onPickScript('amharic')}
                />
                <ScriptChip
                  label="Latin"
                  hint={formatPeriod(today, 'ethiopian', { script: 'latin' })}
                  active={script === 'latin'}
                  onPress={() => onPickScript('latin')}
                />
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Option({
  active,
  icon,
  title,
  subtitle,
  preview,
  onPress,
}: {
  active: boolean;
  icon: string;
  title: string;
  subtitle: string;
  preview: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: active ? colors.surfaceContainerHigh : colors.surfaceContainer,
          borderColor: active ? colors.primary : 'transparent',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.optionTile, { backgroundColor: colors.surfaceContainerHighest }]}>
        <Icon name={icon} size={20} color={active ? 'primary' : 'onSurfaceVariant'} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleSm" color={active ? 'primary' : 'onSurface'}>
          {title}
        </Text>
        <Text variant="bodySm" color="onSurfaceVariant">
          {subtitle}
        </Text>
        <Text variant="labelSm" color="onSurface" style={{ marginTop: spacing[1] }}>
          Today: {preview}
        </Text>
      </View>
      {active && <Icon name="check_circle" size={22} color="primary" />}
    </Pressable>
  );
}

function ScriptChip({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.scriptChip,
        {
          backgroundColor: active ? colors.surfaceContainerHighest : colors.surfaceContainer,
          borderColor: active ? colors.primary : 'transparent',
        },
      ]}
    >
      <Text variant="titleSm" color={active ? 'primary' : 'onSurface'}>
        {label}
      </Text>
      <Text variant="labelSm" color="onSurfaceVariant" numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
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
  body: { paddingHorizontal: spacing[6], gap: spacing[3], paddingBottom: spacing[4] },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionTile: {
    width: 40, height: 40,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  scriptRow: { flexDirection: 'row', gap: spacing[2] },
  scriptChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
