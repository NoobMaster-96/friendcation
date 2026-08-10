import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { formatAgo, listMemberLocations, setLocationSharing } from '../../lib/location';
import type { MemberLocation } from '../../lib/types';
import { colors, fonts, spacing } from '../../lib/theme';

const DOT_COLORS = [colors.buttonFill, '#8f8272'];
const OFF_DOT = '#8f8272';

export function LocationTab({ tripId, userId }: { tripId: string; userId: string }) {
  const [members, setMembers] = useState<MemberLocation[]>([]);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listMemberLocations(tripId);
      setMembers(data);
      setSharing(data.find((m) => m.userId === userId)?.sharingEnabled ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load locations.');
    } finally {
      setLoading(false);
    }
  }, [tripId, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onToggle = async (val: boolean) => {
    setSharing(val);
    try {
      await setLocationSharing(tripId, userId, val);
      load();
    } catch {
      setSharing(!val);
    }
  };

  let shareIdx = 0;
  const rows = members.map((m) => {
    const color = m.sharingEnabled ? DOT_COLORS[shareIdx++ % DOT_COLORS.length] : OFF_DOT;
    return { ...m, color };
  });
  const sharingRows = rows.filter((r) => r.sharingEnabled);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.map}>
        {sharingRows.map((m, i) => (
          <View
            key={m.userId}
            style={[
              styles.mapDot,
              {
                backgroundColor: m.color,
                left: `${18 + ((i * 27) % 60)}%`,
                top: `${22 + ((i * 33) % 55)}%`,
              },
            ]}
          />
        ))}
        <Text style={styles.mapLabel}>Map preview</Text>
      </View>

      <View style={styles.shareRow}>
        <Text style={styles.shareLabel}>Share my location</Text>
        <Switch
          value={sharing}
          onValueChange={onToggle}
          trackColor={{ true: colors.buttonFill, false: '#d9d2c6' }}
          thumbColor="#fffdf8"
          ios_backgroundColor="#d9d2c6"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.list}>
        {rows.length === 0 ? (
          <Text style={styles.emptyText}>No members yet.</Text>
        ) : (
          rows.map((m) => (
            <View key={m.userId} style={[styles.memberRow, !m.sharingEnabled && styles.memberOff]}>
              <View style={[styles.memberDot, { backgroundColor: m.color }]} />
              <Text style={styles.memberText}>
                {m.name} · {m.sharingEnabled ? formatAgo(m.updatedAt) : 'sharing off'}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: {
    height: 300,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.background,
  },
  mapLabel: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.md,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  shareLabel: { fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  error: {
    paddingHorizontal: spacing.lg,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.danger,
  },
  list: { paddingHorizontal: spacing.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  memberOff: { opacity: 0.55 },
  memberDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  memberText: { fontSize: 14, fontFamily: fonts.regular, color: colors.text },
  emptyText: {
    paddingVertical: spacing.md,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
