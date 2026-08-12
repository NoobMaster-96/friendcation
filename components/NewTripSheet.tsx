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
import { useAuth } from '../context/AuthContext';
import { createTrip } from '../lib/trips';
import { dmyToISO, isValidDMY } from '../lib/dates';
import { TextField } from './TextField';
import { DateField } from './DateField';
import { Button } from './Button';
import { colors, fonts, spacing } from '../lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function NewTripSheet({ visible, onClose, onCreated }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setStart('');
      setEnd('');
      setError(null);
    }
  }, [visible]);

  const onCreate = async () => {
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
    if (!user) {
      setError('You must be signed in.');
      return;
    }
    setSaving(true);
    try {
      await createTrip(user.id, name, startISO, endISO);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the trip.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.title}>New travel diary</Text>

          <TextField
            label="Trip name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Kerala Backwaters"
            autoCapitalize="words"
          />

          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <DateField
                label="Start date"
                value={start}
                onChange={setStart}
                placeholder="Select date"
              />
            </View>
            <View style={styles.dateCol}>
              <DateField
                label="End date"
                value={end}
                onChange={setEnd}
                placeholder="Select date"
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
            <Button label="Create trip" onPress={onCreate} loading={saving} style={styles.action} />
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
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateCol: { flex: 1 },
  error: { marginBottom: spacing.sm, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { flex: 1 },
});
