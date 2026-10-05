import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/ScreenHeader';
import { makeStyles } from '../../context/ThemeContext';
import { fonts, spacing } from '../../lib/theme';

export default function AddExpense() {
  const styles = useStyles();
  const router = useRouter();
  // tripId is passed for the upcoming add-expense form.
  useLocalSearchParams<{ tripId: string }>();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Add expense" subtitle="Coming soon" onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.text}>The add-expense form is up next.</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  text: { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary },
}));
