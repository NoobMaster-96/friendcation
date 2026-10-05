import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 180,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
