// Tokens de design compartilhados por todo o app, extraídos do protótipo
// HTML (Rasgua). Use estas constantes em qualquer tela nova para manter a
// mesma "cara" (cores, espaçamentos e cantos arredondados) do protótipo.
//
// Import:
//   import { colors, radius, spacing } from '../theme/theme';

export const colors = {
  bg: '#080B10',
  surface: '#121821',
  surface2: '#1A2230',
  surface3: '#212B3A',
  border: 'rgba(255,255,255,0.07)',
  border2: 'rgba(255,255,255,0.12)',
  text: '#F3F6F9',
  textDim: '#8A97A6',
  textDim2: '#5E6A78',
  accent: '#33E28B',
  accentDark: '#17B96F',
  accentGlow: 'rgba(51,226,139,0.18)',
  amber: '#FDB44E',
  amberGlow: 'rgba(253,180,78,0.16)',
  red: '#FB6467',
  redGlow: 'rgba(251,100,103,0.16)',
  blue: '#5B9BFF',
  blueGlow: 'rgba(91,155,255,0.16)',
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 22,
  pill: 20,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// Estilos reaproveitáveis mais comuns (cards de campo, chips, botões).
// Continuam sendo StyleSheet.create nas próprias telas — isso aqui é só
// para os valores brutos que se repetem em várias telas.
export const typography = {
  title: { fontWeight: '800', fontSize: 22, color: colors.text },
  sectionTitle: { fontWeight: '700', fontSize: 16.5, color: colors.text },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textDim2,
  },
  fieldLabel: {
    fontSize: 10.5,
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldValue: { fontSize: 14.5, color: colors.text, fontWeight: '700' },
};
