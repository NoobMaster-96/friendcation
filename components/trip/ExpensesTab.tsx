import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { computeNetBalance, formatMoney, listExpenses } from '../../lib/expenses';
import type { ExpenseListItem } from '../../lib/types';
import { colors, fonts, radius, spacing } from '../../lib/theme';

export function ExpensesTab({ tripId, userId }: { tripId: string; userId: string }) {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [net, setNet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [list, balance] = await Promise.all([
        listExpenses(tripId),
        computeNetBalance(tripId, userId),
      ]);
      setExpenses(list);
      setNet(balance);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  }, [tripId, userId]);

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

  const currency = expenses[0]?.currency ?? 'INR';
  const settled = Math.round(net) === 0;
  const label = settled ? 'All settled up' : net > 0 ? 'You are owed' : 'You owe';

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryAmount}>{formatMoney(net, currency)}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {expenses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No expenses yet</Text>
          <Text style={styles.emptyText}>Tap + to log the first one.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {expenses.map((e, i) => (
            <View key={e.id} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowLeft}>
                <Text style={styles.desc}>{e.description}</Text>
                <Text style={styles.payer}>Paid by {e.payerName ?? 'someone'}</Text>
              </View>
              <Text style={styles.amount}>{formatMoney(e.amount, e.currency)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 120 },
  summary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryLabel: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  summaryAmount: { marginTop: 4, fontSize: 32, fontFamily: fonts.bold, color: colors.text },
  error: { marginBottom: spacing.md, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  list: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLeft: { flex: 1, paddingRight: spacing.md },
  desc: { fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  payer: { marginTop: 2, fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted },
  amount: { fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  empty: { alignItems: 'center', paddingTop: spacing.xl },
  emptyTitle: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
