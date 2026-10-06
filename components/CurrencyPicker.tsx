import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchCurrencies } from '../lib/currencies';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { fonts } from '../lib/theme';

type Props = {
  /** Selected ISO code. */
  value: string;
  onSelect: (code: string) => void;
};

/** Inline currency list for the expense sheet: search by code or name, grouped by continent. */
export function CurrencyPicker({ value, onSelect }: Props) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const scrolledToSelection = useRef(false);
  const groups = searchCurrencies(query);

  // Flat children so each continent header can be sticky.
  const children: ReactNode[] = [];
  const stickyHeaderIndices: number[] = [];
  for (const group of groups) {
    stickyHeaderIndices.push(children.length);
    children.push(
      <View key={`header-${group.continent}`} style={styles.header}>
        <Text style={styles.headerText} accessibilityRole="header">
          {group.continent}
        </Text>
      </View>
    );
    for (const c of group.currencies) {
      const selected = c.code === value;
      children.push(
        <Pressable
          key={c.code}
          onPress={() => onSelect(c.code)}
          // Open with the current currency in view (just below the sticky header).
          onLayout={
            selected && !query
              ? (e) => {
                  if (scrolledToSelection.current) return;
                  scrolledToSelection.current = true;
                  const y = e.nativeEvent.layout.y - 34;
                  if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
                }
              : undefined
          }
          accessibilityRole="radio"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`${c.name}, ${c.code}`}
          style={({ pressed }) => [
            styles.row,
            selected && styles.rowSelected,
            pressed && !selected && styles.rowPressed,
          ]}
        >
          <Text style={styles.code}>{c.code}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.symbol}>{c.symbol}</Text>
          <Ionicons
            name="checkmark"
            size={15}
            color={colors.text}
            style={selected ? undefined : styles.hidden}
          />
        </Pressable>
      );
    }
  }

  return (
    <View style={styles.panel}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search currency"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.text}
        keyboardAppearance={scheme}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search currency"
        style={styles.search}
      />
      {groups.length > 0 ? (
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          stickyHeaderIndices={stickyHeaderIndices}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>No currency matches “{query.trim()}”.</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  panel: {
    alignSelf: 'stretch',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  search: {
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 14,
    fontFamily: fonts.regular,
    letterSpacing: 0,
    color: colors.text,
  },
  list: { maxHeight: 240 },
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    letterSpacing: 11 * 0.06,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  rowSelected: { backgroundColor: colors.accentTint },
  rowPressed: { opacity: 0.6 },
  code: { width: 40, fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  name: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  symbol: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  hidden: { opacity: 0 },
  empty: {
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
}));
