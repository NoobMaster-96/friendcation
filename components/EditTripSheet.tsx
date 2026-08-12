import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { dmyToISO, isoToDMY, isValidDMY } from '../lib/dates';
import { formatDateRange } from '../lib/trips';
import type { Trip } from '../lib/types';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { Button } from './Button';
import { colors, fonts, radius, spacing } from '../lib/theme';

type Props = {
  trip: Trip;
  visible: boolean;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
};

export function EditTripSheet({ trip, visible, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(trip.name);
  const [start, setStart] = useState(isoToDMY(trip.start_date));
  const [end, setEnd] = useState(isoToDMY(trip.end_date));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(trip.name);
      setStart(isoToDMY(trip.start_date));
      setEnd(isoToDMY(trip.end_date));
      setError(null);
      setDatesOpen(false);
    }
  }, [visible, trip]);

  const onSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Give your trip a name.');
      return;
    }
    if (start && !isValidDMY(start)) {
      setError('Start date must be DD-MM-YYYY.');
      return;
    }
    if (end && !isValidDMY(end)) {
      setError('End date must be DD-MM-YYYY.');
      return;
    }
    const startISO = start ? dmyToISO(start) : null;
    const endISO = end ? dmyToISO(end) : null;
    if (startISO && endISO && endISO < startISO) {
      setError('End date can’t be before the start date.');
      return;
    }
    setSaving(true);
    const { data, error: updateError } = await supabase
      .from('trips')
      .update({ name: name.trim(), start_date: startISO, end_date: endISO })
      .eq('id', trip.id)
      .select('id,name,start_date,end_date,created_by,invite_code,created_at')
      .single();
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onSaved(data as Trip);
    onClose();
  };

  const previewStartISO = start ? dmyToISO(start) : null;
  const previewEndISO = end ? dmyToISO(end) : null;
  const hasDates = !!(previewStartISO || previewEndISO);
  const summary = hasDates ? formatDateRange(previewStartISO, previewEndISO) : 'Add dates';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.title}>Edit trip</Text>

          <TextField
            label="Trip name"
            value={name}
            onChangeText={setName}
            placeholder="Trip name"
            autoCapitalize="words"
          />

          <Text style={styles.datesLabel}>Dates</Text>
          <Pressable
            onPress={() => setDatesOpen((o) => !o)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.summaryField,
              datesOpen && styles.summaryFieldActive,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={[styles.summaryText, !hasDates && styles.summaryPlaceholder]}>
              {summary}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          </Pressable>

          {datesOpen ? (
            <>
              <DateField label="Start date" value={start} onChange={setStart} />
              <DateField label="End date" value={end} onChange={setEnd} />
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
            <Button label="Save" onPress={onSave} loading={saving} style={styles.action} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(43,36,29,0.35)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '85%',
  },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.lg },
  datesLabel: { fontSize: 15, fontFamily: fonts.medium, color: colors.text, marginBottom: 8 },
  summaryField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryFieldActive: { borderColor: colors.borderStrong },
  summaryText: { fontSize: 17, fontFamily: fonts.regular, color: colors.text },
  summaryPlaceholder: { color: colors.textMuted },
  error: { marginBottom: spacing.sm, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { flex: 1 },
});
