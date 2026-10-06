import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import type { CurrencyBalance } from '../../lib/expenses';
import type { TripMember } from '../../lib/members';
import { formatMoney, fromMinor } from '../../lib/currencies';
import { makeStyles } from '../../context/ThemeContext';
import { fonts, spacing } from '../../lib/theme';

type Person = { name: string; initials: string };

type Props = {
  balances: CurrencyBalance[];
  /** Trip members, for names and initials in the per-person breakdown. */
  members: TripMember[];
};

const firstName = (name: string) => name.split(' ')[0] || name;

/** First names, or full names where two members share a first name. */
function peopleLookup(members: TripMember[]): (userId: string) => Person {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(firstName(m.name), (counts.get(firstName(m.name)) ?? 0) + 1);
  const byId = new Map(members.map((m) => [m.userId, m]));
  return (userId) => {
    const m = byId.get(userId);
    if (!m) return { name: 'Former member', initials: '?' };
    const first = firstName(m.name);
    return { name: (counts.get(first) ?? 0) > 1 ? m.name : first, initials: m.initials };
  };
}

/**
 * "You are owed / You owe" per currency — never converted. Tap a currency for who
 * owes what; several can be open at once.
 */
export function BalanceCard({ balances, members }: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const person = peopleLookup(members);
  const toggle = (currency: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(currency)) next.add(currency);
      return next;
    });

  return (
    <View style={styles.card}>
      {balances.length === 0 ? (
        <View style={styles.row}>
          <Text style={styles.label}>All settled up</Text>
        </View>
      ) : (
        balances.map((b, i) => (
          <CurrencyRow
            key={b.currency}
            balance={b}
            expanded={open.has(b.currency)}
            onToggle={() => toggle(b.currency)}
            divider={i > 0}
            person={person}
          />
        ))
      )}
      <Text style={[styles.note, styles.divider]}>
        Each currency is settled separately — no conversion.
      </Text>
    </View>
  );
}

function CurrencyRow({
  balance,
  expanded,
  onToggle,
  divider,
  person,
}: {
  balance: CurrencyBalance;
  expanded: boolean;
  onToggle: () => void;
  divider: boolean;
  person: (userId: string) => Person;
}) {
  const styles = useStyles();
  const { currency, netMinor, people } = balance;
  const money = (minor: number) => formatMoney(fromMinor(minor, currency), currency);
  // Owed in one direction and owing in the other can cancel out exactly.
  const label = netMinor > 0 ? 'You are owed' : netMinor < 0 ? 'You owe' : 'Even overall';

  return (
    <View style={divider && styles.divider}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${currency}: ${label} ${money(netMinor)}`}
        accessibilityHint={expanded ? 'Hides who owes what' : 'Shows who owes what'}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{currency}</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
        <Text
          style={[styles.amount, netMinor > 0 ? styles.pos : netMinor < 0 ? styles.neg : null]}
        >
          {money(netMinor)}
        </Text>
        <Chevron open={expanded} />
      </Pressable>

      {expanded ? (
        <View style={styles.people}>
          {people.map((p) => {
            const who = person(p.userId);
            const owesYou = p.netMinor > 0;
            return (
              <View
                key={p.userId}
                style={styles.personRow}
                accessible
                accessibilityLabel={
                  owesYou
                    ? `${who.name} owes you ${money(p.netMinor)}`
                    : `You owe ${who.name} ${money(p.netMinor)}`
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{who.initials}</Text>
                </View>
                <Text style={styles.personName} numberOfLines={1}>
                  {who.name}
                  <Text style={styles.direction}>{owesYou ? ' owes you' : ', you owe'}</Text>
                </Text>
                <Text style={[styles.personAmount, owesYou ? styles.pos : styles.neg]}>
                  {money(p.netMinor)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** "›" that turns to point down while its row is open (0.2s, CSS-style ease). */
function Chevron({ open }: { open: boolean }) {
  const styles = useStyles();
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: 200,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, [open, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  return <Animated.Text style={[styles.chevron, { transform: [{ rotate }] }]}>›</Animated.Text>;
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
  pressed: { opacity: 0.6 },
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
  pos: { color: colors.pos },
  neg: { color: colors.neg },
  chevron: {
    width: 10,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 16,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  people: { paddingBottom: 8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingLeft: 4 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 10, fontFamily: fonts.semibold, color: colors.text },
  personName: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.text },
  direction: { color: colors.textMuted },
  personAmount: { fontSize: 13, fontFamily: fonts.semibold },
  note: {
    paddingTop: 9,
    paddingBottom: 6,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
}));
