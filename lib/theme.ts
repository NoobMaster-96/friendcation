/**
 * Friendcation design tokens — one set of colour tokens, each with a light and a
 * dark value. Components never hardcode colours: they read them through
 * `useTheme()` / `makeStyles()` (context/ThemeContext.tsx).
 *
 * Token ↔ design-spec names: background = surface-2, surface = surface-1,
 * buttonFill = fill-primary, buttonText = on-primary, accentTint = bg-accent,
 * successFill = fill-success, navBackground = device/nav background.
 */
export type ColorScheme = 'light' | 'dark';

const light = {
  background: '#fffdf8', // surface-2: page background
  surface: '#f6f1e8', // surface-1: cards, inputs
  border: 'rgba(64,48,32,0.1)',
  borderStrong: 'rgba(64,48,32,0.22)',
  text: '#2b241d', // text-primary (also nav title + icons)
  textSecondary: 'rgba(43,36,29,0.58)',
  textMuted: 'rgba(43,36,29,0.36)',
  buttonFill: '#332a20', // fill-primary: buttons, FAB, active dots, "now" border
  buttonText: '#fffdf8', // on-primary
  onPrimarySubtle: 'rgba(255,253,248,0.25)', // e.g. avatar on a selected chip
  accentTint: '#f0e9dd', // bg-accent: "now" items, selected chips, invite code
  successFill: '#8f8272', // fill-success: second location dot
  navBackground: '#F3EEE3', // device / nav bar background
  success: '#5d7a4e',
  danger: '#a3402f', // errors, destructive actions
  switchTrackOff: '#d9d2c6',
  switchThumbOff: '#fffdf8',
  scrim: 'rgba(43,36,29,0.35)', // bottom-sheet overlay
  shadow: '#000000',
  viewerBackground: '#0e0b07', // full-screen attachment viewer (dark in both modes)
  onViewer: '#ffffff',
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  background: '#1f1a16',
  surface: '#2a241e',
  border: 'rgba(255,240,220,0.1)',
  borderStrong: 'rgba(255,240,220,0.22)',
  text: '#f3ece2',
  textSecondary: 'rgba(243,236,226,0.62)',
  textMuted: 'rgba(243,236,226,0.38)',
  buttonFill: '#f0e6d8', // primary buttons become light cream…
  buttonText: '#1f1a16', // …with dark text
  onPrimarySubtle: 'rgba(31,26,22,0.14)',
  accentTint: '#3a3128',
  successFill: '#a89a88',
  navBackground: '#1a1612',
  success: '#9cb98a',
  danger: '#e08a76',
  switchTrackOff: '#4a4037',
  switchThumbOff: '#f3ece2',
  scrim: 'rgba(0,0,0,0.55)', // stays a dark translucent overlay
  shadow: '#000000',
  viewerBackground: '#0e0b07',
  onViewer: '#ffffff',
};

export const palettes: Record<ColorScheme, ThemeColors> = { light, dark };

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 };

export const radius = { input: 10, button: 10, card: 16 };
