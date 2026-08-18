// src/theme/theme.js - Com suporte a responsividade

import { s, vs, ms, fs, isSmallDevice } from '../utils/responsive';

const Colors = {
  // Background
  bg: '#0A0C10',
  surface: '#141821',
  surface2: '#1B202B',
  surface3: '#232938',

  // Lines & borders
  line: '#2A3040',
  border: '#2A3040',

  // Text
  text: '#F3F5F8',
  textDim: '#8D96A6',
  textDim2: '#8D96A6',
  textFaint: '#565E6E',

  // Accent colors
  accent: '#2FE6A0',
  accentDark: '#1E9E6E',
  accentGlow: 'rgba(47,230,160,0.14)',
  lime: '#2FE6A0',
  amber: '#FFB648',
  amberGlow: 'rgba(255,182,72,0.14)',
  blue: '#4FA8FF',
  blueGlow: 'rgba(79,168,255,0.14)',
  red: '#FF5A7A',
  redGlow: 'rgba(255,90,122,0.14)',
  danger: '#FF5A7A',

  border2: '#3A4356',

  muscleGroups: {
    peito: '#FF6B4A',
    costas: '#4FA8FF',
    pernas: '#B388FF',
    ombros: '#FFD166',
    biceps: '#FF6BAE',
    triceps: '#54E6B0',
    abdomen: '#4FD8E8',
    cardio: '#FF5A7A',
  },
};

const Fonts = {
  oswald700: { fontFamily: 'Oswald_700Bold',    fontWeight: '700' },
  oswald600: { fontFamily: 'Oswald_600SemiBold', fontWeight: '600' },
  oswald500: { fontFamily: 'Oswald_500Medium',   fontWeight: '500' },

  bold:     { fontFamily: 'Inter_700Bold',     fontWeight: '700' },
  semibold: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  medium:   { fontFamily: 'Inter_500Medium',   fontWeight: '500' },
  regular:  { fontFamily: 'Inter_400Regular',  fontWeight: '400' },

  monoSmall: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontWeight: '700',
    fontSize: fs(9),
  },
};

// Espaçamentos escaláveis
const Spacing = {
  xs:  vs(8),
  sm:  vs(12),
  md:  vs(16),
  lg:  vs(18),
  xl:  vs(24),
  xxl: vs(32),
};

// Raios responsivos
const BorderRadius = {
  sm:  ms(10, 0.3),
  md:  ms(16, 0.3),
  lg:  ms(22, 0.3),
  xl:  ms(28, 0.3),
  xxl: ms(36, 0.3),
  pill: 999,
};

const radius = BorderRadius;

// ─── Font sizes responsivos prontos para usar ─────────────────────────────────
export const fontSizes = {
  xs:   fs(9),
  sm:   fs(10),
  md:   fs(12),
  base: fs(13),
  lg:   fs(14),
  xl:   fs(16),
  xxl:  fs(20),
  h1:   fs(24),
  h2:   fs(20),
  h3:   fs(16),
};

// ─── Exports ──────────────────────────────────────────────────────────────────
export const colors  = Colors;
export const spacing = Spacing;
export const radius_export = radius;
export { Colors, Fonts, Spacing, BorderRadius, radius };

function normalizeGroupKey(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getMuscleColor(muscleGroup, exerciseType) {
  if (exerciseType === 'cardio') return Colors.muscleGroups.cardio;
  const key = normalizeGroupKey(muscleGroup);
  return Colors.muscleGroups[key] || Colors.accent;
}
