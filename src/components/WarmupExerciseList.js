/**
 * WarmupExerciseList.js
 * src/components/WarmupExerciseList.js
 *
 * Exibe os exercícios de aquecimento do treino (is_warmup = true em workout_exercises).
 *
 * Props:
 *   items          — array de workout_exercise rows com is_warmup = true
 *   isPersonal     — boolean: mostra botões de editar/remover se true
 *   workoutId      — string (usado pelo personal para navegar ao editar)
 *   warmupConfirmed — boolean (aluno)
 *   onConfirmWarmup — () => void (aluno)
 *   onReload       — () => void (personal: chamado após remover)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';
import { s, vs, fs } from '../utils/responsive';
import InlineDemoVideo from './InlineDemoVideo';

export default function WarmupExerciseList({
  items = [],
  isPersonal = false,
  workoutId,
  warmupConfirmed = false,
  onConfirmWarmup,
  onReload,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!items || items.length === 0) return null;

  const handleRemoveItem = (item) => {
    const name = item.exercises?.name || 'este exercício';
    Alert.alert(
      'Remover do aquecimento',
      `Remover "${name}" do aquecimento?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('workout_exercises')
              .delete()
              .eq('id', item.id);
            if (error) {
              Alert.alert('Erro', error.message);
              return;
            }
            onReload?.();
          },
        },
      ]
    );
  };

  // Resumo para quando recolhido
  const summary = items
    .map((it) => it.exercises?.name)
    .filter(Boolean)
    .join(' · ');

  const totalMinutes = items.reduce((acc, it) => {
    if (it.target_duration_minutes) return acc + it.target_duration_minutes;
    return acc + ((it.target_sets || 1) * 1.5); // estimativa: 1.5 min por série
  }, 0);

  return (
    <View style={styles.card}>
      {/* Cabeçalho sempre visível */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Feather name="activity" size={s(15)} color={colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>AQUECIMENTO</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {items.length} exercício{items.length !== 1 ? 's' : ''} · ~{Math.round(totalMinutes)} min
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Badge de confirmado (aluno) */}
          {!isPersonal && warmupConfirmed && (
            <View style={styles.doneBadge}>
              <Feather name="check-circle" size={s(13)} color={colors.accent} />
              <Text style={styles.doneBadgeText}>OK</Text>
            </View>
          )}

          {/* Badge de pendente (aluno) */}
          {!isPersonal && !warmupConfirmed && (
            <View style={styles.pendingBadge}>
              <Feather name="lock" size={s(12)} color={colors.amber} />
              <Text style={styles.pendingBadgeText}>Obrigatório</Text>
            </View>
          )}

          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={s(16)}
            color={colors.textDim}
          />
        </View>
      </TouchableOpacity>

      {/* Hint quando recolhido e não confirmado (aluno) */}
      {!isPersonal && !warmupConfirmed && !expanded && (
        <TouchableOpacity
          style={styles.expandHint}
          onPress={() => setExpanded(true)}
          activeOpacity={0.8}
        >
          <Feather name="alert-circle" size={s(12)} color={colors.amber} />
          <Text style={styles.expandHintText}>
            Abra, faça o aquecimento e confirme para liberar o treino
          </Text>
        </TouchableOpacity>
      )}

      {/* Banner confirmado (aluno) */}
      {!isPersonal && warmupConfirmed && !expanded && (
        <View style={styles.confirmedBanner}>
          <Feather name="check-circle" size={s(13)} color={colors.accent} />
          <Text style={styles.confirmedBannerText}>Aquecimento concluído ✓</Text>
        </View>
      )}

      {/* Conteúdo expandido */}
      {expanded && (
        <View style={styles.body}>
          {items.map((item, idx) => {
            const ex = item.exercises || {};
            const isCardio = ex.exercise_type === 'cardio';
            const statText = isCardio
              ? `${item.target_duration_minutes ?? '?'} min`
              : `${item.target_sets ?? 1} × ${item.target_reps ?? '?'}`;

            return (
              <View key={item.id} style={styles.exerciseRow}>
                {/* Número */}
                <View style={styles.numWrap}>
                  <Text style={styles.num}>{String(idx + 1).padStart(2, '0')}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  {/* Nome + stat + ações */}
                  <View style={styles.exTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName}>{ex.name || '—'}</Text>
                      {ex.muscle_group ? (
                        <Text style={styles.exGroup}>{ex.muscle_group}</Text>
                      ) : null}
                    </View>

                    <View style={styles.exRight}>
                      <View style={styles.statChip}>
                        <Text style={styles.statChipText}>{statText}</Text>
                      </View>

                      {/* Ações do personal */}
                      {isPersonal && (
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleRemoveItem(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="trash-2" size={s(14)} color={colors.red} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Instruções */}
                  {ex.instructions ? (
                    <Text style={styles.instructions}>{ex.instructions}</Text>
                  ) : null}

                  {/* Vídeo */}
                  {ex.video_id ? (
                    <View style={{ marginTop: vs(8) }}>
                      <InlineDemoVideo videoId={ex.video_id} />
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}

          {/* Botão confirmar (aluno) */}
          {!isPersonal && !warmupConfirmed && onConfirmWarmup && (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onConfirmWarmup}
              activeOpacity={0.85}
            >
              <Feather name="check-circle" size={s(16)} color="#04170F" />
              <Text style={styles.confirmBtnText}>Confirmar Aquecimento</Text>
            </TouchableOpacity>
          )}

          {/* Dica para o personal editar */}
          {isPersonal && (
            <View style={styles.personalHint}>
              <Feather name="info" size={s(12)} color={colors.textDim2} />
              <Text style={styles.personalHintText}>
                Para adicionar ou editar exercícios de aquecimento, use "Editar Treino".
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amberGlow,
    marginHorizontal: s(16),
    marginBottom: vs(12),
    overflow: 'hidden',
  },

  // Cabeçalho
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(14),
    paddingVertical: vs(12),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: s(10) },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  iconWrap: {
    width: s(34),
    height: s(34),
    borderRadius: s(10),
    backgroundColor: colors.amberGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.amber,
    fontSize: fs(9),
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: vs(1),
  },
  subtitle: {
    color: colors.textDim,
    fontSize: fs(11),
    fontWeight: '500',
  },

  // Badges
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingHorizontal: s(8),
    paddingVertical: vs(3),
  },
  doneBadgeText: { color: colors.accent, fontSize: fs(10), fontWeight: '700' },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: colors.amberGlow,
    borderRadius: radius.pill,
    paddingHorizontal: s(8),
    paddingVertical: vs(3),
  },
  pendingBadgeText: { color: colors.amber, fontSize: fs(10), fontWeight: '700' },

  // Banners abaixo do header
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(14),
    paddingVertical: vs(8),
    borderTopWidth: 1,
    borderTopColor: colors.amberGlow,
  },
  expandHintText: { color: colors.amber, fontSize: fs(11), fontWeight: '600' },
  confirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(14),
    paddingVertical: vs(8),
    backgroundColor: colors.accentGlow,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },
  confirmedBannerText: { color: colors.accent, fontSize: fs(11), fontWeight: '700' },

  // Corpo expandido
  body: {
    paddingHorizontal: s(14),
    paddingBottom: vs(14),
    borderTopWidth: 1,
    borderTopColor: colors.amberGlow,
  },

  // Linha de exercício
  exerciseRow: {
    flexDirection: 'row',
    gap: s(10),
    paddingVertical: vs(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.amberGlow,
  },
  numWrap: {
    width: s(24),
    alignItems: 'center',
    paddingTop: vs(2),
  },
  num: { color: colors.amber, fontSize: fs(10), fontWeight: '700' },

  exTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: s(8),
  },
  exName: {
    color: colors.text,
    fontSize: fs(13),
    fontWeight: '600',
  },
  exGroup: {
    color: colors.textDim2,
    fontSize: fs(10),
    marginTop: vs(1),
    textTransform: 'capitalize',
  },
  exRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  statChip: {
    backgroundColor: colors.amberGlow,
    borderRadius: radius.pill,
    paddingHorizontal: s(9),
    paddingVertical: vs(4),
  },
  statChipText: { color: colors.amber, fontSize: fs(11), fontWeight: '700' },
  removeBtn: {
    padding: s(4),
  },
  instructions: {
    color: colors.textDim,
    fontSize: fs(12),
    lineHeight: fs(12) * 1.55,
    marginTop: vs(6),
  },

  // Botão confirmar (aluno)
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    marginTop: vs(14),
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: vs(14),
  },
  confirmBtnText: {
    color: '#04170F',
    fontSize: fs(14),
    fontWeight: '700',
  },

  // Hint do personal
  personalHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginTop: vs(14),
    paddingTop: vs(10),
    borderTopWidth: 1,
    borderTopColor: colors.amberGlow,
  },
  personalHintText: {
    color: colors.textDim2,
    fontSize: fs(11),
    flex: 1,
    lineHeight: 16,
  },
});
