import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, spacing } from '../../lib/theme';

export default function AddItinerary() {
  const router = useRouter();
  // tripId is passed for the upcoming add-itinerary form.
  useLocalSearchParams<{ tripId: string }>();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Add to itinerary" subtitle="Coming soon" onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.text}>The add-itinerary form is up next.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  text: { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary },
});
