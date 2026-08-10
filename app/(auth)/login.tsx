import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../lib/theme';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) setError(signInError.message);
    // On success the session updates and the root guard shows the app.
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Log in" subtitle="Invite-only" />
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
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Log in" onPress={onSubmit} loading={loading} style={styles.cta} />

          <Pressable
            onPress={() => router.push('/register')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkCard, pressed && styles.linkCardPressed]}
          >
            <Text style={styles.linkCardText}>
              New here? <Text style={styles.linkCardStrong}>Create an account</Text>
            </Text>
          </Pressable>

          <Text style={styles.caption}>
            No public sign-up — someone already on a trip has to invite you.
          </Text>
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
  linkCard: {
    marginTop: spacing.md,
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCardPressed: { opacity: 0.85 },
  linkCardText: { fontSize: 16, fontFamily: fonts.regular, color: colors.textSecondary },
  linkCardStrong: { fontFamily: fonts.semibold, color: colors.text },
  caption: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
});
