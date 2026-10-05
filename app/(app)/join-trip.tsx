import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { joinTripByCode } from '../../lib/trips';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { makeStyles } from '../../context/ThemeContext';
import { fonts, spacing } from '../../lib/theme';

export default function JoinTrip() {
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onJoin = async () => {
    setError(null);
    if (!code.trim()) {
      setError('Enter the trip’s invite code.');
      return;
    }
    if (!user) {
      setError('You must be signed in.');
      return;
    }
    setLoading(true);
    try {
      const trip = await joinTripByCode(user.id, code);
      router.replace(`/trip/${trip.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join that trip.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Join a trip" subtitle="Enter an invite code" onBack={() => router.back()} />
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
            label="Invite code"
            value={code}
            onChangeText={(t) => setCode(t.trim())}
            placeholder="e.g. 3f9ac2b1"
            autoCapitalize="none"
            autoCorrect={false}
            code
          />
          <Text style={styles.hint}>
            Ask a trip member for the code — it’s shown on the trip’s screen.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Join trip" onPress={onJoin} loading={loading} style={styles.cta} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  hint: {
    marginTop: -6,
    marginBottom: spacing.md,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  error: {
    marginBottom: spacing.md,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.danger,
  },
  cta: { marginTop: spacing.xs },
}));
