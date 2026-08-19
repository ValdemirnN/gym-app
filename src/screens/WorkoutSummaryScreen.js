/**
 * WorkoutSummaryScreen — Tela de Finalização do Treino
 *
 * Exibida após o usuário tocar em "Finalizar Treino" na ActiveWorkoutScreen.
 * Recebe o tempo total, logId e dados do treino, salva o feedback e
 * redireciona o aluno de volta ao início.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { updateRow } from '../lib/dataClient';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, screenPaddingTop, screenPaddingH } from '../utils/responsive';

// ─── Opções de mood ───────────────────────────────────────────────────────────
const MOOD_OPTIONS = [
  { key: 'muito_leve',  label: '😴', desc: 'Muito Leve' },
  { key: 'leve',        label: '🙂', desc: 'Leve' },
  { key: 'moderado',    label: '💪', desc: 'Moderado' },
  { key: 'pesado',      label: '🔥', desc: 'Pesado' },
  { key: 'exaustao',    label: '🫠', desc: 'Exaustão' },
];

// ─── Helper: formata segundos em "00:00" ──────────────────────────────────────
function formatDuration(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function WorkoutSummaryScreen({ route, navigation }) {
  const {
    logId,
    workoutName,
    elapsedSeconds = 0,
    startedAt,
    finishedAt,
    wentOffline = false,
  } = route.params;

  const [moodChoice, setMoodChoice]       = useState(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [saving, setSaving]               = useState(false);

  // ── Salvar e ir para Home ─────────────────────────────────────────────────
  const handleConcluir = async () => {
    setSaving(true);

    const { error } = await updateRow(
      'workout_logs',
      {
        finished_at:      finishedAt || new Date().toISOString(),
        duration_seconds: elapsedSeconds,
        feedback_mood:    moodChoice,
        feedback_comment: feedbackComment.trim() || null,
      },
      { id: logId }
    );

    setSaving(false);

    if (error) {
      Alert.alert('Erro ao salvar', error.message);
      return;
    }

    if (wentOffline) {
      Alert.alert(
        'Sem internet',
        'Bom trabalho 💪 Você estava sem internet — assim que conectar, o treino sobe automaticamente para o seu personal.'
      );
    }

    // Volta para a raiz do stack de Treinos (WorkoutsList)
    navigation.popToTop();
  };

  // ── Duração legível (ex: "32 min 14 seg") ─────────────────────────────────
  const durationLabel = (() => {
    const m   = Math.floor(elapsedSeconds / 60);
    const sec = elapsedSeconds % 60;
    if (m === 0) return `${sec} seg`;
    if (sec === 0) return `${m} min`;
    return `${m} min ${sec} seg`;
  })();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Cabeçalho de celebração ── */}
        <View style={styles.heroSection}>
          <View style={styles.trophyCircle}>
            <Feather name="award" size={s(34)} color="#04170F" />
          </View>
          <Text style={styles.heroTitle}>Treino concluído!</Text>
          <Text style={styles.heroSubtitle}>
            {workoutName}
          </Text>
        </View>

        {/* ── Cards de estatísticas ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Feather name="clock" size={s(18)} color={colors.accent} />
            <Text style={styles.statValue}>{formatDuration(elapsedSeconds)}</Text>
            <Text style={styles.statLabel}>Tempo total</Text>
          </View>

          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Feather name="calendar" size={s(18)} color={colors.amber} />
            <Text style={[styles.statValue, { color: colors.amber }]}>
              {startedAt
                ? new Date(startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </Text>
            <Text style={styles.statLabel}>Início</Text>
          </View>

          <View style={styles.statCard}>
            <Feather name="flag" size={s(18)} color={colors.blue} />
            <Text style={[styles.statValue, { color: colors.blue }]}>
              {finishedAt
                ? new Date(finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.statLabel}>Fim</Text>
          </View>
        </View>

        {/* ── Duração destacada ── */}
        <View style={styles.durationBanner}>
          <Feather name="zap" size={s(14)} color={colors.accent} />
          <Text style={styles.durationText}>
            Você treinou por <Text style={styles.durationHighlight}>{durationLabel}</Text>
          </Text>
        </View>

        {/* ── Seção de feedback: mood ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Como foi o treino hoje?</Text>
          <Text style={styles.sectionHint}>Toque em uma opção abaixo</Text>

          <View style={styles.moodGrid}>
            {MOOD_OPTIONS.map((m) => {
              const active = moodChoice === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.moodChip, active && styles.moodChipActive]}
                  onPress={() => setMoodChoice(active ? null : m.key)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.moodEmoji}>{m.label}</Text>
                  <Text style={[styles.moodDesc, active && styles.moodDescActive]}>
                    {m.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Seção de feedback: comentário ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Observações</Text>
          <Text style={styles.sectionHint}>
            Dores, dificuldades, algo que quer lembrar — opcional, mas ajuda muito seu personal.
          </Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Ex: senti dor no joelho no agachamento, aumentei o peso no supino..."
            placeholderTextColor={colors.textFaint}
            value={feedbackComment}
            onChangeText={setFeedbackComment}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* ── Botão Concluir ── */}
        <TouchableOpacity
          style={[styles.concludeButton, saving && styles.concludeButtonDisabled]}
          onPress={handleConcluir}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Feather name="check" size={s(18)} color="#04170F" />
          <Text style={styles.concludeButtonText}>
            {saving ? 'Salvando...' : 'Concluir'}
          </Text>
        </TouchableOpacity>

        {/* ── Link para pular o feedback ── */}
        <TouchableOpacity
          style={styles.skipLink}
          onPress={handleConcluir}
          disabled={saving}
        >
          <Text style={styles.skipLinkText}>Pular e voltar para o início</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    paddingTop: screenPaddingTop + vs(12),
    paddingHorizontal: screenPaddingH,
    paddingBottom: vs(48),
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: vs(24),
  },
  trophyCircle: {
    width: s(72),
    height: s(72),
    borderRadius: s(36),
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(14),
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroTitle: {
    fontSize: fs(22),
    fontWeight: '800',
    color: colors.text,
    marginBottom: vs(4),
  },
  heroSubtitle: {
    fontSize: fs(13),
    color: colors.textDim,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: s(8),
    marginBottom: vs(12),
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: s(12),
    alignItems: 'center',
    gap: vs(4),
  },
  statCardMiddle: {
    borderColor: `${colors.amber}55`,
    backgroundColor: colors.amberGlow,
  },
  statValue: {
    fontSize: fs(16),
    fontWeight: '800',
    color: colors.accent,
  },
  statLabel: {
    fontSize: fs(9),
    color: colors.textFaint,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Banner de duração
  durationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: `${colors.accent}44`,
    borderRadius: radius.sm,
    paddingHorizontal: s(14),
    paddingVertical: vs(10),
    marginBottom: vs(20),
  },
  durationText: {
    fontSize: fs(12),
    color: colors.textDim,
    fontWeight: '500',
  },
  durationHighlight: {
    color: colors.accent,
    fontWeight: '700',
  },

  // Cards de seção
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: s(16),
    marginBottom: vs(14),
  },
  sectionTitle: {
    fontSize: fs(13),
    fontWeight: '700',
    color: colors.text,
    marginBottom: vs(4),
  },
  sectionHint: {
    fontSize: fs(10.5),
    color: colors.textFaint,
    marginBottom: vs(14),
    lineHeight: vs(16),
  },

  // Mood grid
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
  },
  moodChip: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: vs(10),
    paddingHorizontal: s(10),
    minWidth: s(58),
    gap: vs(4),
  },
  moodChipActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  moodEmoji: {
    fontSize: fs(22),
  },
  moodDesc: {
    fontSize: fs(9),
    color: colors.textDim,
    fontWeight: '600',
    textAlign: 'center',
  },
  moodDescActive: {
    color: colors.accent,
    fontWeight: '700',
  },

  // Campo de comentário
  commentInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: s(12),
    color: colors.text,
    fontSize: fs(12),
    minHeight: vs(90),
    lineHeight: vs(19),
  },

  // Botão Concluir
  concludeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: vs(16),
    marginTop: vs(4),
    shadowColor: colors.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  concludeButtonDisabled: {
    opacity: 0.6,
  },
  concludeButtonText: {
    fontSize: fs(15),
    fontWeight: '700',
    color: '#04170F',
  },

  // Link de pular
  skipLink: {
    alignItems: 'center',
    paddingVertical: vs(14),
  },
  skipLinkText: {
    fontSize: fs(11),
    color: colors.textFaint,
    textDecorationLine: 'underline',
  },
});
