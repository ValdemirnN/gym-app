// src/theme/theme.js - Corrigido com Rasgua dark theme + redesign

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
  textDim2: '#8D96A6', // alias para compatibilidade
  textFaint: '#565E6E',

  // Accent colors (lime é a cor principal)
  accent: '#2FE6A0', // lime
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

  // Segunda variante de borda (um pouco mais clara, usada em separadores/inputs)
  border2: '#3A4356',

  // Muscle group colors
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
  // Oswald (headings)
  oswald700: {
    fontFamily: 'Oswald_700Bold',
    fontWeight: '700',
  },
  oswald600: {
    fontFamily: 'Oswald_600SemiBold',
    fontWeight: '600',
  },
  oswald500: {
    fontFamily: 'Oswald_500Medium',
    fontWeight: '500',
  },

  // Inter (body)
  bold: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  semibold: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  medium: {
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  regular: {
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },

  // JetBrains Mono (mono)
  monoSmall: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontWeight: '700',
    fontSize: 10.5,
  },
};

const Spacing = {
  xs: 8,    // 8px
  sm: 12,   // 12px
  md: 16,   // 16px
  lg: 18,   // 18px
  xl: 24,   // 24px
  xxl: 32,  // 32px
};

const BorderRadius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
  pill: 999,
};

const radius = BorderRadius; // alias para compatibilidade com código atual

// Exports em minúsculas para compatibilidade com código existente
export const colors = Colors;
export const spacing = Spacing;
export const radius_export = radius;

// Exports em maiúsculas para novos componentes
export { Colors, Fonts, Spacing, BorderRadius };
export { radius };

// Retorna a cor associada a um grupo muscular (ou ao cardio), com fallback
// pro accent quando o grupo não é reconhecido. Usado pra colorir ícones,
// bordas e badges de exercício de forma consistente pelo app.
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
