import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  balancesByCurrency,
  listExpenses,
  listSettlements,
  type Settlement,
} from '../../lib/expenses';
import { formatMoney } from '../../lib/currencies';
import { useAuth } from '../../context/AuthContext';
import { listTripMembers, type TripMember } from '../../lib/members';
import type { ExpenseListItem } from '../../lib/types';
import { ExpenseSheet } from '../ExpenseSheet';
import { BalanceCard } from './BalanceCard';
import { makeStyles, useTheme } from '../../context/ThemeContext';
import { fonts, spacing } from '../../lib/theme';

export function ExpensesTab({ tripId, userId }: { tripId: string; userId: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const { profile } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // null = add; otherwise the expense being edited.
  const [sheetExpense, setSheetExpense] = useState<ExpenseListItem | null>(null);
  const openSheet = (expense: ExpenseListItem | null) => {
    setSheetExpense(expense);
    setSheetOpen(true);
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, settled, memberList] = await Promise.all([
        listExpenses(tripId),
        listSettlements(tripId),
        listTripMembers(tripId),
      ]);
      setExpenses(list);
      setSettlements(settled);
      setMembers(memberList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  // Recomputed from the list, so a save only ever moves its own currency's balance.
  const balances = balancesByCurrency(expenses, settlements, userId);
  // New expenses start in the currency last used on this trip, else your home currency.
  const defaultCurrency = expenses[0]?.currency ?? profile?.home_currency ?? 'INR';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BalanceCard balances={balances} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {expenses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptyText}>Tap + to log the first one.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {expenses.map((e, i) => (
              <Pressable
                key={e.id}
                onPress={() => openSheet(e)}
                accessibilityRole="button"
                accessibilityHint="Opens the expense to edit or delete it"
                style={({ pressed }) => [
                  styles.row,
                  i < expenses.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowLeft}>
                  <Text style={styles.desc}>{e.description}</Text>
                  <Text style={styles.payer}>Paid by {e.payerName ?? 'someone'}</Text>
                </View>
                <Text style={styles.amount}>{formatMoney(e.amount, e.currency)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => openSheet(null)}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + spacing.lg },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={28} color={colors.buttonText} />
      </Pressable>

      <ExpenseSheet
        visible={sheetOpen}
        expense={sheetExpense}
        defaultCurrency={defaultCurrency}
        tripId={tripId}
        userId={userId}
        members={members}
        onClose={() => setSheetOpen(false)}
        onChanged={load}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 120 },
  error: { marginBottom: spacing.md, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  list: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowPressed: { opacity: 0.6 },
  rowLeft: { flex: 1, paddingRight: spacing.md },
  desc: { fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  payer: { marginTop: 2, fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  amount: { fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  empty: { alignItems: 'center', paddingTop: spacing.xl },
  emptyTitle: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.buttonFill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
}));
