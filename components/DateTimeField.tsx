import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatDMY } from '../lib/dates';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { fonts, radius, spacing } from '../lib/theme';

type Props = {
  label: string;
  value: Date | null;
  onChange: (v: Date) => void;
  error?: string | null;
  placeholder?: string;
};

function formatDateTime(d: Date): string {
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${formatDMY(d)}, ${time}`;
}

export function DateTimeField({ label, value, onChange, error, placeholder = 'Select time' }: Props) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);

  const initial = value ?? new Date();

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selected) onChange(selected);
    } else if (selected) {
      onChange(selected);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setShow(true)}
        accessibilityRole="button"
        style={[styles.field, !!error && styles.fieldError]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? formatDateTime(value) : placeholder}
        </Text>
        <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.pickerRoot}>
            <Pressable style={styles.pickerBackdrop} onPress={() => setShow(false)} />
            <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{label}</Text>
                <Pressable onPress={() => setShow(false)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={initial}
                mode="datetime"
                display="inline"
                themeVariant={scheme}
                onChange={onPick}
              />
            </View>
          </View>
        </Modal>
      ) : null}
      {show && Platform.OS === 'android' ? (
        <DateTimePicker value={initial} mode="datetime" display="default" onChange={onPick} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { marginBottom: 16 },
  label: { fontSize: 15, fontFamily: fonts.medium, color: colors.text, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  fieldError: { borderColor: colors.danger },
  value: { fontSize: 17, fontFamily: fonts.regular, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { marginTop: 6, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  pickerRoot: { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  pickerSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  pickerTitle: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  doneText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
}));
