import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, radius, spacing } from '../../lib/theme';

export default function Home() {
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const firstName = profile?.first_name?.trim() || 'there';

  return (
    <View style={styles.screen}>
      <ScreenHeader title={`Hi, ${firstName}`} subtitle="Your trips will show up here soon." />
      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your invite code</Text>
          <Text style={styles.code}>{profile?.referral_code ?? '——'}</Text>
          <Text style={styles.cardHint}>Share this so friends can join Friendcation.</Text>
        </View>

        <View style={styles.spacer} />

        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  spacer: { flex: 1 },
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
});
