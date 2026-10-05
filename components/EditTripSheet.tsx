import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { dmyToISO, isoToDMY, isValidDMY } from '../lib/dates';
import type { Trip } from '../lib/types';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { Button } from './Button';
import { makeStyles } from '../context/ThemeContext';
import { fonts, spacing } from '../lib/theme';

type Props = {
  trip: Trip;
  visible: boolean;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
};

export function EditTripSheet({ trip, visible, onClose, onSaved }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(trip.name);
  const [start, setStart] = useState(isoToDMY(trip.start_date));
  const [end, setEnd] = useState(isoToDMY(trip.end_date));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(trip.name);
      setStart(isoToDMY(trip.start_date));
      setEnd(isoToDMY(trip.end_date));
      setError(null);
    }
  }, [visible, trip]);

  const onSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Give your travel diary a name.');
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.title}>Edit travel diary</Text>

          <TextField
            label="Travel diary name"
            value={name}
            onChangeText={setName}
            placeholder="Travel diary name"
            autoCapitalize="words"
          />

          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <DateField label="Start date" value={start} onChange={setStart} />
            </View>
            <View style={styles.dateCol}>
              <DateField label="End date" value={end} onChange={setEnd} />
            </View>
          </View>

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

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
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
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateCol: { flex: 1 },
  error: { marginBottom: spacing.sm, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { flex: 1 },
}));
