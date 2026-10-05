import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentedToggle } from '../SegmentedToggle';
import { ItineraryItemSheet } from '../ItineraryItemSheet';
import { ItineraryDetailSheet } from '../ItineraryDetailSheet';
import { formatItemTime, isNowItem, listItinerary } from '../../lib/itinerary';
import { listTripMembers, type TripMember } from '../../lib/members';
import type { ItineraryItemDetail, ItineraryListItem } from '../../lib/types';
import { makeStyles, useTheme } from '../../context/ThemeContext';
import { fonts, spacing } from '../../lib/theme';

type Filter = 'mine' | 'all';

export function ItineraryTab({ tripId, userId }: { tripId: string; userId: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ItineraryListItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'create' | 'edit'>('create');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editItem, setEditItem] = useState<ItineraryItemDetail | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const itemY = useRef<Record<string, number>>({});
  const [scrollY, setScrollY] = useState(0);
  const [nowTargetY, setNowTargetY] = useState<number | null>(null);
  const didAutoScroll = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [itemList, memberList] = await Promise.all([
        listItinerary(tripId),
        listTripMembers(tripId),
      ]);
      setItems(itemList);
      setMembers(memberList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the itinerary.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const now = new Date();
  const visible =
    filter === 'all'
      ? items
      : items.filter((it) => it.participantIds.includes(userId));

  const nowIds = new Set(visible.filter((it) => isNowItem(it, now)).map((it) => it.id));
  const firstNow = visible.find((it) => nowIds.has(it.id));

  useEffect(() => {
    didAutoScroll.current = false;
    setNowTargetY(null);
  }, [filter, tripId]);

  const onItemLayout = (id: string, e: LayoutChangeEvent) => {
    itemY.current[id] = e.nativeEvent.layout.y;
    if (firstNow && id === firstNow.id) {
      setNowTargetY(Math.max(e.nativeEvent.layout.y - spacing.sm, 0));
    }
  };

  // Auto-scroll once so the current item sits at the top of the viewport.
  useEffect(() => {
    if (didAutoScroll.current || nowTargetY == null) return;
    didAutoScroll.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: nowTargetY, animated: false }));
  }, [nowTargetY]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrollY(e.nativeEvent.contentOffset.y);

  let pill: 'up' | 'down' | null = null;
  if (nowTargetY != null) {
    if (scrollY > nowTargetY + 24) pill = 'up';
    else if (scrollY < nowTargetY - 24) pill = 'down';
  }

  const goToCurrent = () => {
    if (nowTargetY != null) scrollRef.current?.scrollTo({ y: nowTargetY, animated: true });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toggleWrap}>
        <SegmentedToggle<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { label: 'Mine', value: 'mine' },
            { label: 'All', value: 'all' },
          ]}
        />
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {error ? 'Couldn’t load itinerary' : 'Nothing planned yet'}
          </Text>
          <Text style={styles.emptyText}>
            {error ?? 'Tap + to add the first itinerary item.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((item) => (
            <View key={item.id} onLayout={(e) => onItemLayout(item.id, e)}>
              <ItineraryCard
                item={item}
                isNow={nowIds.has(item.id)}
                now={now}
                onPress={() => {
                  setDetailItemId(item.id);
                  setDetailOpen(true);
                }}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {pill ? (
        <Pressable style={styles.pill} onPress={goToCurrent} accessibilityRole="button">
          <Ionicons
            name={pill === 'up' ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.buttonText}
          />
          <Text style={styles.pillText}>Go to current event</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => {
          setSheetMode('create');
          setEditItem(null);
          setSheetOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Add itinerary item"
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + spacing.lg },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={28} color={colors.buttonText} />
      </Pressable>

      <ItineraryDetailSheet
        visible={detailOpen}
        itemId={detailItemId}
        members={members}
        onClose={() => setDetailOpen(false)}
        onEdit={(detail) => {
          setDetailOpen(false);
          setEditItem(detail);
          setSheetMode('edit');
          setSheetOpen(true);
        }}
      />

      <ItineraryItemSheet
        visible={sheetOpen}
        mode={sheetMode}
        tripId={tripId}
        userId={userId}
        members={members}
        item={editItem}
        onClose={() => setSheetOpen(false)}
        onSaved={load}
      />
    </View>
  );
}

function ItineraryCard({
  item,
  isNow,
  now,
  onPress,
}: {
  item: ItineraryListItem;
  isNow: boolean;
  now: Date;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const timeLabel = formatItemTime(item.start_time, now) + (isNow ? ' · now' : '');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, isNow && styles.cardNow, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.timeRow}>
          <View style={[styles.dot, isNow ? styles.dotNow : styles.dotNormal]} />
          <Text style={[styles.time, isNow && styles.timeNow]}>{timeLabel}</Text>
        </View>
        {item.attachmentCount > 0 ? (
          <View style={styles.attachChip}>
            <Ionicons name="attach" size={13} color={colors.textSecondary} />
            <Text style={styles.attachCount}>{item.attachmentCount}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title}>{item.title}</Text>

      {item.participantNames.length > 1 ? (
        <Text style={styles.subtitle}>Shared</Text>
      ) : (
        <View style={styles.subRow}>
          <Ionicons name="person" size={12} color={colors.textMuted} />
          <Text style={styles.subtitle}>
            {item.participantNames[0] ?? item.creatorName ?? 'Personal'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toggleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardNow: {
    backgroundColor: colors.accentTint,
    borderColor: colors.buttonFill,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotNormal: { backgroundColor: colors.textMuted },
  dotNow: { backgroundColor: colors.buttonFill },
  time: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  timeNow: { color: colors.text, fontFamily: fonts.medium },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  attachCount: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary },
  title: { marginTop: 8, fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  subtitle: { marginTop: 4, fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  pill: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.buttonFill,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pillText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.buttonText },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardPressed: { opacity: 0.75 },
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
