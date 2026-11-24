import { Dimensions, type TextStyle, type ViewStyle } from 'react-native';

/**
 * FireStock design tokens. Every screen and component reads colors, type, spacing, radii, shadows and
 * sizes from here, so a visual change is a one-file edit instead of a hunt across screens.
 */

export const COLORS = {
  navy: '#000851',
  orange: '#F05219',
  orangeSoft: '#FFEEE6',
  primary: '#1D4ED8',
  primaryBright: '#2563EB',
  primarySoft: '#EFF6FF',
  secondary: '#0EA5E9',
  /** Lavender accent used on navy surfaces (promo links, "melhor preço" labels, confetti). */
  accent: '#A7B0FF',
  accentSoft: 'rgba(167,176,255,0.45)',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  error: '#DC2626',
  errorSoft: '#FEE2E2',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  text: '#0F172A',
  textSecondary: '#475569',
  /** Lowest-contrast color still legible as body text on white (4.7:1). */
  textTertiary: '#64748B',
  /** Decorative only (placeholders, chevrons, inactive icons) — fails WCAG contrast as text. */
  textFaint: '#94A3B8',
  border: '#E2E8F0',
  borderSoft: '#F1F5F9',
  muted: '#CBD5E1',
  shadow: '#000000',
  white: '#FFFFFF',
  /** Text and hairlines on navy surfaces. */
  onDark: '#FFFFFF',
  onDarkMuted: 'rgba(255,255,255,0.75)',
  onDarkSubtle: 'rgba(255,255,255,0.3)',
  onDarkGlow: 'rgba(255,255,255,0.06)',
  scrim: 'rgba(15,23,42,0.5)',
  heroShade: 'rgba(0,8,81,0.18)',
};

/** Largura de referência do design (dp). Celulares mais estreitos reduzem só os títulos grandes, até 14%, para não
 * quebrar linha nem estourar a tela; telas maiores nunca aumentam o texto (o conteúdo já é centralizado e limitado). */
const WINDOW_WIDTH = Dimensions.get('window').width;
const DISPLAY_SCALE = Math.min(1, Math.max(0.86, WINDOW_WIDTH / 390));
const display = (size: number) => Math.round(size * DISPLAY_SCALE);

/** Abaixo disto (dp) campos lado a lado viram uma coluna só: cabem menos de ~100dp por campo. */
export const COMPACT_WIDTH = 360;

export const FONT_SIZES = {
  hero: display(30),
  display: display(28),
  title: display(24),
  h1: 22,
  h2: 18,
  subtitle: 16,
  body: 15,
  bodySmall: 14,
  label: 13,
  small: 12,
  caption: 11,
  micro: 10,
};

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/** Ready-made text styles for the recurring roles, so hierarchy stays identical across screens. */
export const TYPOGRAPHY = {
  screenTitle: { color: COLORS.navy, fontSize: FONT_SIZES.h1, fontWeight: FONT_WEIGHTS.heavy, letterSpacing: -0.2 },
  pageTitle: { color: COLORS.navy, fontSize: display(26), fontWeight: FONT_WEIGHTS.heavy, letterSpacing: -0.2 },
  sectionTitle: { color: COLORS.navy, fontSize: FONT_SIZES.h2, fontWeight: FONT_WEIGHTS.bold },
  cardTitle: { color: COLORS.navy, fontSize: FONT_SIZES.subtitle, fontWeight: FONT_WEIGHTS.bold },
  body: { color: COLORS.textTertiary, fontSize: FONT_SIZES.body, lineHeight: 22 },
  label: { color: COLORS.navy, fontSize: FONT_SIZES.label, fontWeight: FONT_WEIGHTS.semibold },
  overline: { color: COLORS.textTertiary, fontSize: FONT_SIZES.caption, fontWeight: FONT_WEIGHTS.bold, letterSpacing: 0.6 },
  button: { fontSize: FONT_SIZES.subtitle, fontWeight: FONT_WEIGHTS.bold },
} as const satisfies Record<string, TextStyle>;

export const RADIUS = {
  xs: 8,
  small: 12,
  input: 14,
  medium: 16,
  large: 20,
  xl: 26,
  pill: 999,
};

export const SPACING = {
  xxs: 6,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const SIZES = {
  /** Minimum tappable area recommended by Apple HIG / Material (44–48dp). */
  touchTarget: 44,
  buttonHeight: 56,
  inputHeight: 56,
  searchHeight: 52,
  iconButton: 44,
  chipHeight: 38,
  avatar: 46,
};

export const SHADOW_SM: ViewStyle = {
  shadowColor: COLORS.shadow,
  shadowOpacity: 0.03,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

export const SHADOW: ViewStyle = {
  shadowColor: COLORS.shadow,
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const SHADOW_LG: ViewStyle = {
  shadowColor: COLORS.shadow,
  shadowOpacity: 0.1,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 6,
};

/** Upward shadow for bars pinned to the bottom edge (CTA bars, bottom nav). */
export const SHADOW_BAR: ViewStyle = {
  shadowColor: COLORS.navy,
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: -6 },
  elevation: 8,
};

export const MOTION = {
  fast: 140,
  base: 220,
  slow: 320,
};

// Content is centered and capped at this width on tablet/web/desktop viewports
// so screens stay legible instead of stretching full-bleed.
export const MAX_CONTENT_WIDTH = 560;
