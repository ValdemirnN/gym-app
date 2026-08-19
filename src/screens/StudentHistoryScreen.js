import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startStr, endStr) {
  if (!endStr) return null;
  const mins = Math.round((new Date(endStr) - new Date(startStr)) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? m + 'min' : ''}`;
}

function groupSetsByExercise(sets) {
  const order = [];
  const map = {};
  (sets || []).forEach((s) => {
    const exId = s.exercise_id;
    if (!map[exId]) {
      map[exId] = { exerciseName: s.exercises?.name || 'Exercício removido', sets: [] };
      order.push(exId);
    }
    map[exId].sets.push(s);
  });
  return order.map((exId) => map[exId]);
}

// Componente de card expandível por sessão
function LogCard({ item, studentName, startExpanded }) {
  const [expanded, setExpanded] = useState(!!startExpanded);
  const [loading, setLoading] = useState(false);
  const [exerciseGroups, setExerciseGroups] = useState(null);
  const [exerciseNotes, setExerciseNotes] = useState(null);
  const [logDetail, setLogDetail] = useState(null);

  const duration = formatDuration(item.started_at, item.finished_at);
  const status = item.skipped ? 'skipped' : item.finished_at ? 'done' : 'pending';

  const loadDetail = async () => {
    if (exerciseGroups !== null) return; // já carregou
    setLoading(true);

    const [setsRes, statusRes, logRes] = await Promise.all([
      supabase
        .from('workout_log_sets')
        .select('id, exercise_id, set_number, reps_done, weight_kg, exercises(name)')
        .eq('workout_log_id', item.id)
        .order('set_number'),
      supabase
        .from('workout_log_exercise_status')
        .select('id, status, reason, exercises:exercise_id(name), substitute:substitute_exercise_id(name)')
        .eq('workout_log_id', item.id),
      supabase
        .from('workout_logs')
        .select('feedback_mood, feedback_comment, day_change_reason, personal_reply')
        .eq('id', item.id)
        .single(),
    ]);

    setExerciseGroups(groupSetsByExercise(setsRes.data || []));
    setExerciseNotes(statusRes.data || []);
    setLogDetail(logRes.data || null);
    setLoading(false);
  };

  // Se o card já abre expandido (vindo do calendário), carrega os detalhes de cara.
  React.useEffect(() => {
    if (startExpanded) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExpand = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    await loadDetail();
  };

  const MOOD_LABEL = {
    muito_leve: '😴 Muito Leve',
    leve: '😌 Tranquilo',
    moderado: '💪 Moderado',
    pesado: '🔥 Pesado',
    dificil: '😤 Difícil',
    exaustao: '🥵 Exaustão máxima',
    exaustivo: '🥵 Exaustivo',
  };

  // Estado local para edição da resposta do personal
  const [editingReply, setEditingReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [savingReply, setSavingReply] = useState(false);

  const saveReply = async () => {
    setSavingReply(true);
    await supabase
      .from('workout_logs')
      .update({ personal_reply: replyText.trim() || null })
      .eq('id', item.id);
    setSavingReply(false);
    setEditingReply(false);
    // Recarrega logDetail localmente
    setLogDetail((prev) => ({ ...prev, personal_reply: replyText.trim() || null }));
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        status === 'skipped' && styles.cardSkipped,
        status === 'done' && styles.cardDone,
      ]}
      activeOpacity={0.8}
      onPress={handleExpand}
    >
      {/* ── Header do card ── */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.workouts?.name || 'Treino removido'}</Text>
          <Text style={styles.cardSubtitle}>
            {formatDate(item.started_at)} · {formatTime(item.started_at)}
          </Text>
          {item.skipped && item.skip_reason ? (
            <Text style={styles.reasonText} numberOfLines={2}>
              Motivo: {item.skip_reason}
            </Text>
          ) : null}
          {!item.skipped && item.day_change_reason ? (
            <View style={styles.dayChangePill}>
              <Feather name="alert-circle" size={11} color={colors.amber} />
              <Text style={styles.dayChangePillText}>Trocou o dia do treino</Text>
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {status === 'done' ? (
            <View style={styles.badgeDone}>
              <Text style={styles.badgeDoneText}>{duration || '✅ Concluído'}</Text>
            </View>
          ) : status === 'pending' ? (
            <View style={styles.badgePending}>
              <Text style={styles.badgePendingText}>Em andamento</Text>
            </View>
          ) : (
            <View style={styles.badgeSkipped}>
              <Text style={styles.badgeSkippedText}>❌ Não treinou</Text>
            </View>
          )}
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textDim2}
          />
        </View>
      </View>

      {/* ── Conteúdo expandido ── */}
      {expanded && (
        <View style={styles.expandedBody}>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
          ) : (
            <>
              {/* Comentário e mood do aluno */}
              {(logDetail?.feedback_comment || logDetail?.feedback_mood || logDetail?.day_change_reason) && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackBoxTitle}>
                    <Feather name="message-square" size={12} color={colors.accent} /> Observações do aluno
                  </Text>
                  {logDetail?.feedback_mood && (
                    <Text style={styles.feedbackMood}>
                      Sensação: {MOOD_LABEL[logDetail.feedback_mood] || logDetail.feedback_mood}
                    </Text>
                  )}
                  {logDetail?.feedback_comment ? (
                    <Text style={styles.feedbackComment}>"{logDetail.feedback_comment}"</Text>
                  ) : null}
                  {logDetail?.day_change_reason ? (
                    <Text style={styles.feedbackDayChange}>
                      Motivo da troca de dia: {logDetail.day_change_reason}
                    </Text>
                  ) : null}

                  {/* ── Resposta do Personal ── */}
                  <View style={styles.personalReplyBlock}>
                    <View style={styles.personalReplyLabelRow}>
                      <Feather name="message-square" size={s(12)} color={logDetail?.personal_reply ? colors.accent : colors.textFaint} />
                      <Text style={[styles.personalReplyLabel, { color: logDetail?.personal_reply ? colors.accent : colors.textFaint }]}>
                        {logDetail?.personal_reply ? 'Sua resposta' : 'Adicionar resposta ao aluno'}
                      </Text>
                      {!editingReply && (
                        <TouchableOpacity
                          onPress={() => {
                            setReplyText(logDetail?.personal_reply || '');
                            setEditingReply(true);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="edit-3" size={s(12)} color={colors.textDim} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {editingReply ? (
                      <View style={styles.replyEditBox}>
                        <TextInput
                          style={styles.replyInput}
                          value={replyText}
                          onChangeText={setReplyText}
                          placeholder="Escreva seu feedback para o aluno..."
                          placeholderTextColor={colors.textDim2}
                          multiline
                          autoFocus
                        />
                        <View style={styles.replyEditActions}>
                          <TouchableOpacity
                            style={styles.replyCancelBtn}
                            onPress={() => setEditingReply(false)}
                          >
                            <Text style={styles.replyCancelText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.replySaveBtn}
                            onPress={saveReply}
                            disabled={savingReply}
                          >
                            <Text style={styles.replySaveText}>{savingReply ? 'Salvando...' : 'Enviar'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : logDetail?.personal_reply ? (
                      <View style={styles.replyBubble}>
                        <Text style={styles.replyText}>{logDetail.personal_reply}</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.replyEmptyBtn}
                        onPress={() => {
                          setReplyText('');
                          setEditingReply(true);
                        }}
                      >
                        <Feather name="plus" size={s(12)} color={colors.accent} />
                        <Text style={styles.replyEmptyBtnText}>Responder este treino</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Alterações (pulos/substituições) */}
              {(exerciseNotes || []).length > 0 && (
                <View style={styles.notesBlock}>
                  <Text style={styles.blockLabel}>Alterações feitas</Text>
                  {(exerciseNotes || []).map((note) => (
                    <View key={note.id} style={styles.noteRow}>
                      <Feather
                        name={note.status === 'pulado' ? 'x-circle' : 'refresh-cw'}
                        size={13}
                        color={note.status === 'pulado' ? colors.red : colors.amber}
                      />
                      <Text style={styles.noteText}>
                        {note.status === 'pulado'
                          ? `Pulou ${note.exercises?.name || 'exercício'}`
                          : `Trocou ${note.exercises?.name || 'exercício'} por ${note.substitute?.name || '?'}`}
                        {note.reason ? ` — ${note.reason}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Exercícios realizados */}
              {!item.skipped && (
                <>
                  <Text style={styles.blockLabel}>Exercícios realizados</Text>
                  {(exerciseGroups || []).length === 0 ? (
                    <Text style={styles.emptyDetail}>Nenhuma série registrada nessa sessão.</Text>
                  ) : (
                    (exerciseGroups || []).map((group, idx) => (
                      <View key={idx} style={styles.exerciseBlock}>
                        <Text style={styles.exerciseName}>{group.exerciseName}</Text>
                        {group.sets.map((s) => (
                          <View key={s.id} style={styles.setRow}>
                            <Text style={styles.setLabel}>Série {s.set_number}</Text>
                            <Text style={styles.setValue}>
                              {s.reps_done ?? '-'} reps
                              {s.weight_kg ? ` · ${s.weight_kg}kg` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function StudentHistoryScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const filterDate = route?.params?.filterDate || null;
  const [logs, setLogs] = useState([]);
  const [currentWorkout, setCurrentWorkout] = useState(null);

  const load = useCallback(async () => {
    const { data: logsData } = await supabase
      .from('workout_logs')
      .select(
        'id, started_at, finished_at, skipped, skip_reason, day_change_reason, workouts(name)'
      )
      .eq('user_id', studentId)
      .order('started_at', { ascending: false });
    setLogs(logsData || []);

    const { data: workoutsData } = await supabase
      .from('workouts')
      .select('name, created_at')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1);
    setCurrentWorkout(workoutsData?.[0] || null);
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const concluidos = logs.filter((l) => l.finished_at && !l.skipped).length;
  const naoPagos = logs.filter((l) => l.skipped).length;

  const diasComTreinoAtual = currentWorkout
    ? Math.floor(
        (Date.now() - new Date(currentWorkout.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Se veio de um dia específico do calendário, mostra só as sessões daquele dia
  const displayLogs = filterDate
    ? logs.filter((l) => new Date(l.started_at).toDateString() === new Date(filterDate).toDateString())
    : logs;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Histórico de treinos</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{concluidos}</Text>
          <Text style={styles.summaryLabel}>✅ Concluídos</Text>
        </View>
        <View style={[styles.summaryCard, naoPagos > 0 && styles.summaryCardSkipped]}>
          <Text style={[styles.summaryValue, naoPagos > 0 && { color: '#FF64B4' }]}>{naoPagos}</Text>
          <Text style={styles.summaryLabel}>❌ Não treinou</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {diasComTreinoAtual !== null ? `${diasComTreinoAtual}d` : '-'}
          </Text>
          <Text style={styles.summaryLabel}>
            {currentWorkout ? currentWorkout.name : 'Sem treino'}
          </Text>
        </View>
      </View>

      {filterDate ? (
        <TouchableOpacity
          style={styles.filterBanner}
          onPress={() => navigation.setParams({ filterDate: null })}
        >
          <Feather name="calendar" size={12} color={colors.accent} />
          <Text style={styles.filterBannerText}>Mostrando {formatDate(filterDate)}</Text>
          <Text style={styles.filterBannerClear}>Ver todos</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.tapHint}>Toque no card para ver detalhes e comentários</Text>
      )}

      <FlatList
        data={displayLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filterDate ? 'Nenhum treino registrado nesse dia.' : 'Nenhuma sessão de treino registrada ainda.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <LogCard item={item} studentName={studentName} startExpanded={!!filterDate && index === 0} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: s(18), paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, marginBottom: vs(14) },

  summaryRow: { flexDirection: 'row', marginBottom: vs(12), gap: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  summaryCardSkipped: {
    backgroundColor: 'rgba(255,100,180,0.08)',
    borderColor: 'rgba(255,100,180,0.3)',
  },
  summaryValue: { color: colors.text, fontSize: fs(18), fontWeight: '800' },
  summaryLabel: { color: colors.textDim, fontSize: fs(9), marginTop: vs(4), lineHeight: 14 },

  tapHint: {
    color: colors.textDim2,
    fontSize: fs(9),
    marginBottom: vs(10),
    textAlign: 'center',
    fontStyle: 'italic',
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    marginBottom: vs(12),
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: `${colors.accent}44`,
    borderRadius: radius.sm,
    paddingHorizontal: s(12),
    paddingVertical: vs(9),
  },
  filterBannerText: { color: colors.text, fontSize: fs(11), fontWeight: '600', flex: 1 },
  filterBannerClear: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700', textDecorationLine: 'underline' },

  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(40), fontSize: fs(12) },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(10),
  },
  cardDone: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  cardSkipped: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF64B4',
    backgroundColor: 'rgba(255,100,180,0.05)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: colors.text, fontSize: fs(12.5), fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: fs(9.5), marginTop: vs(2) },
  reasonText: { color: '#FF64B4', fontSize: fs(9), marginTop: vs(4), fontStyle: 'italic' },
  dayChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: vs(5),
    backgroundColor: colors.amberGlow,
    alignSelf: 'flex-start',
    paddingHorizontal: s(7),
    paddingVertical: vs(3),
    borderRadius: 100,
  },
  dayChangePillText: { color: colors.amber, fontSize: fs(9), fontWeight: '700' },

  badgeDone: {
    backgroundColor: colors.accentGlow,
    borderRadius: radius.sm - 4,
    paddingHorizontal: s(8),
    paddingVertical: vs(4),
  },
  badgeDoneText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  badgePending: {
    backgroundColor: colors.amberGlow,
    borderRadius: radius.sm - 4,
    paddingHorizontal: s(8),
    paddingVertical: vs(4),
  },
  badgePendingText: { color: colors.amber, fontSize: fs(9), fontWeight: '700' },
  badgeSkipped: {
    backgroundColor: 'rgba(255,100,180,0.15)',
    borderRadius: radius.sm - 4,
    paddingHorizontal: s(8),
    paddingVertical: vs(4),
  },
  badgeSkippedText: { color: '#FF64B4', fontSize: fs(9), fontWeight: '700' },

  // Expanded
  expandedBody: {
    marginTop: vs(14),
    paddingTop: vs(14),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },

  feedbackBox: {
    backgroundColor: colors.accentGlow,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: vs(12),
    borderWidth: 1,
    borderColor: 'rgba(51,226,139,0.25)',
  },
  feedbackBoxTitle: {
    color: colors.accent,
    fontSize: fs(9.5),
    fontWeight: '700',
    marginBottom: vs(6),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  feedbackMood: { color: colors.text, fontSize: fs(11), fontWeight: '600', marginBottom: vs(4) },
  feedbackComment: {
    color: colors.textDim,
    fontSize: fs(11),
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: vs(4),
  },
  feedbackDayChange: { color: colors.amber, fontSize: fs(10), marginTop: vs(4) },

  // ── Resposta do Personal ──────────────────────────────────────
  personalReplyBlock: {
    marginTop: vs(12),
    paddingTop: vs(12),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  personalReplyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: vs(8),
  },
  personalReplyLabel: {
    fontSize: fs(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  replyBubble: {
    backgroundColor: colors.accentGlow,
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: colors.accentDark,
    paddingHorizontal: s(12),
    paddingVertical: vs(10),
  },
  replyText: {
    color: colors.text,
    fontSize: fs(11.5),
    lineHeight: 18,
    fontStyle: 'italic',
  },
  replyEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: colors.accentGlow,
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: colors.accent + '44',
    paddingHorizontal: s(12),
    paddingVertical: vs(10),
    alignSelf: 'flex-start',
  },
  replyEmptyBtnText: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700' },
  replyEditBox: { gap: vs(8) },
  replyInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ms(10),
    paddingHorizontal: s(12),
    paddingVertical: vs(10),
    fontSize: fs(11.5),
    minHeight: vs(70),
    textAlignVertical: 'top',
  },
  replyEditActions: { flexDirection: 'row', gap: s(8) },
  replyCancelBtn: {
    flex: 1,
    backgroundColor: colors.surface3,
    borderRadius: ms(8),
    paddingVertical: vs(10),
    alignItems: 'center',
  },
  replyCancelText: { color: colors.textDim, fontSize: fs(11), fontWeight: '600' },
  replySaveBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: ms(8),
    paddingVertical: vs(10),
    alignItems: 'center',
  },
  replySaveText: { color: '#04170F', fontSize: fs(11), fontWeight: '700' },

  notesBlock: { marginBottom: vs(12) },
  blockLabel: {
    color: colors.textDim2,
    fontSize: fs(9),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: vs(8),
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: vs(5) },
  noteText: { color: colors.textDim, fontSize: fs(10.5), flex: 1, lineHeight: 17 },

  exerciseBlock: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  exerciseName: { color: colors.text, fontSize: fs(11.5), fontWeight: '700', marginBottom: vs(6) },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: vs(5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setLabel: { color: colors.textDim, fontSize: fs(10) },
  setValue: { color: colors.accent, fontSize: fs(10), fontWeight: '700' },
  emptyDetail: { color: colors.textDim, fontSize: fs(11), textAlign: 'center', paddingVertical: vs(10) },
});
