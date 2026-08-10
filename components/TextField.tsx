import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, fonts, radius } from '../lib/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  /** invite-code styling: tinted fill + bold, letter-spaced text */
  code?: boolean;
};

export function TextField({ label, error, code = false, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          code && styles.inputCode,
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

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  inputCode: {
    backgroundColor: colors.accentTint,
    fontFamily: fonts.semibold,
    letterSpacing: 3,
  },
  inputFocused: { borderColor: colors.borderStrong },
  inputError: { borderColor: colors.danger },
  error: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.danger,
  },
});
