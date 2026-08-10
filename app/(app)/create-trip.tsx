import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { createTrip } from '../../lib/trips';
import { dmyToISO, isValidDMY } from '../../lib/dates';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { DateField } from '../../components/DateField';
import { Button } from '../../components/Button';
import { colors, fonts, spacing } from '../../lib/theme';

export default function CreateTrip() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      await createTrip(user.id, name, startISO, endISO);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the trip.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="New trip" subtitle="Start planning" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextField
            label="Trip name"
            value={name}
            onChangeText={setName}
            placeholder="Amsterdam + Porto"
            autoCapitalize="words"
          />
          <DateField label="Start date (optional)" value={start} onChange={setStart} />
          <DateField label="End date (optional)" value={end} onChange={setEnd} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Create trip" onPress={onCreate} loading={loading} style={styles.cta} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  error: {
    marginBottom: spacing.md,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.danger,
  },
  cta: { marginTop: spacing.xs },
});
