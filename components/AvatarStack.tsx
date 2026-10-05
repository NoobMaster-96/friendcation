import { Text, View } from 'react-native';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { fonts } from '../lib/theme';

type Props = {
  initials: string[];
  total: number;
  /** How many circles to show before collapsing the rest into "+N". */
  max?: number;
  size?: number;
  /** How far each circle overlaps the previous one. */
  overlap?: number;
  /** Ring around each circle so overlapping circles read as separate; defaults to surface-1. */
  ringColor?: string;
  ringWidth?: number;
};

/** Overlapping initials circles (bg-accent / text-accent) with a "+N" overflow circle. */
export function AvatarStack({
  initials,
  total,
  max = 2,
  size = 24,
  overlap = 8,
  ringColor,
  ringWidth = 2,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const shown = initials.slice(0, max);
  const extra = total - shown.length;
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ringWidth,
    borderColor: ringColor ?? colors.surface,
  };
  const fontSize = Math.round(size * 0.9) / 2;

  return (
    <View style={styles.row}>
      {shown.map((initial, i) => (
        <View key={i} style={[styles.circle, circle, i > 0 && { marginLeft: -overlap }]}>
          <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[styles.circle, styles.overflow, circle, shown.length > 0 && { marginLeft: -overlap }]}
        >
          <Text style={[styles.overflowText, { fontSize: fontSize - 1 }]}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  circle: { backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
  overflow: { backgroundColor: colors.surface },
  initial: { fontFamily: fonts.semibold, color: colors.textAccent },
  overflowText: { fontFamily: fonts.medium, color: colors.textSecondary },
}));
