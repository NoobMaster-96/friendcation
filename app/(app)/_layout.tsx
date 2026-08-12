import { Stack } from 'expo-router';
import { colors } from '../../lib/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
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
