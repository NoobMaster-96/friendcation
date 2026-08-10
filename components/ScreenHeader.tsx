import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton } from './CircleButton';
import { colors, fonts, spacing } from '../lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  const hasTopRow = !!onBack || !!right;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {hasTopRow ? (
        <View style={styles.topRow}>
          <View style={styles.slotLeft}>
            {onBack ? (
              <CircleButton icon="chevron-back" onPress={onBack} accessibilityLabel="Back" />
            ) : null}
          </View>
          <View style={styles.slotRight}>{right ?? null}</View>
        </View>
      ) : (
        <View style={styles.topSpacer} />
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  slotLeft: { alignItems: 'flex-start', justifyContent: 'center' },
  slotRight: { alignItems: 'flex-end', justifyContent: 'center' },
  topSpacer: { height: spacing.xs },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
