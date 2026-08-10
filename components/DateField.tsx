import { useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatDMY, parseDMYtoDate } from '../lib/dates';
import { colors, fonts, radius } from '../lib/theme';

type Props = {
  label: string;
  value: string; // DD-MM-YYYY
  onChange: (v: string) => void;
  error?: string | null;
  placeholder?: string;
  minimumDate?: Date;
};

export function DateField({
  label,
  value,
  onChange,
  error,
  placeholder = 'DD-MM-YYYY',
  minimumDate,
}: Props) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);

  const open = () => {
    Keyboard.dismiss();
    setShow(true);
  };

  const initial = parseDMYtoDate(value) ?? new Date();

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selected) onChange(formatDMY(selected));
    } else if (selected) {
      onChange(formatDMY(selected));
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.text}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Pressable
          onPress={open}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          style={styles.iconBtn}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {show && Platform.OS === 'ios' ? (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={initial}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            onChange={onPick}
          />
          <Pressable
            onPress={() => setShow(false)}
            style={styles.doneBtn}
            accessibilityRole="button"
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={initial}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={onPick}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 15, fontFamily: fonts.medium, color: colors.text, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  fieldFocused: { borderColor: colors.borderStrong },
  fieldError: { borderColor: colors.danger },
  input: { flex: 1, fontSize: 17, fontFamily: fonts.regular, color: colors.text, paddingVertical: 0 },
  iconBtn: { paddingLeft: 8 },
  error: { marginTop: 6, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  iosPicker: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 8,
  },
  doneBtn: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 },
  doneText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
});
