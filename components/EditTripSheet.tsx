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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { isValidDateStr } from '../lib/trips';
import type { Trip } from '../lib/types';
import { TextField } from './TextField';
import { Button } from './Button';
import { colors, fonts, spacing } from '../lib/theme';

type Props = {
  trip: Trip;
  visible: boolean;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
};

export function EditTripSheet({ trip, visible, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(trip.name);
  const [start, setStart] = useState(trip.start_date ?? '');
  const [end, setEnd] = useState(trip.end_date ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(trip.name);
      setStart(trip.start_date ?? '');
      setEnd(trip.end_date ?? '');
      setError(null);
    }
  }, [visible, trip]);

  const onSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Give your trip a name.');
      return;
    }
    if (start && !isValidDateStr(start)) {
      setError('Start date must look like YYYY-MM-DD.');
      return;
    }
    if (end && !isValidDateStr(end)) {
      setError('End date must look like YYYY-MM-DD.');
      return;
    }
    if (start && end && end < start) {
      setError('End date can’t be before the start date.');
      return;
    }
    setSaving(true);
    const { data, error: updateError } = await supabase
      .from('trips')
      .update({ name: name.trim(), start_date: start || null, end_date: end || null })
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
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Edit trip</Text>

            <TextField
              label="Trip name"
              value={name}
              onChangeText={setName}
              placeholder="Trip name"
              autoCapitalize="words"
            />
            <TextField
              label="Start date"
              value={start}
              onChangeText={setStart}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />
            <TextField
              label="End date"
              value={end}
              onChangeText={setEnd}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
              <Button label="Save" onPress={onSave} loading={saving} style={styles.action} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
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
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text, marginBottom: spacing.md },
  error: { marginBottom: spacing.sm, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { flex: 1 },
});
