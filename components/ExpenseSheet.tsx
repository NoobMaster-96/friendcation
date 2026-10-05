import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { deleteExpense, formatAmount, saveExpense, splitEvenly, toPaise } from '../lib/expenses';
import type { TripMember } from '../lib/members';
import type { ExpenseListItem } from '../lib/types';
import { SegmentedToggle } from './SegmentedToggle';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { fonts } from '../lib/theme';

type SplitMode = 'equal' | 'custom';

type Props = {
  visible: boolean;
  /** null = add a new expense; otherwise edit (or delete) this one. */
  expense: ExpenseListItem | null;
  tripId: string;
  userId: string;
  members: TripMember[];
  onClose: () => void;
  /** After a save or delete, so the list and balance card reload. */
  onChanged: () => void;
};

/** Digits plus one decimal point, at most two decimals. */
function sanitizeAmount(text: string): string {
  const [whole, ...rest] = text.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

/** Plain editable value (no grouping) for an amount in paise. */
const paiseToInput = (paise: number) => (paise / 100).toFixed(paise % 100 ? 2 : 0);

const firstName = (m: TripMember) => m.name.split(' ')[0] || m.name;

/** Rebuilds the split controls from a saved expense: an exact even split opens as "Equally". */
function splitStateFor(expense: ExpenseListItem, members: TripMember[]) {
  const shares = new Map(expense.splits.map((s) => [s.userId, s.sharePaise]));
  const included = members.filter((m) => (shares.get(m.userId) ?? 0) > 0).map((m) => m.userId);
  const even = splitEvenly(toPaise(expense.amount), included.length).sort((a, b) => a - b);
  const actual = included.map((id) => shares.get(id) ?? 0).sort((a, b) => a - b);
  const isEqual = included.length > 0 && even.every((v, i) => v === actual[i]);
  return {
    mode: (isEqual ? 'equal' : 'custom') as SplitMode,
    included,
    custom: isEqual
      ? {}
      : Object.fromEntries(included.map((id) => [id, paiseToInput(shares.get(id) ?? 0)])),
  };
}

export function ExpenseSheet({
  visible,
  expense,
  tripId,
  userId,
  members,
  onClose,
  onChanged,
}: Props) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isEdit = expense !== null;

  // "You" first, then everyone else in join order.
  const people = [...members].sort((a, b) =>
    a.userId === userId ? -1 : b.userId === userId ? 1 : 0
  );

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(userId);
  const [mode, setMode] = useState<SplitMode>('equal');
  const [included, setIncluded] = useState<string[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Each open starts from the saved expense (EDIT) or a blank form paid by you (ADD).
  useEffect(() => {
    if (!visible) return;
    setFocus(null);
    setError(null);
    setSaving(false);
    setConfirmOpen(false);
    setDeleting(false);
    if (expense) {
      const split = splitStateFor(expense, members);
      setDescription(expense.description);
      setAmount(paiseToInput(toPaise(expense.amount)));
      setPaidBy(expense.paid_by ?? userId);
      setMode(split.mode);
      setIncluded(split.included);
      setCustom(split.custom);
    } else {
      setDescription('');
      setAmount('');
      setPaidBy(userId);
      setMode('equal');
      setIncluded(members.map((m) => m.userId));
      setCustom({});
    }
  }, [visible, expense]);

  const amountPaise = toPaise(amount);
  const splitters = people.filter((m) => included.includes(m.userId));
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
    // Switching to Custom with nothing entered yet starts from the equal split.
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
    if (amountPaise <= 0) return setError('Enter an amount greater than 0.');
    if (splitters.length === 0) return setError('Tick at least one person to split with.');
    if (customMismatch) return setError('Custom shares must add up to the amount.');

    setSaving(true);
    try {
      await saveExpense({
        tripId,
        expenseId: expense?.id,
        paidBy,
        description,
        amountPaise,
        splits: splitters.map((m, i) => ({
          userId: m.userId,
          sharePaise: mode === 'equal' ? equalShares[i] : toPaise(custom[m.userId] ?? ''),
        })),
      });
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the expense.');
    } finally {
      setSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!expense) return;
    setDeleting(true);
    try {
      await deleteExpense(expense.id);
      setConfirmOpen(false);
      onChanged();
      onClose();
    } catch (e) {
      setConfirmOpen(false);
      setError(e instanceof Error ? e.message : 'Could not delete the expense.');
    } finally {
      setDeleting(false);
    }
  };

  // Indian digit grouping everywhere except while that field is being typed in.
  const shown = (raw: string, key: string) =>
    focus === key || !raw ? raw : formatAmount(toPaise(raw) / 100);
  const perHead = splitters.length ? amountPaise / splitters.length / 100 : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={confirmOpen ? () => setConfirmOpen(false) : onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{isEdit ? 'Edit expense' : 'Add expense'}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                onFocus={() => setFocus('description')}
                onBlur={() => setFocus(null)}
                placeholder="e.g. Canal-side dinner"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.text}
                keyboardAppearance={scheme}
                autoCapitalize="sentences"
                style={[
                  styles.inputBox,
                  styles.inputText,
                  (description || focus === 'description') && styles.inputFilled,
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount</Text>
              <View
                style={[
                  styles.inputBox,
                  styles.amountBox,
                  (amount || focus === 'amount') && styles.inputFilled,
                ]}
              >
                <Text style={styles.amountPrefix}>Rs.</Text>
                <TextInput
                  value={shown(amount, 'amount')}
                  onChangeText={(t) => setAmount(sanitizeAmount(t))}
                  onFocus={() => setFocus('amount')}
                  onBlur={() => setFocus(null)}
                  keyboardType="decimal-pad"
                  keyboardAppearance={scheme}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.text}
                  style={styles.amountInput}
                  accessibilityLabel="Amount in rupees"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Paid by</Text>
              <View style={styles.chips}>
                {people.map((m) => {
                  const selected = m.userId === paidBy;
                  return (
                    <Pressable
                      key={m.userId}
                      onPress={() => setPaidBy(m.userId)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
                    >
                      <Avatar initials={m.initials} size={20} />
                      <Text style={selected ? styles.chipLabelSelected : styles.chipLabel}>
                        {m.userId === userId ? 'You' : firstName(m)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <View style={styles.splitHeader}>
                <Text style={styles.label}>Split</Text>
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

              {people.map((m) => {
                const on = included.includes(m.userId);
                const name = m.userId === userId ? `${firstName(m)} (you)` : firstName(m);
                return (
                  <View key={m.userId} style={styles.row}>
                    <Pressable
                      onPress={() => toggleIncluded(m.userId)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`Split with ${name}`}
                      style={styles.rowWho}
                    >
                      <View style={[styles.checkbox, on ? styles.checkboxOn : styles.checkboxOff]}>
                        {on ? <Ionicons name="checkmark" size={14} color={colors.buttonText} /> : null}
                      </View>
                      <Avatar initials={m.initials} size={26} />
                      <Text style={styles.rowName} numberOfLines={1}>
                        {name}
                      </Text>
                    </Pressable>

                    {mode === 'equal' ? (
                      <Text style={[styles.share, !on && styles.shareMuted]}>
                        Rs. {formatAmount(on ? equalShareOf(m.userId) / 100 : 0)}
                      </Text>
                    ) : (
                      <TextInput
                        value={on ? shown(custom[m.userId] ?? '', m.userId) : '0'}
                        editable={on}
                        onChangeText={(t) => setCustom((c) => ({ ...c, [m.userId]: sanitizeAmount(t) }))}
                        onFocus={() => setFocus(m.userId)}
                        onBlur={() => setFocus(null)}
                        keyboardType="decimal-pad"
                        keyboardAppearance={scheme}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        selectionColor={colors.text}
                        style={[
                          styles.shareBox,
                          focus === m.userId && styles.inputFilled,
                          !on && styles.shareBoxOff,
                        ]}
                        accessibilityLabel={`${name}'s share`}
                      />
                    )}
                  </View>
                );
              })}

              {mode === 'equal' ? (
                <Text style={styles.footer}>
                  {splitters.length
                    ? `Split ${splitters.length} ${splitters.length === 1 ? 'way' : 'ways'} · Rs. ${formatAmount(perHead)} each`
                    : 'Tick at least one person to split with.'}
                </Text>
              ) : (
                <View style={styles.footerRow}>
                  <Text style={styles.footer}>Total assigned</Text>
                  <Text style={styles.footer}>
                    Rs. {formatAmount(assignedPaise / 100)} of {formatAmount(amountPaise / 100)}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]}
            >
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={customMismatch || saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: customMismatch || saving }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                (customMismatch || saving) && styles.btnDisabled,
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.btnPrimaryText}>{isEdit ? 'Save changes' : 'Add expense'}</Text>
              )}
            </Pressable>
          </View>

          {isEdit ? (
            <Pressable
              onPress={() => setConfirmOpen(true)}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}
            >
              <Text style={styles.deleteLinkText}>Delete expense</Text>
            </Pressable>
          ) : null}
        </View>

        {confirmOpen && expense ? (
          <View style={styles.dialogRoot}>
            <Pressable
              style={styles.dialogBackdrop}
              onPress={() => setConfirmOpen(false)}
              accessibilityLabel="Cancel"
            />
            <View style={styles.dialog} accessibilityViewIsModal>
              <Text style={styles.dialogTitle}>Delete this expense?</Text>
              <Text style={styles.dialogBody}>
                "{expense.description}" · Rs. {formatAmount(expense.amount)} will be removed and
                everyone's balances will be updated. This can't be undone.
              </Text>
              <View style={styles.dialogActions}>
                <Pressable
                  onPress={() => setConfirmOpen(false)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]}
                >
                  <Text style={styles.btnOutlineText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmDelete}
                  disabled={deleting}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnPrimary,
                    deleting && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {deleting ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Delete</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.42) }]}>{initials}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '88%',
  },
  scroll: { flexShrink: 1 },
  content: { gap: 14 },
  title: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  inputBox: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputText: { fontSize: 15, fontFamily: fonts.regular, color: colors.text },
  inputFilled: { borderColor: colors.borderStrong },
  amountBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountPrefix: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  amountInput: {
    flex: 1,
    height: '100%',
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 5,
    paddingRight: 12,
    paddingBottom: 5,
    paddingLeft: 5,
  },
  chipSelected: { backgroundColor: colors.buttonFill, borderColor: colors.buttonFill },
  chipUnselected: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
  chipLabel: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  chipLabelSelected: { fontSize: 13, fontFamily: fonts.semibold, color: colors.buttonText },
  avatar: { backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, color: colors.textAccent },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  splitToggle: { width: 184 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  rowWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.buttonFill },
  checkboxOff: { borderWidth: 1, borderColor: colors.borderStrong },
  rowName: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.text },
  share: { fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  shareMuted: { color: colors.textMuted },
  shareBox: {
    width: 84,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: 8,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  shareBoxOff: { opacity: 0.5 },
  footer: { fontSize: 11, fontFamily: fonts.regular, color: colors.textMuted },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  error: { marginTop: 10, fontSize: 12, fontFamily: fonts.regular, color: colors.danger },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: { borderWidth: 0.5, borderColor: colors.borderStrong },
  btnOutlineText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  btnPrimary: { backgroundColor: colors.buttonFill },
  btnPrimaryText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.buttonText },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  deleteLink: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  deleteLinkText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  dialogRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dialogBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dialogScrim,
  },
  dialog: {
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  dialogBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
}));
