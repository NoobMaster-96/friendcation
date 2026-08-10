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
import { isEmailAvailable, isValidEmail } from '../../lib/account';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../lib/theme';

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toLogin = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const goBack = () => {
    setError(null);
    if (step === 2) {
      setStep(1);
      return;
    }
    toLogin();
  };

  const onNext = async () => {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!inviteCode.trim()) {
      setError('Enter your invite code.');
      return;
    }
    setLoading(true);
    const available = await isEmailAvailable(email);
    setLoading(false);
    if (!available) {
      setError('That email is already registered — try logging in instead.');
      return;
    }
    setStep(2);
  };

  const onCreate = async () => {
    setError(null);
    setNotice(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          referral_code: inviteCode.trim(),
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      const msg = signUpError.message ?? '';
      const status = (signUpError as { status?: number }).status;
      // A 500 here means the database signup trigger raised (bad invite code,
      // or the trigger isn't installed) — GoTrue returns a generic failure.
      if (status === 500 || /database error|internal server/i.test(msg)) {
        setError(
          'Couldn’t create your account. Check your invite code — if it keeps ' +
            'failing, the signup trigger may need to be applied in Supabase.'
        );
      } else if (/already registered|already exists|user.*exist/i.test(msg)) {
        setError('That email is already registered — try logging in instead.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
      return;
    }

    if (!data.session) {
      // Email confirmation is enabled: no session yet.
      setNotice('Account created. Check your email to confirm, then log in.');
      return;
    }
    // Session established → the root guard switches to the app automatically.
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Create account" subtitle="Invite-only" onBack={goBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <View>
              <TextField
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                autoCapitalize="words"
                autoComplete="name-given"
                textContentType="givenName"
              />
              <TextField
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                autoCapitalize="words"
                autoComplete="name-family"
                textContentType="familyName"
              />
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
              />
              <TextField
                label="Invite code"
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                placeholder="TRIP-9F2K"
                autoCapitalize="characters"
                autoCorrect={false}
                code
              />
              <Text style={styles.caption}>
                No public sign-up — someone already on the app has to invite you.
              </Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button label="Next" onPress={onNext} loading={loading} style={styles.cta} />

              <Pressable onPress={toLogin} style={styles.linkRow} accessibilityRole="button">
                <Text style={styles.linkText}>
                  Already have an account? <Text style={styles.linkStrong}>Log in</Text>
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.banner}>
                <Text style={styles.bannerCheck}>✓</Text>
                <Text style={styles.bannerText} numberOfLines={1}>
                  Email verified — {email.trim()}
                </Text>
              </View>

              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
              />
              <TextField
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <Button
                label="Create account"
                onPress={onCreate}
                loading={loading}
                style={styles.cta}
              />

              <Pressable onPress={goBack} style={styles.linkRow} accessibilityRole="button">
                <Text style={styles.linkText}>← Back</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  caption: {
    marginTop: 2,
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
  notice: {
    marginBottom: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  cta: { marginTop: spacing.xs },
  linkRow: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary },
  linkStrong: { fontFamily: fonts.semibold, color: colors.text },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentTint,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: spacing.lg,
  },
  bannerCheck: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginRight: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
});
