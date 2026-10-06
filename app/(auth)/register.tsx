import { useEffect, useRef, useState, type Ref } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  INVITE_CODE_PATTERN,
  formatInviteCode,
  inviteErrorMessage,
  isEmailAvailable,
  isValidEmail,
  verifyInviteCode,
} from '../../lib/account';
import { ScreenHeader } from '../../components/ScreenHeader';
import { makeStyles, useTheme } from '../../context/ThemeContext';
import { fonts } from '../../lib/theme';

type Step = 1 | 2 | 3;
type FieldKey = 'code' | 'firstName' | 'lastName' | 'email' | 'password' | 'confirm' | 'form';
type Errors = Partial<Record<FieldKey, string>>;

const EMAIL_TAKEN = 'That email is already registered. Log in instead.';

/**
 * Create account, invite-first:
 *  1. Invite code — verified against the backend before anything else.
 *  2. Your details — name + email (email checked for an existing account).
 *  3. Set password — signs up with the verified code; the signup trigger
 *     re-validates and consumes the invite.
 */
export default function Register() {
  const styles = useStyles();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [invite, setInvite] = useState<{ code: string; inviterFirstName: string } | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const toLogin = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  const goToStep = (next: Step) => {
    setErrors({});
    setNotice(null);
    setStep(next);
  };

  const goBack = () => (step === 1 ? toLogin() : goToStep((step - 1) as Step));

  // Android's back button steps back like the chevron rather than leaving mid-flow.
  useEffect(() => {
    if (step === 1) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goToStep((step - 1) as Step);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  /** onChangeText that also clears that field's error (and any form-level one). */
  const edit = (key: FieldKey, set: (value: string) => void) => (value: string) => {
    set(value);
    if (errors[key] || errors.form) setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const onVerify = async () => {
    if (loading) return;
    if (!code) {
      setErrors({ code: 'Enter your invite code.' });
      return;
    }
    if (!INVITE_CODE_PATTERN.test(code)) {
      setErrors({ code: 'Invite codes are 6 letters or numbers.' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await verifyInviteCode(code);
      if (!result.valid) {
        setErrors({ code: inviteErrorMessage(result.reason) });
        return;
      }
      setCode(result.code);
      setInvite({ code: result.code, inviterFirstName: result.inviterFirstName });
      goToStep(2);
    } catch {
      setErrors({ code: 'Couldn’t check the code right now. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const onNext = async () => {
    if (loading) return;
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = 'Enter your first name.';
    if (!lastName.trim()) next.lastName = 'Enter your last name.';
    if (!email.trim()) next.email = 'Enter your email.';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      if (!(await isEmailAvailable(email))) {
        setErrors({ email: EMAIL_TAKEN });
        return;
      }
      goToStep(3);
    } finally {
      setLoading(false);
    }
  };

  const showSignUpError = async (error: AuthError, inviteCode: string) => {
    const message = error.message ?? '';
    if (
      error.code === 'user_already_exists' ||
      error.code === 'email_exists' ||
      /already (registered|exists)/i.test(message)
    ) {
      goToStep(2);
      setErrors({ email: EMAIL_TAKEN });
      return;
    }
    if (error.code === 'email_address_invalid') {
      goToStep(2);
      setErrors({ email: 'Enter a valid email address.' });
      return;
    }
    if (error.code === 'weak_password') {
      setErrors({ password: message || 'Choose a stronger password.' });
      return;
    }
    // The signup trigger rejects an invite that expired or was used up after
    // step 1, but GoTrue only reports a generic database error — re-check the
    // code to tell the user why.
    const recheck = await verifyInviteCode(inviteCode).catch(() => null);
    if (recheck && !recheck.valid) {
      setInvite(null);
      goToStep(1);
      setErrors({ code: inviteErrorMessage(recheck.reason) });
      return;
    }
    setErrors({
      form:
        error.status === 500 || !message
          ? 'Couldn’t create your account. Please try again.'
          : message,
    });
  };

  const onCreate = async () => {
    if (loading) return;
    if (!invite) {
      goToStep(1);
      return;
    }
    const next: Errors = {};
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (!confirm) next.confirm = 'Confirm your password.';
    else if (confirm !== password) next.confirm = 'Passwords don’t match.';
    setErrors(next);
    setNotice(null);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            invite_code: invite.code,
          },
        },
      });
      if (error) {
        await showSignUpError(error, invite.code);
        return;
      }
      // With a session the root guard switches to the app. Without one, email
      // confirmation is on and the user logs in once confirmed.
      if (!data.session) setNotice('Account created. Check your email to confirm it, then log in.');
    } catch {
      setErrors({ form: 'Couldn’t create your account. Check your connection and try again.' });
    } finally {
      setLoading(false);
    }
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
            <>
              <View style={styles.stack}>
                <Field
                  label="Invite code"
                  variant="code"
                  value={code}
                  onChangeText={edit('code', (v) => setCode(formatInviteCode(v)))}
                  placeholder="XXXXXX"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  returnKeyType="go"
                  onSubmitEditing={onVerify}
                  error={errors.code}
                />
                <Text style={styles.helper}>
                  No public sign-up — someone already on the app has to invite you.
                </Text>
                <PrimaryButton label="Verify code" onPress={onVerify} loading={loading} />
              </View>
              <Pressable
                onPress={toLogin}
                hitSlop={8}
                style={styles.footer}
                accessibilityRole="link"
              >
                <Text style={styles.footerText}>
                  Already have an account? <Text style={styles.footerLink}>Log in</Text>
                </Text>
              </Pressable>
            </>
          ) : step === 2 ? (
            <View style={styles.stack}>
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>✓ Invite code verified</Text>
                <Text style={styles.bannerLine}>
                  {invite?.code} · invited by {invite?.inviterFirstName}
                </Text>
              </View>
              <Field
                label="First name"
                value={firstName}
                onChangeText={edit('firstName', setFirstName)}
                placeholder="Your first name"
                autoCapitalize="words"
                autoComplete="name-given"
                textContentType="givenName"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => lastNameRef.current?.focus()}
                error={errors.firstName}
              />
              <Field
                ref={lastNameRef}
                label="Last name"
                value={lastName}
                onChangeText={edit('lastName', setLastName)}
                placeholder="Your last name"
                autoCapitalize="words"
                autoComplete="name-family"
                textContentType="familyName"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
                error={errors.lastName}
              />
              <Field
                ref={emailRef}
                label="Email"
                value={email}
                onChangeText={edit('email', setEmail)}
                placeholder="you@email.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={onNext}
                error={errors.email}
              />
              <PrimaryButton label="Next" onPress={onNext} loading={loading} />
              <BackLink onPress={() => goToStep(1)} />
            </View>
          ) : (
            <View style={styles.stack}>
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>✓ Email verified — {email.trim()}</Text>
              </View>
              <Field
                label="Password"
                value={password}
                onChangeText={edit('password', setPassword)}
                placeholder="At least 8 characters"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => confirmRef.current?.focus()}
                error={errors.password}
              />
              <Field
                ref={confirmRef}
                label="Confirm password"
                value={confirm}
                onChangeText={edit('confirm', setConfirm)}
                placeholder="Re-enter your password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={onCreate}
                error={errors.confirm}
              />
              {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
              <PrimaryButton label="Create account" onPress={onCreate} loading={loading} />
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <BackLink onPress={() => goToStep(2)} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  /** The step-1 invite code: centred, large, letter-spaced, strong outline. */
  variant?: 'default' | 'code';
  ref?: Ref<TextInput>;
};

function Field({ label, error, variant = 'default', ref, style, ...rest }: FieldProps) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.text}
        keyboardAppearance={scheme}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          variant === 'code' && styles.inputCode,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          style,
        ]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, (pressed || loading) && styles.primaryDimmed]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.buttonText} style={styles.spinner} />
      ) : (
        <Text style={styles.primaryLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.backLink}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={styles.backText}>← Back</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingVertical: 6, paddingHorizontal: 22 },
  stack: { marginTop: 32, gap: 12 },

  label: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  inputCode: {
    textAlign: 'center',
    fontSize: 18,
    fontFamily: fonts.semibold,
    letterSpacing: 18 * 0.12,
    borderColor: colors.borderStrong,
    paddingVertical: 13,
  },
  inputFocused: { borderColor: colors.borderStrong },
  inputError: { borderColor: colors.danger },
  error: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.danger,
  },
  formError: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.danger,
    textAlign: 'center',
  },
  helper: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  notice: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },

  primary: {
    backgroundColor: colors.buttonFill,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDimmed: { opacity: 0.85 },
  primaryLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.semibold,
    color: colors.buttonText,
  },
  spinner: { height: 20 },

  backLink: { alignSelf: 'center' },
  backText: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },

  footer: { marginTop: 20, alignSelf: 'center' },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  footerLink: { fontFamily: fonts.semibold, color: colors.textAccent },

  banner: {
    backgroundColor: colors.accentTint,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 2,
  },
  bannerTitle: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  bannerLine: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
}));
