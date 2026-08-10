import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../lib/theme';

export default function Home() {
  const { loading, session } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Friendcation</Text>
      <Text style={styles.tagline}>Plan the trip. Skip the four apps.</Text>
      <View style={styles.status}>
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.statusText}>
            {session ? 'Signed in ✓' : 'Not signed in — signup coming next'}
          </Text>
        )}
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brand: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.textMuted,
  },
  status: {
    marginTop: spacing.xl,
    minHeight: 24,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 13,
    color: colors.textFaint,
  },
});
