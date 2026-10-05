import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles } from '../context/ThemeContext';
import { fonts } from '../lib/theme';

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  options: [Option<T>, Option<T>];
  value: T;
  onChange: (v: T) => void;
  /** Smaller variant for use inline next to a label. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  compact = false,
  style,
}: Props<T>) {
  const styles = useStyles();
  return (
    <View style={[styles.track, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, compact && styles.segmentCompact, active && styles.segmentActive]}
          >
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                active ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentCompact: { paddingVertical: 6, borderRadius: 8 },
  label: { fontSize: 14 },
  labelCompact: { fontSize: 13 },
  labelActive: { fontFamily: fonts.semibold, color: colors.text },
  labelInactive: { fontFamily: fonts.medium, color: colors.textSecondary },
}));
