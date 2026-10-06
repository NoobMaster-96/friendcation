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
import { deleteExpense, saveExpense, splitEvenly } from '../lib/expenses';
import {
  formatAmount,
  formatMoney,
  fromMinor,
  getCurrency,
  minorToInput,
  sanitizeAmountInput,
  toMinor,
} from '../lib/currencies';
import type { TripMember } from '../lib/members';
import type { ExpenseListItem } from '../lib/types';
import { CurrencyPicker } from './CurrencyPicker';
import { SegmentedToggle } from './SegmentedToggle';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { fonts } from '../lib/theme';

type SplitMode = 'equal' | 'custom';
type Section = 'paidBy' | 'split';

type Props = {
  visible: boolean;
  /** null = add a new expense; otherwise edit (or delete) this one. */
  expense: ExpenseListItem | null;
  /** ADD mode's currency: the trip's most recent expense's, else your home currency. */
  defaultCurrency: string;
  tripId: string;
  userId: string;
  members: TripMember[];
  onClose: () => void;
  /** After a save or delete, so the list and balance card reload. */
  onChanged: () => void;
};

const firstName = (m: TripMember) => m.name.split(' ')[0] || m.name;

/** Rebuilds the split controls from a saved expense: an exact even split opens as "Equally". */
function splitStateFor(expense: ExpenseListItem, members: TripMember[]) {
  const shares = new Map(expense.splits.map((s) => [s.userId, s.shareMinor]));
  const included = members.filter((m) => (shares.get(m.userId) ?? 0) > 0).map((m) => m.userId);
  const even = splitEvenly(toMinor(expense.amount, expense.currency), included.length).sort(
    (a, b) => a - b
  );
  const actual = included.map((id) => shares.get(id) ?? 0).sort((a, b) => a - b);
  const isEqual = included.length > 0 && even.every((v, i) => v === actual[i]);
  return {
    mode: (isEqual ? 'equal' : 'custom') as SplitMode,
    included,
    custom: isEqual
      ? {}
      : Object.fromEntries(
          included.map((id) => [id, minorToInput(shares.get(id) ?? 0, expense.currency)])
        ),
  };
}

