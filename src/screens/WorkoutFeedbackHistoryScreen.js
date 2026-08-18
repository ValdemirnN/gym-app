/**
 * WorkoutFeedbackHistoryScreen.js
 * Histórico de feedbacks do ALUNO — exibe dias passados, esforço,
 * comentários e a resposta do personal em destaque.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, screenPaddingTop } from '../utils/responsive';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Mapeamento de mood para labels amigáveis e cores
const MOOD_META = {
  muito_leve:  { label: 'Muito leve',       color: '#4FA8FF', bg: 'rgba(79,168,255,0.14)', icon: 'battery-charging' },
  leve:        { label: 'Tranquilo',         color: '#4FA8FF', bg: 'rgba(79,168,255,0.14)', icon: 'battery-charging' },
  moderado:    { label: 'Moderado',          color: '#2FE6A0', bg: 'rgba(47,230,160,0.14)', icon: 'activity' },
  dificil:     { label: 'Difícil',           color: '#FFB648', bg: 'rgba(255,182,72,0.14)',  icon: 'zap' },
  pesado:      { label: 'Pesado',            color: '#FFB648', bg: 'rgba(255,182,72,0.14)',  icon: 'zap' },
  exaustao:    { label: 'Exaustão máxima',   color: '#FF5A7A', bg: 'rgba(255,90,122,0.14)', icon: 'alert-circle' },
  exaustivo:   { label: 'Exaustivo',         color: '#FF5A7A', bg: 'rgba(255,90,122,0.14)', icon: 'alert-circle' },
};

function getMoodMeta(mood) {
  return MOOD_META[mood] || { label: mood || 'Não informado', color: colors.textDim, bg: colors.surface3, icon: 'minus' };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatTime(dateStr) {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m${s > 0 ? ` ${s}s` : ''}`;
}

// ── Item de feedback ──────────────────────────────────────────────────────────
function FeedbackItem({ log }) {
  const [expanded, setExpanded] = useState(false);
  const moodMeta = getMoodMeta(log.feedback_mood);
  const hasPersonalReply = !!log.personal_reply;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.feedCard}>
      {/* Cabeçalho */}
      <TouchableOpacity style={styles.feedHeader} activeOpacity={0.8} onPress={toggle}>
        <View style={styles.feedCheckCircle}>
          <Feather
            name={log.skipped ? 'x' : 'check'}
            size={s(16)}
            color={log.skipped ? colors.red : colors.accent}
          />
        </View>

        <View style={styles.feedHeaderCenter}>
          <Text style={styles.feedDate}>{formatDate(log.started_at)}</Text>
          {log.skipped ? (
            <Text style={styles.feedSkippedLabel}>Treino não realizado</Text>
          ) : (
            <Text style={styles.feedPreview} numberOfLines={expanded ? undefined : 1}>
              {log.feedback_comment
                ? `Seu comentário: ${log.feedback_comment}`
                : 'Sem comentário'}
            </Text>
          )}
        </View>

        {/* Badge de resposta do personal pendente/respondido */}
        <View style={styles.feedRightCol}>
          {hasPersonalReply && !expanded && (
            <View style={styles.replyDot} />
          )}
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={s(18)}
            color={colors.textDim}
          />
        </View>
      </TouchableOpacity>

      {/* Conteúdo expandido */}
      {expanded && (
        <View style={styles.feedBody}>
          {/* Stats do treino */}
          {!log.skipped && (
            <View style={styles.statsBox}>
              <View style={styles.statsRow}>
                <Text style={styles.statsLabel}>Início</Text>
                <Text style={styles.statsValue}>{formatTime(log.started_at)}</Text>
              </View>
              {log.finished_at && (
                <View style={styles.statsRow}>
                  <Text style={styles.statsLabel}>Fim</Text>
                  <Text style={styles.statsValue}>{formatTime(log.finished_at)}</Text>
                </View>
              )}
              {log.duration_seconds && (
                <View style={[styles.statsRow, styles.statsRowHighlight]}>
                  <Text style={styles.statsLabelBold}>Tempo de treino</Text>
                  <Text style={styles.statsValueBold}>{formatDuration(log.duration_seconds)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Intensidade / Esforço */}
          {log.feedback_mood && (
            <View style={styles.moodSection}>
              <Text style={styles.fieldLabel}>Intensidade</Text>
              <View style={[styles.moodBadge, { backgroundColor: moodMeta.bg }]}>
                <Feather name={moodMeta.icon} size={s(13)} color={moodMeta.color} />
                <Text style={[styles.moodBadgeText, { color: moodMeta.color }]}>
                  {moodMeta.label}
                </Text>
              </View>
            </View>
          )}

          {/* Comentário do aluno */}
          {log.feedback_comment ? (
            <View style={styles.commentSection}>
              <Text style={styles.fieldLabel}>Seu comentário</Text>
              <Text style={styles.commentText}>{log.feedback_comment}</Text>
            </View>
          ) : null}

          {/* Motivo de pular */}
          {log.skipped && log.skip_reason ? (
            <View style={styles.skipReasonBox}>
              <Feather name="info" size={s(12)} color={colors.red} />
              <Text style={styles.skipReasonText}>Motivo: {log.skip_reason}</Text>
            </View>
          ) : null}

          {/* ──────── RESPOSTA DO PERSONAL ──────── */}
          <View style={styles.personalReplySection}>
            <View style={styles.personalReplyHeader}>
              <Feather
                name={hasPersonalReply ? 'message-square' : 'clock'}
                size={s(13)}
                color={hasPersonalReply ? colors.accent : colors.textFaint}
              />
              <Text style={[
                styles.personalReplyHeaderText,
                { color: hasPersonalReply ? colors.accent : colors.textFaint }
              ]}>
                {hasPersonalReply ? 'Resposta do professor' : 'Aguardando feedback'}
              </Text>
            </View>

            {hasPersonalReply ? (
              <View style={styles.personalReplyBubble}>
                <Text style={styles.personalReplyText}>{log.personal_reply}</Text>
              </View>
            ) : (
              <Text style={styles.personalReplyPending}>
                Seu personal ainda não respondeu esse treino.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function WorkoutFeedbackHistoryScreen({ route, navigation }) {
  const { session } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workout_logs')
      .select('id, started_at, finished_at, duration_seconds, feedback_mood, feedback_comment, personal_reply, skipped, skip_reason, workouts(name, day_of_week)')
      .eq('user_id', session.user.id)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(60);

    setLogs(data || []);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const completedLogs = logs.filter((l) => !l.skipped);
  const skippedLogs = logs.filter((l) => l.skipped);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={s(20)} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>HISTÓRICO</Text>
          <Text style={styles.title}>Feedbacks</Text>
        </View>
      </View>

      {/* Estatísticas rápidas */}
      <View style={styles.statsHeader}>
        <View style={styles.statChip}>
          <Feather name="check-circle" size={s(13)} color={colors.accent} />
          <Text style={styles.statChipValue}>{completedLogs.length}</Text>
          <Text style={styles.statChipLabel}>treinos feitos</Text>
        </View>
        <View style={styles.statChip}>
          <Feather name="message-square" size={s(13)} color={colors.blue} />
          <Text style={styles.statChipValue}>{logs.filter((l) => l.personal_reply).length}</Text>
          <Text style={styles.statChipLabel}>respondidos</Text>
        </View>
        {skippedLogs.length > 0 && (
          <View style={styles.statChip}>
            <Feather name="x-circle" size={s(13)} color={colors.textDim} />
            <Text style={styles.statChipValue}>{skippedLogs.length}</Text>
            <Text style={styles.statChipLabel}>não treinou</Text>
          </View>
        )}
      </View>

      {/* Lista */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text style={styles.emptyText}>Carregando...</Text>
        ) : logs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="inbox" size={s(36)} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Nenhum treino registrado</Text>
            <Text style={styles.emptySubtitle}>
              Ao finalizar um treino, ele aparece aqui com o feedback do seu personal.
            </Text>
          </View>
        ) : (
          logs.map((log) => <FeedbackItem key={log.id} log={log} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(18),
    paddingTop: screenPaddingTop,
    paddingBottom: vs(14),
    gap: s(12),
  },
  backRow: {
    width: s(36), height: s(36),
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: ms(10),
    borderWidth: 1, borderColor: colors.border,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: fs(9), fontWeight: '700', color: colors.textDim2,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: vs(2),
  },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text },

  statsHeader: {
    flexDirection: 'row',
    gap: s(8),
    paddingHorizontal: s(18),
    marginBottom: vs(14),
  },
  statChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: vs(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ms(12),
    paddingVertical: vs(12),
    paddingHorizontal: s(8),
  },
  statChipValue: { color: colors.text, fontSize: fs(16), fontWeight: '800' },
  statChipLabel: { color: colors.textDim, fontSize: fs(9), fontWeight: '600', textAlign: 'center' },

  list: { paddingHorizontal: s(18), paddingBottom: vs(40) },

  emptyBox: { alignItems: 'center', paddingTop: vs(60), gap: vs(12) },
  emptyTitle: { color: colors.text, fontSize: fs(14), fontWeight: '700' },
  emptySubtitle: { color: colors.textDim, fontSize: fs(11), textAlign: 'center', lineHeight: 18 },
  emptyText: { color: colors.textDim, textAlign: 'center', paddingTop: vs(40) },

  // ── Card de Feedback ───────────────────────────────────────────
  feedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ms(16),
    marginBottom: vs(10),
    overflow: 'hidden',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s(14),
    gap: s(12),
  },
  feedCheckCircle: {
    width: s(38), height: s(38),
    borderRadius: s(19),
    backgroundColor: colors.accentGlow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.accent + '55',
    flexShrink: 0,
  },
  feedHeaderCenter: { flex: 1, gap: vs(3) },
  feedDate: { color: colors.text, fontSize: fs(12), fontWeight: '700' },
  feedPreview: { color: colors.textDim, fontSize: fs(10.5) },
  feedSkippedLabel: { color: colors.red, fontSize: fs(10.5), fontWeight: '600' },
  feedRightCol: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  replyDot: {
    width: s(8), height: s(8), borderRadius: s(4),
    backgroundColor: colors.accent,
  },

  // Corpo expandido
  feedBody: {
    paddingHorizontal: s(14),
    paddingBottom: vs(14),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: vs(14),
    paddingTop: vs(14),
  },

  // Stats do treino
  statsBox: {
    backgroundColor: colors.surface2,
    borderRadius: ms(10),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: s(14), paddingVertical: vs(9),
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statsRowHighlight: { backgroundColor: colors.surface3 },
  statsLabel: { color: colors.textDim, fontSize: fs(10.5), fontWeight: '600' },
  statsLabelBold: { color: colors.text, fontSize: fs(10.5), fontWeight: '700' },
  statsValue: { color: colors.text, fontSize: fs(10.5), fontWeight: '600' },
  statsValueBold: { color: colors.text, fontSize: fs(11), fontWeight: '800' },

  // Esforço
  moodSection: { gap: vs(8) },
  fieldLabel: {
    color: colors.textDim, fontSize: fs(10), fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  moodBadge: {
    flexDirection: 'row', alignItems: 'center', gap: s(7),
    borderRadius: ms(10), paddingHorizontal: s(12), paddingVertical: vs(8),
    alignSelf: 'flex-start',
  },
  moodBadgeText: { fontSize: fs(12), fontWeight: '700' },

  // Comentário
  commentSection: { gap: vs(8) },
  commentText: {
    color: colors.text, fontSize: fs(11.5), lineHeight: 18,
    backgroundColor: colors.surface2, borderRadius: ms(10),
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: s(14), paddingVertical: vs(10),
  },

  // Pular treino
  skipReasonBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: s(8),
    backgroundColor: colors.redGlow, borderRadius: ms(10),
    paddingHorizontal: s(12), paddingVertical: vs(10),
    borderWidth: 1, borderColor: colors.red + '44',
  },
  skipReasonText: { color: colors.red, fontSize: fs(10.5), flex: 1, lineHeight: 17 },

  // ── Resposta do Personal (DESTAQUE) ───────────────────────────
  personalReplySection: {
    borderRadius: ms(12),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    backgroundColor: colors.accentGlow,
  },
  personalReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    paddingHorizontal: s(14),
    paddingTop: vs(10),
    paddingBottom: vs(4),
  },
  personalReplyHeaderText: {
    fontSize: fs(10),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  personalReplyBubble: {
    paddingHorizontal: s(14),
    paddingBottom: vs(14),
    paddingTop: vs(4),
  },
  personalReplyText: {
    color: colors.text,
    fontSize: fs(12),
    lineHeight: 19,
    fontStyle: 'italic',
  },
  personalReplyPending: {
    color: colors.textFaint,
    fontSize: fs(10.5),
    paddingHorizontal: s(14),
    paddingBottom: vs(12),
    fontStyle: 'italic',
  },
});
