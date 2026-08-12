import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedToggle } from '../../components/SegmentedToggle';
import { ProfileMenu } from '../../components/ProfileMenu';
import { AvatarStack } from '../../components/AvatarStack';
import { NewTripSheet } from '../../components/NewTripSheet';
import {
  listMyTrips,
  partitionTrips,
  formatDateRange,
  type TripBuckets,
} from '../../lib/trips';
import type { TripListItem } from '../../lib/types';
import { colors, fonts, spacing } from '../../lib/theme';

type Tab = 'upcoming' | 'past';

export default function TripList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('upcoming');
  const [buckets, setBuckets] = useState<TripBuckets>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTripVisible, setNewTripVisible] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const trips = await listMyTrips(user.id);
      setBuckets(partitionTrips(trips));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your trips.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const data = tab === 'upcoming' ? buckets.upcoming : buckets.past;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Friendcation"
        subtitle="Your travel diaries"
        right={<ProfileMenu />}
      />

      <View style={styles.toggleWrap}>
        <SegmentedToggle<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { label: 'Current & upcoming', value: 'upcoming' },
            { label: 'Past', value: 'past' },
          ]}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
            data.length === 0 && styles.listGrow,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
            />
          }
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              past={tab === 'past'}
              onPress={() => router.push(`/trip/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState tab={tab} error={error} onJoin={() => router.push('/join-trip')} />
          }
        />
      )}

      {tab === 'upcoming' ? (
        <Pressable
          onPress={() => setNewTripVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Create a trip"
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + spacing.lg },
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons name="add" size={28} color={colors.buttonText} />
        </Pressable>
      ) : null}

      <NewTripSheet
        visible={newTripVisible}
        onClose={() => setNewTripVisible(false)}
        onCreated={() => {
          setTab('upcoming');
          load();
        }}
      />
    </View>
  );
}

function TripCard({
  trip,
  past,
  onPress,
}: {
  trip: TripListItem;
  past: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, past && styles.cardPast, pressed && styles.cardPressed]}
    >
      <Text style={styles.tripName}>{trip.name}</Text>
      <Text style={styles.tripDates}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
      <View style={styles.avatars}>
        <AvatarStack initials={trip.members.map((m) => m.initial)} total={trip.memberCount} />
      </View>
    </Pressable>
  );
}

function EmptyState({
  tab,
  error,
  onJoin,
}: {
  tab: Tab;
  error: string | null;
  onJoin: () => void;
}) {
  if (error) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Couldn’t load trips</Text>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }
  if (tab === 'past') {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No past trips</Text>
        <Text style={styles.emptyText}>Trips move here once they’ve wrapped up.</Text>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No trips yet</Text>
      <Text style={styles.emptyText}>
        Tap the + to plan a trip, or join one with a friend’s invite code.
      </Text>
      <Pressable onPress={onJoin} hitSlop={8} style={styles.emptyLink}>
        <Text style={styles.emptyLinkText}>Join with a code</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toggleWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  listGrow: { flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardPast: { opacity: 0.55 },
  cardPressed: { opacity: 0.85 },
  tripName: { fontSize: 16, fontFamily: fonts.medium, color: colors.text },
  tripDates: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  avatars: { marginTop: spacing.md, flexDirection: 'row' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.buttonFill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.9 },
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
  emptyLink: { marginTop: spacing.lg },
  emptyLinkText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
});
