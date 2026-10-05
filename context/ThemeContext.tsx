import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, StyleSheet } from 'react-native';
import { palettes, type ColorScheme, type ThemeColors } from '../lib/theme';

const STORAGE_KEY = 'friendcation.colorScheme';

type ThemeContextValue = {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  /** False until the saved preference has been read (gate the splash on it). */
  ready: boolean;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') setSchemeState(saved);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Native UI the app doesn't draw itself (alerts, pickers, keyboard) follows the app's choice.
  useEffect(() => {
    Appearance.setColorScheme(scheme);
  }, [scheme]);

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      isDark: scheme === 'dark',
      colors: palettes[scheme],
      ready,
      setScheme,
      toggleScheme: () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [scheme, ready, setScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return ctx;
}

/**
 * Theme-aware StyleSheet: `const useStyles = makeStyles((colors) => ({ ... }))`,
 * then `const styles = useStyles()` inside the component. Sheets are built once
 * per scheme and cached, so switching themes is instant.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>
): () => T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  return function useStyles() {
    const { scheme } = useTheme();
    return (cache[scheme] ??= StyleSheet.create(factory(palettes[scheme])));
  };
}
