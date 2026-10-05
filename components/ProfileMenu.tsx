import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { ThemedSwitch } from './ThemedSwitch';
import { fonts, spacing } from '../lib/theme';

export function ProfileMenu() {
  const styles = useStyles();
  const { isDark, toggleScheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const first = profile?.first_name?.trim() ?? '';
  const last = profile?.last_name?.trim() ?? '';
  const initials = ((first[0] ?? '') + (last[0] ?? first[1] ?? '')).toUpperCase() || '··';

  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Profile menu"
        style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
      >
        <Text style={styles.initials}>{initials}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.menu, { top: insets.top + 58, right: spacing.lg }]}>
          <MenuItem
            icon="person-outline"
            label="Profile"
            onPress={() => {
              close();
              router.push('/profile');
            }}
          />
          <View style={styles.divider} />
          {/* Stays open so the switch to dark/light is visible immediately. */}
          <MenuItem
            icon="moon-outline"
            label="Dark mode"
            onPress={toggleScheme}
            checked={isDark}
            trailing={
              <ThemedSwitch value={isDark} onValueChange={toggleScheme} style={styles.switch} />
            }
          />
          <View style={styles.divider} />
          <MenuItem
            icon="log-out-outline"
            label="Sign out"
            onPress={() => {
              close();
              signOut();
            }}
          />
        </View>
      </Modal>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  checked,
  trailing,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  /** Set for toggle rows: announces the row as a switch with this state. */
  checked?: boolean;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isToggle = checked !== undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={isToggle ? 'switch' : 'button'}
      accessibilityState={isToggle ? { checked } : undefined}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={styles.itemLabel}>{label}</Text>
      {trailing}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  initials: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textAccent },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  menu: {
    position: 'absolute',
    minWidth: 220,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemPressed: { backgroundColor: colors.surface },
  itemLabel: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  // Scaled down so the toggle row keeps the same height as the other rows.
  switch: { marginVertical: -6, transform: [{ scale: 0.85 }] },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
}));
