/**
 * responsive.js
 * Sistema de responsividade centralizado.
 *
 * BASE de referência: 360×800dp — tamanho do celular que ficou com visual perfeito.
 * Telas maiores crescem levemente mas com teto (clamp) para manter proporções visuais.
 */

import { Dimensions, PixelRatio, Platform } from 'react-native';

// ─── Base de referência ───────────────────────────────────────────────────────
// 360px = celular Galaxy A/S FE — tamanho de referência visual aprovado
const BASE_WIDTH  = 360;
const BASE_HEIGHT = 800;

// ─── Tamanho real da janela ───────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Escala base (sem clamp) ──────────────────────────────────────────────────
const rawScaleX = SCREEN_W / BASE_WIDTH;
const rawScaleY = SCREEN_H / BASE_HEIGHT;

// ─── Escala com teto: no máximo 12% maior que a base ─────────────────────────
// Isso evita que telas muito largas (412px+) inflem fontes e ícones demais.
// Telas menores que a base ainda encolhem normalmente.
const scaleX = Math.min(rawScaleX, 1.12);
const scaleY = Math.min(rawScaleY, 1.15);

/**
 * s(n) — escala horizontal com teto.
 * Use para: larguras, padding lateral, tamanho de ícones, avatares.
 */
export const s = (size) =>
  Math.round(PixelRatio.roundToNearestPixel(size * scaleX));

/**
 * vs(n) — escala vertical com teto.
 * Use para: alturas, padding top/bottom, margens verticais.
 */
export const vs = (size) =>
  Math.round(PixelRatio.roundToNearestPixel(size * scaleY));

/**
 * ms(n, factor) — escala moderada.
 * factor 0 = tamanho fixo, 1 = totalmente proporcional.
 * Padrão 0.3 para um crescimento bem sutil.
 */
export const ms = (size, factor = 0.3) =>
  Math.round(PixelRatio.roundToNearestPixel(size + (s(size) - size) * factor));

/**
 * fs(n) — escala de fontes.
 * Fator 0.15: fontes quase não crescem em telas maiores.
 * Ex: fs(14) → 14px em 360px, ~14-15px em 412px.
 * Mínimo de 10 para nunca deixar texto ilegível.
 */
export const fs = (size) => Math.max(10, ms(size, 0.15));

// ─── Informações do dispositivo ───────────────────────────────────────────────
export const screenWidth  = SCREEN_W;
export const screenHeight = SCREEN_H;

/** Telas compactas: abaixo de 360dp */
export const isSmallDevice = SCREEN_W < 360;

/** Telas grandes: acima de 410dp (Galaxy S22+, Pixel 7, etc.) */
export const isLargeDevice = SCREEN_W > 410;

export const isIOS = Platform.OS === 'ios';

/**
 * Altura da tab bar responsiva.
 */
export function tabBarHeight(bottomInset = 0) {
  const base = isIOS ? (bottomInset > 0 ? 50 : 56) : 56;
  return vs(base) + (bottomInset > 0 ? bottomInset : 0);
}

/**
 * Padding top padrão de tela.
 * Em telas compactas reduz um pouco para não desperdiçar espaço.
 */
export const screenPaddingTop = vs(isSmallDevice ? 42 : 52);

/**
 * Padding horizontal padrão de tela.
 */
export const screenPaddingH = s(isSmallDevice ? 14 : 18);
