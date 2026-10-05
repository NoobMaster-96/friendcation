import { Text, View } from 'react-native';
import { Pressable } from 'react-native';
import type { TripMember } from '../lib/members';
import { makeStyles } from '../context/ThemeContext';
import { fonts } from '../lib/theme';

type Props = {
  members: TripMember[];
  selectedIds: string[];
  onToggle?: (id: string) => void;
  onSelectAll?: () => void;
  readOnly?: boolean;
};

export function MemberChips({ members, selectedIds, onToggle, onSelectAll, readOnly }: Props) {
  const styles = useStyles();
  const shown = readOnly ? members.filter((m) => selectedIds.includes(m.userId)) : members;
  const allSelected = members.length > 0 && selectedIds.length === members.length;

  return (
    <View style={styles.row}>
      {shown.map((m) => {
        const selected = selectedIds.includes(m.userId);
        const first = m.name.split(' ')[0] || m.name;
        return (
          <Chip
            key={m.userId}
            selected={selected || readOnly === true}
            initials={m.initials}
            label={first}
            onPress={readOnly ? undefined : () => onToggle?.(m.userId)}
          />
        );
      })}
      {!readOnly && onSelectAll ? (
        <Chip
          selected={allSelected}
          label={allSelected ? 'Clear all' : 'Select all'}
          onPress={onSelectAll}
        />
      ) : null}
    </View>
  );
}

function Chip({
  selected,
  initials,
  label,
  onPress,
}: {
  selected: boolean;
  initials?: string;
  label: string;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        !initials && styles.chipNoAvatarPad,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      {initials ? (
        <View style={[styles.avatar, selected && styles.avatarSelected]}>
          <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>{initials}</Text>
        </View>
      ) : null}
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipSelected: { backgroundColor: colors.buttonFill, borderColor: colors.buttonFill },
  chipUnselected: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: 0.85 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: { backgroundColor: colors.onPrimarySubtle },
  avatarText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.text },
  avatarTextSelected: { color: colors.buttonText },
  label: { fontSize: 14, fontFamily: fonts.medium },
  labelSelected: { color: colors.buttonText },
  labelUnselected: { color: colors.text },
  chipNoAvatarPad: { paddingLeft: 12 },
}));