export function ExpenseSheet({
  visible,
  expense,
  defaultCurrency,
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
  const [currency, setCurrency] = useState(defaultCurrency);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [section, setSection] = useState<Section | null>(null);
  const [paidBy, setPaidBy] = useState(userId);
  const [mode, setMode] = useState<SplitMode>('equal');
  const [included, setIncluded] = useState<string[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [amountWidth, setAmountWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Each open starts from the saved expense (EDIT) or a blank form paid by you (ADD),
  // with the picker and both collapsible rows closed.
  useEffect(() => {
    if (!visible) return;
    setFocus(null);
    setError(null);
    setSaving(false);
    setConfirmOpen(false);
    setDeleting(false);
    setPickerOpen(false);
    setSection(null);
    if (expense) {
      const split = splitStateFor(expense, members);
      setDescription(expense.description);
      setCurrency(expense.currency);
      setAmount(minorToInput(toMinor(expense.amount, expense.currency), expense.currency));
      setPaidBy(expense.paid_by ?? userId);
      setMode(split.mode);
      setIncluded(split.included);
      setCustom(split.custom);
    } else {
      setDescription('');
      setCurrency(defaultCurrency);
      setAmount('');
      setPaidBy(userId);
      setMode('equal');
      setIncluded(members.map((m) => m.userId));
      setCustom({});
    }
  }, [visible, expense]);

  const cur = getCurrency(currency);
  const money = (minor: number) => formatMoney(fromMinor(minor, currency), currency);
  const amountMinor = toMinor(amount, currency);
  const splitters = people.filter((m) => included.includes(m.userId));
  const equalShares = splitEvenly(amountMinor, splitters.length);
  const equalShareOf = (id: string) => {
    const i = splitters.findIndex((m) => m.userId === id);
    return i === -1 ? 0 : equalShares[i];
  };
  const assignedMinor = splitters.reduce(
    (sum, m) => sum + toMinor(custom[m.userId] ?? '', currency),
    0
  );
  const customMismatch = mode === 'custom' && assignedMinor !== amountMinor;

  const payer = people.find((m) => m.userId === paidBy);
  const payerLabel =
    paidBy === userId ? 'You' : payer ? firstName(payer) : expense?.payerName ?? 'Someone';
  const splitLabel =
    mode === 'custom'
      ? 'Custom amounts'
      : `Equally · ${splitters.length} ${splitters.length === 1 ? 'person' : 'people'}`;

  const toggleSection = (next: Section) => setSection((open) => (open === next ? null : next));

  const chooseCurrency = (code: string) => {
    setCurrency(code);
    setPickerOpen(false);
    // Same numbers in the new currency (never converted); drop decimals it doesn't have.
    setAmount((a) => sanitizeAmountInput(a, code));
    setCustom((c) =>
      Object.fromEntries(Object.entries(c).map(([id, v]) => [id, sanitizeAmountInput(v, code)]))
    );
  };

  const toggleIncluded = (id: string) =>
    setIncluded((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const changeMode = (next: SplitMode) => {
    // Switching to Custom with nothing entered yet starts from the equal split.
    if (next === 'custom' && Object.keys(custom).length === 0 && amountMinor > 0) {
      setCustom(
        Object.fromEntries(
          splitters.map((m, i) => [m.userId, minorToInput(equalShares[i], currency)])
        )
      );
    }
    setMode(next);
  };

  // Split problems open the Split row so the totals are in view.
  const splitError = (message: string) => {
    setSection('split');
    setError(message);
  };

  const onSave = async () => {
    setError(null);
    if (!description.trim()) return setError('Add a description.');
    if (amountMinor <= 0) return setError('Enter an amount greater than 0.');
    if (splitters.length === 0) return splitError('Tick at least one person to split with.');
    if (customMismatch) return splitError('Custom shares must add up to the amount.');

    setSaving(true);
    try {
      await saveExpense({
        tripId,
        expenseId: expense?.id,
        paidBy,
        description,
        currency,
        amountMinor,
        splits: splitters.map((m, i) => ({
          userId: m.userId,
          shareMinor: mode === 'equal' ? equalShares[i] : toMinor(custom[m.userId] ?? '', currency),
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

  // Formatted for the currency ("12.50") everywhere except while that field is being typed in.
  const shown = (raw: string, key: string) =>
    focus === key || !raw
      ? raw
      : formatAmount(fromMinor(toMinor(raw, currency), currency), currency);
  const perHead = splitters.length ? fromMinor(amountMinor, currency) / splitters.length : 0;

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

            <View style={styles.amountBlock}>
              {/* Invisible copy of the amount: sizes the input so the symbol hugs the number. */}
              <Text
                style={[styles.amountText, styles.amountMeasure]}
                numberOfLines={1}
                onLayout={(e) => setAmountWidth(Math.ceil(e.nativeEvent.layout.width))}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {shown(amount, 'amount') || '0'}
              </Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountSymbol}>{cur.symbol}</Text>
                <TextInput
                  value={shown(amount, 'amount')}
                  onChangeText={(t) => setAmount(sanitizeAmountInput(t, currency))}
                  onFocus={() => setFocus('amount')}
                  onBlur={() => setFocus(null)}
                  keyboardType={cur.decimals > 0 ? 'decimal-pad' : 'number-pad'}
                  keyboardAppearance={scheme}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.text}
                  style={[
                    styles.amountText,
                    styles.amountInput,
                    amountWidth > 0 && { width: Math.min(amountWidth + 8, 280) },
                  ]}
                  accessibilityLabel={`Amount in ${cur.name}`}
                />
              </View>
              <Pressable
                onPress={() => setPickerOpen((open) => !open)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Currency: ${cur.name}`}
                accessibilityHint="Opens the currency list"
                accessibilityState={{ expanded: pickerOpen }}
                style={({ pressed }) => [styles.currencyPill, pressed && styles.pressed]}
              >
                <Text style={styles.currencyPillText}>{cur.code}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
              </Pressable>
            </View>

            {pickerOpen ? <CurrencyPicker value={currency} onSelect={chooseCurrency} /> : null}

            <TextInput
              value={description}
              onChangeText={setDescription}
              onFocus={() => setFocus('description')}
              onBlur={() => setFocus(null)}
              placeholder="What was it for? e.g. Canal-side dinner"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.text}
              keyboardAppearance={scheme}
              autoCapitalize="sentences"
              accessibilityLabel="Description"
              style={[
                styles.inputBox,
                styles.inputText,
                (description || focus === 'description') && styles.inputFilled,
              ]}
            />

            <View style={styles.card}>
              <SectionRow
                label="Paid by"
                value={payerLabel}
                open={section === 'paidBy'}
                onPress={() => toggleSection('paidBy')}
              />
              {section === 'paidBy' ? (
                <View style={styles.sectionBody}>
                  {people.map((m, i) => {
                    const selected = m.userId === paidBy;
                    return (
                      <Pressable
                        key={m.userId}
                        onPress={() => {
                          setPaidBy(m.userId);
                          setSection(null);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        style={({ pressed }) => [
                          styles.payerRow,
                          i < people.length - 1 && styles.payerDivider,
                          selected && styles.payerSelected,
                          pressed && !selected && styles.pressed,
                        ]}
                      >
                        <Avatar initials={m.initials} size={28} fontSize={11} />
                        <Text style={styles.payerName} numberOfLines={1}>
                          {m.userId === userId ? (
                            <>
                              You <Text style={styles.payerRealName}>({firstName(m)})</Text>
                            </>
                          ) : (
                            m.name
                          )}
                        </Text>
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={colors.text}
                          style={selected ? undefined : styles.hidden}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <SectionRow
                label="Split"
                value={splitLabel}
                open={section === 'split'}
                onPress={() => toggleSection('split')}
                divider
              />
              {section === 'split' ? (
                <View style={[styles.sectionBody, styles.splitBody]}>
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
                          <View
                            style={[styles.checkbox, on ? styles.checkboxOn : styles.checkboxOff]}
                          >
                            {on ? (
                              <Ionicons name="checkmark" size={14} color={colors.buttonText} />
                            ) : null}
                          </View>
                          <Avatar initials={m.initials} size={26} />
                          <Text style={styles.rowName} numberOfLines={1}>
                            {name}
                          </Text>
                        </Pressable>

                        {mode === 'equal' ? (
                          <Text style={[styles.share, !on && styles.shareMuted]}>
                            {money(on ? equalShareOf(m.userId) : 0)}
                          </Text>
                        ) : (
                          <TextInput
                            value={on ? shown(custom[m.userId] ?? '', m.userId) : '0'}
                            editable={on}
                            onChangeText={(t) =>
                              setCustom((c) => ({
                                ...c,
                                [m.userId]: sanitizeAmountInput(t, currency),
                              }))
                            }
                            onFocus={() => setFocus(m.userId)}
                            onBlur={() => setFocus(null)}
                            keyboardType={cur.decimals > 0 ? 'decimal-pad' : 'number-pad'}
                            keyboardAppearance={scheme}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.text}
                            style={[
                              styles.shareBox,
                              focus === m.userId && styles.inputFilled,
                              !on && styles.shareBoxOff,
                            ]}
                            accessibilityLabel={`${name}'s share in ${cur.name}`}
                          />
                        )}
                      </View>
                    );
                  })}

                  {mode === 'equal' ? (
                    <Text style={styles.footer}>
                      {splitters.length
                        ? `Split ${splitters.length} ${splitters.length === 1 ? 'way' : 'ways'} · ${formatMoney(perHead, currency)} each`
                        : 'Tick at least one person to split with.'}
                    </Text>
                  ) : (
                    <View style={styles.footerRow}>
                      <Text style={styles.footer}>Total assigned</Text>
                      <Text style={styles.footer}>
                        {money(assignedMinor)} of {money(amountMinor)}
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}
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
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                saving && styles.btnDisabled,
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
                "{expense.description}" · {formatMoney(expense.amount, expense.currency)} will be
                removed and everyone's balances will be updated. This can't be undone.
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

/** A collapsible row: label, current value and a › that turns down while open. */
function SectionRow({
  label,
  value,
  open,
  onPress,
  divider = false,
}: {
  label: string;
  value: string;
  open: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [
        styles.sectionRow,
        divider && styles.sectionDivider,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
    </Pressable>
  );
}

function Avatar({ initials, size, fontSize }: { initials: string; size: number; fontSize?: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: fontSize ?? Math.round(size * 0.42) }]}>
        {initials}
      </Text>
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

  amountBlock: { alignItems: 'center', gap: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  amountSymbol: { fontSize: 18, fontFamily: fonts.medium, color: colors.textSecondary },
  amountText: {
    fontSize: 36,
    fontFamily: fonts.bold,
    letterSpacing: 36 * -0.02,
    color: colors.text,
  },
  amountMeasure: { position: 'absolute', top: 0, left: 0, opacity: 0 },
  amountInput: { minWidth: 28, padding: 0, textAlign: 'center', includeFontPadding: false },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 8,
  },
  currencyPillText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    letterSpacing: 12 * 0.04,
    color: colors.text,
  },

  inputBox: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  // letterSpacing 0 on every input: iOS reuses native inputs and can otherwise keep the
  // amount field's tighter spacing.
  inputText: { fontSize: 15, fontFamily: fonts.regular, letterSpacing: 0, color: colors.text },
  inputFilled: { borderColor: colors.borderStrong },

  card: {
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  sectionDivider: { borderTopWidth: 0.5, borderTopColor: colors.border },
  sectionLabel: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  sectionValue: { flexShrink: 1, fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  chevron: {
    width: 12,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  sectionBody: { paddingTop: 2, paddingHorizontal: 14, paddingBottom: 14 },

  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  payerDivider: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  payerSelected: { backgroundColor: colors.accentTint },
  payerName: { flex: 1, fontSize: 14, fontFamily: fonts.regular, color: colors.text },
  payerRealName: { fontSize: 12, color: colors.textMuted },
  hidden: { opacity: 0 },

  avatar: { backgroundColor: colors.accentTint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, color: colors.textAccent },

  splitBody: { gap: 6 },
  splitToggle: { marginBottom: 4 },
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
    letterSpacing: 0,
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
