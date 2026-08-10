import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

type Props = {
  initials: string[];
  total: number;
  /** how many initial chips to show before collapsing into "+N" */
  max?: number;
};

const CHIP = 24;

export function AvatarStack({ initials, total, max = 2 }: Props) {
  const shown = initials.slice(0, max);
  const extra = total - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((initial, i) => (
        <View key={i} style={[styles.chip, i > 0 && styles.overlap]}>
          <Text style={styles.initial}>{initial}</Text>
        </View>
      ))}
      {extra > 0 ? (
        <View style={[styles.chip, styles.overlap]}>
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: CHIP / 2,
    backgroundColor: colors.accentTint,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlap: { marginLeft: -8 },
  initial: { fontSize: 11, fontFamily: fonts.semibold, color: colors.text },
  moreText: { fontSize: 10, fontFamily: fonts.medium, color: colors.textSecondary },
});
