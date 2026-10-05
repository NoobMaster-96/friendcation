import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { formatDateRange } from '../../lib/trips';
import { isValidEmail } from '../../lib/account';
import {
  addMemberByEmail,
  deleteTrip,
  EmailNotRegisteredError,
  inviteLink,
  leaveTrip,
  listTripMembers,
  removeMember,
  type TripMember,
} from '../../lib/members';
import type { Trip } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EditTripSheet } from '../../components/EditTripSheet';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { makeStyles, useTheme } from '../../context/ThemeContext';
import { fonts, radius, spacing } from '../../lib/theme';

export default function TripSettings() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = (id as string) ?? '';

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [{ data: tripData }, memberList] = await Promise.all([
        supabase
          .from('trips')
          .select('id,name,start_date,end_date,created_by,invite_code,created_at')
          .eq('id', tripId)
          .maybeSingle(),
        listTripMembers(tripId),
      ]);
      setTrip((tripData as Trip | null) ?? null);
      setMembers(memberList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load group.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isOwner = members.find((m) => m.userId === user?.id)?.role === 'owner';

  const onAdd = async () => {
    setAddError(null);
    if (!isValidEmail(email)) {
      setAddError('Enter a valid email address.');
      return;
    }
    setAdding(true);
    try {
      await addMemberByEmail(tripId, email);
      setEmail('');
      setAddOpen(false);
      await load();
    } catch (e) {
      if (e instanceof EmailNotRegisteredError) {
        setAddError('This email isn’t registered on Friendcation yet.');
      } else {
        setAddError(e instanceof Error ? e.message : 'Could not add that person.');
      }
    } finally {
      setAdding(false);
    }
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(inviteLink(trip?.invite_code ?? null));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onRemove = (member: TripMember) => {
    Alert.alert('Remove member', `Remove ${member.name} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(tripId, member.userId);
            await load();
          } catch (e) {
            Alert.alert('Couldn’t remove', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const onLeave = () => {
    Alert.alert('Leave group', 'You’ll lose access to this travel diary.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            if (user) await leaveTrip(tripId, user.id);
            router.dismissAll();
          } catch (e) {
            Alert.alert('Couldn’t leave', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const onDelete = () => {
    Alert.alert('Delete group', 'This permanently deletes the travel diary for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTrip(tripId);
            router.dismissAll();
          } catch (e) {
            Alert.alert('Couldn’t delete', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={trip?.name ?? 'Group'}
        subtitle={trip ? formatDateRange(trip.start_date, trip.end_date) : undefined}
        onBack={() => router.back()}
        onEdit={trip ? () => setEditVisible(true) : undefined}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Add people */}
          {addOpen ? (
            <View style={styles.addForm}>
              <TextField
                label="Add by email"
                value={email}
                onChangeText={setEmail}
                placeholder="friend@email.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                error={addError}
              />
              <View style={styles.addActions}>
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setAddOpen(false);
                    setEmail('');
                    setAddError(null);
                  }}
                  style={styles.addAction}
                />
                <Button label="Add" onPress={onAdd} loading={adding} style={styles.addAction} />
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setAddOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Ionicons name="person-add" size={18} color={colors.buttonText} />
              <Text style={styles.addButtonText}>Add people to group</Text>
            </Pressable>
          )}

          {/* Invite link */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Invite link</Text>
            <View style={styles.linkRow}>
              <Text style={styles.linkText} numberOfLines={1}>
                {inviteLink(trip?.invite_code ?? null)}
              </Text>
              <Pressable
                onPress={onCopy}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={15}
                  color={colors.text}
                />
                <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
            <Text style={styles.caption}>Anyone with this link can join this travel diary.</Text>
          </View>

          {/* Members */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Members</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {members.map((m) => {
              const owner = m.role === 'owner';
              return (
                <View key={m.userId} style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{m.initials}</Text>
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  {owner ? (
                    <Text style={styles.ownerTag}>Owner</Text>
                  ) : isOwner ? (
                    <Pressable onPress={() => onRemove(m)} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Danger zone */}
          <View style={styles.dangerZone}>
            <Pressable
              onPress={onLeave}
              accessibilityRole="button"
              style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            >
              <Text style={styles.outlineText}>Leave group</Text>
            </Pressable>

            <Pressable
              onPress={onDelete}
              disabled={!isOwner}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isOwner }}
              style={({ pressed }) => [
                styles.outlineBtn,
                isOwner ? styles.dangerBtn : styles.disabledBtn,
                pressed && isOwner && styles.pressed,
              ]}
            >
              <Text style={[styles.outlineText, isOwner ? styles.dangerText : styles.disabledText]}>
                Delete group
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

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

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  pressed: { opacity: 0.85 },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.buttonFill,
  },
  addButtonText: { fontSize: 16, fontFamily: fonts.semibold, color: colors.buttonText },
  addForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  addActions: { flexDirection: 'row', gap: spacing.md },
  addAction: { flex: 1 },

  section: { marginTop: spacing.xl },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 16,
    paddingRight: 6,
    height: 52,
  },
  linkText: { flex: 1, fontSize: 15, fontFamily: fonts.regular, color: colors.text },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.input,
    backgroundColor: colors.accentTint,
  },
  copyText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  caption: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textAccent },
  memberName: { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.text },
  ownerTag: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  removeText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.danger },

  error: { fontSize: 13, fontFamily: fonts.regular, color: colors.danger, marginBottom: spacing.sm },

  dangerZone: { marginTop: spacing.xl, gap: spacing.md },
  outlineBtn: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  dangerBtn: { borderColor: colors.danger },
  dangerText: { color: colors.danger },
  disabledBtn: { borderColor: colors.border, opacity: 0.5 },
  disabledText: { color: colors.textMuted },
}));
