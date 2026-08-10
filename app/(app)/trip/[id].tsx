import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { formatDateRange } from '../../../lib/trips';
import type { Trip } from '../../../lib/types';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../../lib/theme';

export default function TripDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('trips')
        .select('id,name,start_date,end_date,created_by,invite_code,created_at')
        .eq('id', id)
        .maybeSingle();
      if (active) {
        setTrip((data as Trip | null) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={trip?.name ?? 'Trip'}
        subtitle={trip ? formatDateRange(trip.start_date, trip.end_date) : undefined}
        onBack={() => router.back()}
      />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : !trip ? (
          <Text style={styles.muted}>Trip not found.</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Invite code</Text>
              <Text style={styles.code}>{trip.invite_code ?? '——'}</Text>
              <Text style={styles.cardHint}>Share this so friends can join this trip.</Text>
            </View>

            <View style={styles.soon}>
              <Text style={styles.soonTitle}>Itinerary · Live location · Expenses</Text>
              <Text style={styles.soonText}>
                Coming next — this is where the trip comes to life.
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  muted: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  card: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  cardLabel: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  code: {
    marginTop: 6,
    fontSize: 26,
    fontFamily: fonts.bold,
    letterSpacing: 3,
    color: colors.text,
  },
  cardHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  soon: {
    marginTop: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  soonTitle: { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  soonText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
