import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { colors, fonts, radius, spacing } from '../../lib/theme';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Account" subtitle={profile?.email} onBack={() => router.back()} />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your invite code</Text>
          <Text style={styles.code}>{profile?.referral_code ?? '——'}</Text>
          <Text style={styles.cardHint}>Share this so friends can join Friendcation.</Text>
        </View>

        <Button
          label="Join a trip with a code"
          variant="secondary"
          onPress={() => router.push('/join-trip')}
          style={styles.join}
        />

        <View style={styles.spacer} />

        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  card: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  cardLabel: { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  code: {
    marginTop: 6,
    fontSize: 30,
    fontFamily: fonts.bold,
    letterSpacing: 4,
    color: colors.text,
  },
  cardHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  join: { marginTop: spacing.md },
  spacer: { flex: 1 },
});
