import { Text, View } from 'react-native';
import type { CurrencyBalance } from '../../lib/expenses';
import { formatMoney, fromMinor } from '../../lib/currencies';
import { makeStyles } from '../../context/ThemeContext';
import { fonts, spacing } from '../../lib/theme';

/** "You are owed / You owe", one row per currency with a non-zero balance — never converted. */
export function BalanceCard({ balances }: { balances: CurrencyBalance[] }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      {balances.length === 0 ? (
        <View style={styles.row}>
          <Text style={styles.label}>All settled up</Text>
        </View>
      ) : (
        balances.map((b, i) => {
          const owed = b.netMinor > 0;
          const label = owed ? 'You are owed' : 'You owe';
          const amount = formatMoney(fromMinor(b.netMinor, b.currency), b.currency);
          return (
            <View
              key={b.currency}
              style={[styles.row, i > 0 && styles.divider]}
              accessible
              accessibilityLabel={`${b.currency}: ${label} ${amount}`}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{b.currency}</Text>
              </View>
              <Text style={styles.label}>{label}</Text>
              <Text style={[styles.amount, owed && styles.amountOwed]}>{amount}</Text>
            </View>
          );
        })
      )}
      <Text style={[styles.note, styles.divider]}>
        Each currency is settled separately — no conversion.
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  divider: { borderTopWidth: 0.5, borderTopColor: colors.border },
  // Fixed minimum so the labels line up whatever the code's letters.
  badge: {
    minWidth: 38,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: 11 * 0.04,
    color: colors.textSecondary,
  },
  label: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  amount: { fontSize: 20, fontFamily: fonts.semibold, color: colors.text },
  amountOwed: { color: colors.textAccent },
  note: {
    paddingTop: 9,
    paddingBottom: 6,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
}));
