import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { formatDateRange } from '../../../lib/trips';
import type { Trip } from '../../../lib/types';
import { useAuth } from '../../../context/AuthContext';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { CircleButton } from '../../../components/CircleButton';
import { EditTripSheet } from '../../../components/EditTripSheet';
import { ItineraryTab } from '../../../components/trip/ItineraryTab';
import { LocationTab } from '../../../components/trip/LocationTab';
import { ExpensesTab } from '../../../components/trip/ExpensesTab';
import { colors, fonts, spacing } from '../../../lib/theme';

const TABS = ['Itinerary', 'Live location', 'Expenses'] as const;
const H_PAD = spacing.lg;
const UNDERLINE_INSET = 14;

export default function TripDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [active, setActive] = useState(0);
  const [pagerH, setPagerH] = useState(0);
  const [editVisible, setEditVisible] = useState(false);

  const scrollX = useRef(new Animated.Value(0)).current;
  const pagerRef = useRef<any>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      const { data } = await supabase
        .from('trips')
        .select('id,name,start_date,end_date,created_by,invite_code,created_at')
        .eq('id', id)
        .maybeSingle();
      if (on) {
        setTrip((data as Trip | null) ?? null);
        setLoadingTrip(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [id]);

  const goTo = (i: number) => {
    pagerRef.current?.scrollTo({ x: i * width, animated: true });
    setActive(i);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== active) setActive(i);
  };

  const tabWidth = (width - 2 * H_PAD) / TABS.length;
  const underlineTranslate = scrollX.interpolate({
    inputRange: [0, width * (TABS.length - 1)],
    outputRange: [
      H_PAD + UNDERLINE_INSET,
      H_PAD + UNDERLINE_INSET + tabWidth * (TABS.length - 1),
    ],
    extrapolate: 'clamp',
  });

  const tripId = (id as string) ?? '';
  const userId = user?.id ?? '';
  const showFab = active === 2;

  if (loadingTrip) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Trip" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={trip?.name ?? 'Trip'}
        subtitle={trip ? formatDateRange(trip.start_date, trip.end_date) : undefined}
        onBack={() => router.back()}
        right={
          <CircleButton
            icon="settings-outline"
            accessibilityLabel="Group settings"
            onPress={() =>
              router.push({ pathname: '/trip-settings', params: { id: tripId } })
            }
          />
        }
        onEdit={trip ? () => setEditVisible(true) : undefined}
      />

      <View style={styles.tabBar}>
        {TABS.map((label, i) => (
          <Pressable
            key={label}
            style={styles.tab}
            onPress={() => goTo(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: active === i }}
          >
            <Text style={[styles.tabLabel, active === i ? styles.tabActive : styles.tabInactive]}>
              {label}
            </Text>
          </Pressable>
        ))}
        <Animated.View
          style={[
            styles.underline,
            { width: tabWidth - UNDERLINE_INSET * 2, transform: [{ translateX: underlineTranslate }] },
          ]}
        />
      </View>

      <Animated.ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(e) => setPagerH(e.nativeEvent.layout.height)}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={onMomentumEnd}
      >
        <View style={{ width, height: pagerH }}>
          <ItineraryTab tripId={tripId} userId={userId} />
        </View>
        <View style={{ width, height: pagerH }}>
          <LocationTab tripId={tripId} userId={userId} />
        </View>
        <View style={{ width, height: pagerH }}>
          <ExpensesTab tripId={tripId} userId={userId} />
        </View>
      </Animated.ScrollView>

      {showFab ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/add-expense',
              params: { tripId },
            })
          }
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
      ) : null}

      {trip ? (
        <EditTripSheet
          trip={trip}
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          onSaved={(t) => setTrip(t)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: H_PAD,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabLabel: { fontSize: 15 },
  tabActive: { fontFamily: fonts.semibold, color: colors.text },
  tabInactive: { fontFamily: fonts.regular, color: colors.textSecondary },
  underline: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
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
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.9 },
});
