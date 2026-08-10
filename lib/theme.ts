/**
 * Friendcation design tokens — warm neutral palette (from the Login / Create
 * Account wireframes). No bright accents: a single dark button fill, plus a
 * tinted accent used for invite-code chips and the success banner.
 */
export const colors = {
  background: '#fffdf8', // page (surface-2)
  surface: '#f6f1e8', // card / input fill (surface-1)
  border: 'rgba(64,48,32,0.1)',
  borderStrong: 'rgba(64,48,32,0.22)',
  text: '#2b241d', // primary text
  textSecondary: 'rgba(43,36,29,0.58)', // secondary text
  textMuted: 'rgba(43,36,29,0.36)', // muted text
  buttonFill: '#332a20', // primary button
  buttonText: '#fffdf8',
  accentTint: '#f0e9dd', // invite-code chip / success banner
  success: '#5d7a4e', // subtle success check
  danger: '#a3402f', // errors (warm red)
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 };

export const radius = { input: 10, button: 10, card: 16 };
