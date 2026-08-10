import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  options: [Option<T>, Option<T>];
  value: T;
  onChange: (v: T) => void;
};

export function SegmentedToggle<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
  label: { fontSize: 14 },
  labelActive: { fontFamily: fonts.semibold, color: colors.text },
  labelInactive: { fontFamily: fonts.medium, color: colors.textSecondary },
});
