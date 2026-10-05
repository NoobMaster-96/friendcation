import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createExpense, formatAmount, formatMoney, splitEvenly, toPaise } from '../lib/expenses';
import type { TripMember } from '../lib/members';
import { TextField } from './TextField';
import { SegmentedToggle } from './SegmentedToggle';
import { Button } from './Button';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { fonts, radius, spacing } from '../lib/theme';

type SplitMode = 'equal' | 'custom';

type Props = {
  visible: boolean;
  tripId: string;
  userId: string;
  members: TripMember[];
  onClose: () => void;
  onSaved: () => void;
};

/** Digits plus one decimal point, at most two decimals. */
function sanitizeAmount(text: string): string {
  const [whole, ...rest] = text.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

/** Plain editable value for a custom share box (no grouping). */
const paiseToInput = (paise: number) => (paise / 100).toFixed(paise % 100 ? 2 : 0);

export function AddExpenseSheet({ visible, tripId, userId, members, onClose, onSaved }: Props) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [paidBy, setPaidBy] = useState(userId);
  const [mode, setMode] = useState<SplitMode>('equal');
  const [included, setIncluded] = useState<string[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fresh form each time the sheet opens: paid by you, split equally between everyone.
  useEffect(() => {
    if (!visible) return;
    setDescription('');
    setAmount('');
    setPaidBy(userId);
    setMode('equal');
    setIncluded(members.map((m) => m.userId));
    setCustom({});
    setError(null);
    setSaving(false);
  }, [visible]);

  const nameOf = (m: TripMember) => (m.userId === userId ? 'You' : m.name.split(' ')[0] || m.name);

  const amountPaise = toPaise(amount);
  const splitters = members.filter((m) => included.includes(m.userId));
  const equalShares = splitEvenly(amountPaise, splitters.length);
  const equalShareOf = (id: string) => {
    const i = splitters.findIndex((m) => m.userId === id);
    return i === -1 ? 0 : equalShares[i];
  };
  const assignedPaise = splitters.reduce((sum, m) => sum + toPaise(custom[m.userId] ?? ''), 0);
  const customMismatch = mode === 'custom' && assignedPaise !== amountPaise;

  const toggleIncluded = (id: string) =>
    setIncluded((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const changeMode = (next: SplitMode) => {
    // First switch to Custom starts from the equal split so the totals already match.
    if (next === 'custom' && Object.keys(custom).length === 0 && amountPaise > 0) {
      setCustom(
        Object.fromEntries(splitters.map((m, i) => [m.userId, paiseToInput(equalShares[i])]))
      );
    }
    setMode(next);
  };

  const onSave = async () => {
    setError(null);
    if (!description.trim()) return setError('Add a description.');
    if (amountPaise <= 0) return setError('Enter an amount.');
    if (splitters.length === 0) return setError('Tick at least one person to split with.');
    if (customMismatch) return;

    const splits = splitters.map((m, i) => ({
      userId: m.userId,
      sharePaise: mode === 'equal' ? equalShares[i] : toPaise(custom[m.userId] ?? ''),
    }));

    setSaving(true);
    try {
      await createExpense({ tripId, createdBy: userId, paidBy, description, amountPaise, splits });
      setSaving(false);
      onSaved();
      onClose();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Could not add the expense.');
    }
  };

  const perHead = splitters.length ? amountPaise / splitters.length / 100 : 0;
  const diffPaise = Math.abs(amountPaise - assignedPaise);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Add expense</Text>

            <TextField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Canal-side dinner"
              autoCapitalize="sentences"
            />

            <Text style={styles.label}>Amount</Text>
            <View style={[styles.amountField, amountFocused && styles.amountFocused]}>
              <Text style={styles.amountPrefix}>Rs.</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(sanitizeAmount(t))}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                keyboardType="decimal-pad"
                keyboardAppearance={scheme}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.text}
                style={styles.amountInput}
                accessibilityLabel="Amount in rupees"
              />
            </View>

            <Text style={styles.label}>Paid by</Text>
            <View style={styles.chips}>
              {members.map((m) => {
                const selected = m.userId === paidBy;
                return (
                  <Pressable
                    key={m.userId}
                    onPress={() => setPaidBy(m.userId)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Avatar initials={m.initials} />
                    <Text style={styles.chipLabel}>{nameOf(m)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.splitHeader}>
              <Text style={[styles.label, styles.labelInline]}>Split</Text>
              <SegmentedToggle<SplitMode>
                compact
                style={styles.splitToggle}
                value={mode}
                onChange={changeMode}
                options={[
                  { label: 'Equally', value: 'equal' },
                  { label: 'Custom', value: 'custom' },
                ]}
              />
            </View>

            {members.map((m) => {
              const on = included.includes(m.userId);
              return (
                <View key={m.userId} style={styles.splitRow}>
                  <Pressable
                    onPress={() => toggleIncluded(m.userId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`Split with ${nameOf(m)}`}
                    style={styles.splitWho}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? colors.buttonFill : colors.textMuted}
                    />
                    <Avatar initials={m.initials} />
                    <Text style={styles.splitName} numberOfLines={1}>
                      {nameOf(m)}
                    </Text>
                  </Pressable>

                  {mode === 'equal' ? (
                    <Text style={[styles.share, !on && styles.shareMuted]}>
                      {formatMoney(on ? equalShareOf(m.userId) / 100 : 0)}
                    </Text>
                  ) : (
                    <View style={[styles.shareBox, !on && styles.shareBoxOff]}>
                      <Text style={styles.shareBoxPrefix}>Rs.</Text>
                      <TextInput
                        value={on ? custom[m.userId] ?? '' : '0'}
                        editable={on}
                        onChangeText={(t) =>
                          setCustom((c) => ({ ...c, [m.userId]: sanitizeAmount(t) }))
                        }
                        keyboardType="decimal-pad"
                        keyboardAppearance={scheme}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        selectionColor={colors.text}
                        style={styles.shareInput}
                        accessibilityLabel={`${nameOf(m)}'s share`}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {mode === 'equal' ? (
              <Text style={styles.caption}>
                {splitters.length
                  ? `Split ${splitters.length} ${splitters.length === 1 ? 'way' : 'ways'} · Rs. ${formatAmount(perHead)} each`
                  : 'Tick who is splitting this.'}
              </Text>
            ) : (
              <>
                <Text style={styles.caption}>
                  Total assigned Rs. {formatAmount(assignedPaise / 100)} of{' '}
                  {formatAmount(amountPaise / 100)}
                </Text>
                {customMismatch ? (
                  <Text style={styles.error}>
                    Shares must add up to {formatMoney(amountPaise / 100)} (
                    {formatMoney(diffPaise / 100)} {assignedPaise < amountPaise ? 'left' : 'over'}).
                  </Text>
                ) : null}
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
            <Button
              label="Add expense"
              onPress={onSave}
              loading={saving}
              disabled={customMismatch}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Avatar({ initials }: { initials: string }) {
  const styles = useStyles();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
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
    maxHeight: '90%',
  },
  scroll: { flexShrink: 1 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: 15, fontFamily: fonts.medium, color: colors.text, marginBottom: 8 },
  labelInline: { marginBottom: 0 },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  amountFocused: { borderColor: colors.borderStrong },
  amountPrefix: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: '100%',
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingLeft: 5,
    paddingRight: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accentTint, borderColor: colors.borderStrong },
  chipLabel: { fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  // Ring in the page colour keeps the circle visible on bg-accent (selected) chips.
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentTint,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textAccent },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  splitToggle: { width: 190 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 7,
  },
  splitWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitName: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text },
  share: { fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  shareMuted: { color: colors.textMuted },
  shareBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 108,
    height: 38,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
  },
  shareBoxOff: { opacity: 0.5 },
  shareBoxPrefix: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginRight: 4,
  },
  shareInput: {
    flex: 1,
    height: '100%',
    textAlign: 'right',
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  caption: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  error: { marginTop: spacing.sm, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  action: { flex: 1 },
}));
