import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton } from './CircleButton';
import { colors, fonts, spacing } from '../lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  /** When set, a bare pencil icon appears next to the subtitle. */
  onEdit?: () => void;
};

export function ScreenHeader({ title, subtitle, onBack, right, onEdit }: Props) {
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

      {subtitle ? (
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit trip"
              style={({ pressed }) => [styles.edit, pressed && { opacity: 0.5 }]}
            >
              <Ionicons name="pencil" size={15} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
    marginBottom: 16,
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
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  edit: { padding: 2 },
});
