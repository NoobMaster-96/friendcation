import { Switch, type SwitchProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/** RN Switch with track/thumb colours from the theme tokens. */
export function ThemedSwitch({ value, ...rest }: SwitchProps) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      trackColor={{ true: colors.buttonFill, false: colors.switchTrackOff }}
      ios_backgroundColor={colors.switchTrackOff}
      thumbColor={value ? colors.buttonText : colors.switchThumbOff}
      {...rest}
    />
  );
}
