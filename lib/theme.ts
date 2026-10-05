/**
 * Friendcation design tokens — one set of colour tokens, each with a light and a
 * dark value. Components never hardcode colours: they read them through
 * `useTheme()` / `makeStyles()` (context/ThemeContext.tsx).
 *
 * Token ↔ design-spec names: background = surface-2, surface = surface-1,
 * buttonFill = fill-primary, buttonText = on-primary, accentTint = bg-accent,
 * successFill = fill-success, navBackground = device/nav header band.
 * Green is reserved for positive money states (textSuccess) and the second
 * map location dot (successFill) — never for avatars.
 */
export type ColorScheme = 'light' | 'dark';

const light = {
  background: '#fffdf8', // surface-2: page background
  surface: '#f6f1e8', // surface-1: cards, inputs, "+N" avatar overflow
  outerBackground: '#fffdf8', // app outer background (behind screens)
  border: 'rgba(64,48,32,0.1)',
  borderStrong: 'rgba(64,48,32,0.22)',
  text: '#2b241d', // text-primary (also nav title + icons)
  textSecondary: 'rgba(43,36,29,0.58)',
  textMuted: 'rgba(43,36,29,0.36)',
  textAccent: '#2b241d', // initials on bg-accent avatar circles
  textSuccess: '#2b241d', // "You are owed" amount (stays primary text in light)
  buttonFill: '#332a20', // fill-primary: buttons, FAB, pill, active dots, "now" border
  buttonText: '#fffdf8', // on-primary
  accentTint: '#f0e9dd', // bg-accent: "now" items, selected chips, invite code, avatars
  successFill: '#8f8272', // fill-success: second map location dot
  mapDotPrimary: '#332a20', // first map location dot
  mapDotOff: '#8f8272', // location dot for members with sharing off
  navBackground: '#F3EEE3', // device / nav header band
  danger: '#a3402f', // errors, destructive actions
  switchTrackOff: '#d9d2c6',
  switchThumbOff: '#fffdf8',
  scrim: 'rgba(43,36,29,0.35)', // bottom-sheet overlay
  dialogScrim: 'rgba(43,36,29,0.45)', // confirmation dialog over a sheet
  shadow: '#000000',
  viewerBackground: '#0e0b07', // full-screen attachment viewer (dark in both modes)
  onViewer: '#ffffff',
};

export type ThemeColors = typeof light;

// Warm dark, not pure black; shades separated for contrast.
const dark: ThemeColors = {
  background: '#15120f',
  surface: '#2f2821',
  outerBackground: '#0b0a08',
  border: 'rgba(255,238,214,0.16)',
  borderStrong: 'rgba(255,238,214,0.34)',
  text: '#f5efe6',
  textSecondary: 'rgba(245,239,230,0.72)',
  textMuted: 'rgba(245,239,230,0.48)',
  textAccent: '#f2d9bd',
  textSuccess: '#b9d3a8',
  buttonFill: '#efe3d1', // primary buttons become light cream…
  buttonText: '#15120f', // …with dark text
  accentTint: '#4a3c2e',
  successFill: '#9fbf8c', // green
  mapDotPrimary: '#e8b98a', // amber
  mapDotOff: 'rgba(245,239,230,0.48)',
  navBackground: '#221d18',
  danger: '#e08a76',
  switchTrackOff: '#51463b',
  switchThumbOff: '#f5efe6',
  scrim: 'rgba(0,0,0,0.55)', // stays a dark translucent overlay
  dialogScrim: 'rgba(0,0,0,0.62)',
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
