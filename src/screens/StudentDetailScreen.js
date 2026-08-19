import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { generateAndShareMonthlyReport } from '../lib/monthlyReport';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

const STATUS_LABEL = {
  aprovado: { text: 'Ativo', color: colors.accent, glow: colors.accentGlow },
  pendente: { text: 'Pendente de pagamento', color: colors.amber, glow: colors.amberGlow },
  recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
};

const MENU = [
  { key: 'StudentChat', icon: 'message-circle', title: 'Conversar', desc: 'Chat direto com o aluno' },
  { key: 'StudentWorkouts', icon: 'zap', title: 'Treinos', desc: 'Montar e gerenciar os treinos do aluno' },
  { key: 'StudentHistory', icon: 'trending-up', title: 'Histórico de treinos', desc: 'Sessões realizadas e evolução' },
  { key: 'StudentEvaluations', icon: 'bar-chart-2', title: 'Avaliações físicas', desc: 'Medidas, peso, fotos e metas do aluno' },
  { key: 'StudentParqView', icon: 'file-text', title: 'PAR-Q', desc: 'Questionário de saúde respondido pelo aluno' },
  { key: 'MonthlyReport', icon: 'download', title: 'Relatório mensal (PDF)', desc: 'Gerar e compartilhar resumo do mês' },
  { key: 'StudentHealth', icon: 'heart', title: 'Dados de saúde', desc: 'Condições e restrições informadas' },
  { key: 'StudentRegistration', icon: 'clipboard', title: 'Dados cadastrais', desc: 'Nome, e-mail e informações da conta' },
  { key: 'StudentSubscription', icon: 'credit-card', title: 'Assinatura', desc: 'Pagamentos e status de acesso' },
];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getAccessInfo(student) {
  if (!student || student.status !== 'aprovado') return null;
  if (student.access_blocked) return { text: 'Bloqueado', color: colors.red, glow: colors.redGlow };
  if (!student.access_expires_at) return { text: 'Sem data de expiração', color: colors.textDim, glow: colors.surface2 };
  const expires = new Date(student.access_expires_at);
  if (expires < new Date()) return { text: 'Expirado', color: colors.red, glow: colors.redGlow };
  return { text: 'Ativo', color: colors.accent, glow: colors.accentGlow };
}

function getDayStatus(dayIndex, isDone, isSkipped) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const dayDate = new Date(startOfWeek);
  dayDate.setDate(startOfWeek.getDate() + dayIndex);

  if (isSkipped) return 'skipped'; // aluno marcou que não treinou
  if (dayIndex === 0) return isDone ? 'done' : 'extra'; // domingo = dia extra
  if (isDone) return 'done';
  if (dayDate.getTime() > today.getTime()) return 'upcoming';
  return 'missed';
}

function getMonthName(monthIndex) {
  const months = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ];
  return months[monthIndex];
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ─── StudentCheckinCalendarModal ──────────────────────────────────────────
// Igual ao calendário que o aluno vê na própria Home, mas aqui QUALQUER dia
// é tocável: dia com treino concluído abre o feedback daquele dia; dia sem
// treino avisa que não houve treino.
function StudentCheckinCalendarModal({ visible, onClose, streak, totalWorkouts, allCheckinDates, onSelectDay }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const isCurrentMonth = viewMonth.year === today.getFullYear() && viewMonth.month === today.getMonth();
  const daysInMonth = getDaysInMonth(viewMonth.year, viewMonth.month);
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();

  const visibleCheckins = new Set(
    (allCheckinDates || [])
      .filter((d) => {
        const date = new Date(d);
        return date.getFullYear() === viewMonth.year && date.getMonth() === viewMonth.month;
      })
      .map((d) => new Date(d).getDate())
  );

  const monthTotal = visibleCheckins.size;
  const consistency = daysInMonth > 0 ? Math.round((monthTotal / daysInMonth) * 100) : 0;

  const changeMonth = (delta) => {
    setViewMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
  };

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={cs.modalOverlay} onPress={onClose}>
        <Pressable style={cs.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={cs.sheetHandle} />

          <View style={cs.sheetHeader}>
            <Text style={cs.sheetTitle}>Check-in de Treinos</Text>
            <TouchableOpacity onPress={onClose} style={cs.sheetCloseBtn} activeOpacity={0.7}>
              <Feather name="x" size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <View style={cs.sheetStats}>
            <View style={cs.sheetStatItem}>
              <Text style={[cs.sheetStatVal, { color: colors.accent }]}>{streak}</Text>
              <Text style={cs.sheetStatLabel}>🔥 Sequência</Text>
            </View>
            <View style={cs.sheetStatDivider} />
            <View style={cs.sheetStatItem}>
              <Text style={[cs.sheetStatVal, { color: colors.blue }]}>{monthTotal}</Text>
              <Text style={cs.sheetStatLabel}>📅 Treinos no mês</Text>
            </View>
            <View style={cs.sheetStatDivider} />
            <View style={cs.sheetStatItem}>
              <Text style={[cs.sheetStatVal, { color: colors.amber }]}>{totalWorkouts}</Text>
              <Text style={cs.sheetStatLabel}>💪 Total geral</Text>
            </View>
          </View>

          <View style={cs.calNavRow}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={cs.calNavBtn} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color={colors.textDim} />
            </TouchableOpacity>
            <Text style={cs.calNavTitle}>
              {getMonthName(viewMonth.month)} {viewMonth.year}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={cs.calNavBtn} activeOpacity={0.7} disabled={isCurrentMonth}>
              <Feather name="chevron-right" size={18} color={isCurrentMonth ? colors.textFaint : colors.textDim} />
            </TouchableOpacity>
          </View>

          <View style={cs.calWeekRow}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((l) => (
              <Text key={l} style={cs.calWeekLbl}>{l}</Text>
            ))}
          </View>

          <View style={cs.calGrid}>
            {calendarCells.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={cs.calCell} />;
              const isToday = isCurrentMonth && day === today.getDate();
              const trained = visibleCheckins.has(day);
              const cellDate = new Date(viewMonth.year, viewMonth.month, day);
              return (
                <TouchableOpacity
                  key={day}
                  activeOpacity={0.7}
                  onPress={() => onSelectDay && onSelectDay(cellDate, trained)}
                  style={[
                    cs.calCell,
                    trained && cs.calCellDone,
                    isToday && !trained && cs.calCellToday,
                  ]}
                >
                  <Text
                    style={[
                      cs.calDayNum,
                      trained && cs.calDayNumDone,
                      isToday && !trained && { color: colors.accent },
                    ]}
                  >
                    {day}
                  </Text>
                  {trained && <Feather name="check" size={9} color="#08120C" style={{ marginTop: 1 }} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={cs.summaryCard}>
            <View style={cs.summaryRow}>
              <View style={cs.summaryItem}>
                <Text style={[cs.summaryVal, { color: colors.accent }]}>{monthTotal}</Text>
                <Text style={cs.summaryLbl}>dias treinados</Text>
              </View>
              <View style={cs.summaryDivider} />
              <View style={cs.summaryItem}>
                <Text style={[cs.summaryVal, { color: colors.amber }]}>{consistency}%</Text>
                <Text style={cs.summaryLbl}>consistência</Text>
              </View>
              <View style={cs.summaryDivider} />
              <View style={cs.summaryItem}>
                <Text style={[cs.summaryVal, { color: colors.blue }]}>{daysInMonth - monthTotal}</Text>
                <Text style={cs.summaryLbl}>dias de descanso</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function StudentDetailScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const [student, setStudent] = useState(null);
  const [updatingAccess, setUpdatingAccess] = useState(false);
  const [consistency, setConsistency] = useState({ percentual: 0, treinosSemana: 0, metaTreinos: 0, exerciciosSemana: 0 });

  // Cada pos: { done: bool, skipped: bool }
  const [weekDays, setWeekDays] = useState(
    Array.from({length:7},()=>({done:false,skipped:false}))
  );
  const [generatingReport, setGeneratingReport] = useState(false);

  // Calendário completo (igual ao do aluno na Home) + dados pra ele
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [allCheckinDates, setAllCheckinDates] = useState([]);
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      await generateAndShareMonthlyReport(studentId, studentName || student?.name);
    } catch (e) {
      Alert.alert('Erro ao gerar relatório', e.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', studentId).single();
    setStudent(data);

    // Calendário semanal (bolinhas): marca o DIA em que o aluno concluiu
    // pelo menos um treino — não importa qual treino era originalmente
    // previsto pra aquele dia, se ele treinou na segunda, a segunda "fecha".
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // domingo dessa semana
    const { data: weekLogs } = await supabase
      .from('workout_logs')
      .select('started_at')
      .eq('user_id', studentId)
      .gte('started_at', startOfWeek.toISOString())
      .not('finished_at', 'is', null)
      .is('skipped', false);

    const days = Array.from({length:7},()=>({done:false,skipped:false}));
    (weekLogs || []).forEach((log) => {
      const d = new Date(log.started_at).getDay();
      days[d].done = true;
    });

    // Buscar dias marcados como "não treinou" nessa semana
    const { data: skippedLogs } = await supabase
      .from('workout_logs')
      .select('started_at')
      .eq('user_id', studentId)
      .gte('started_at', startOfWeek.toISOString())
      .eq('skipped', true);
    (skippedLogs || []).forEach((log) => {
      const d = new Date(log.started_at).getDay();
      if (!days[d].done) days[d].skipped = true;
    });
    setWeekDays(days);

    // Histórico completo de check-ins (pro calendário mensal) + sequência atual
    const { data: allDone } = await supabase
      .from('workout_logs')
      .select('started_at')
      .eq('user_id', studentId)
      .not('finished_at', 'is', null)
      .is('skipped', false)
      .order('started_at', { ascending: false });

    const doneLogs = allDone || [];
    setTotalWorkouts(doneLogs.length);
    setAllCheckinDates(doneLogs.map((l) => l.started_at));

    const doneDates = new Set(doneLogs.map((l) => new Date(l.started_at).toDateString()));
    let streakCount = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!doneDates.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (doneDates.has(cursor.toDateString())) {
      streakCount += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreak(streakCount);

    // Consistência do ALUNO (não confundir com a média geral do dashboard):
    // meta = quantos treinos esse aluno tem cadastrados na semana; feitos =
    // quantos ele concluiu nos últimos 7 dias; exercícios = total de séries
    // (de exercícios diferentes) batidas nesse período, já que um treino
    // pode ter vários exercícios.
    const { count: metaTreinos } = await supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', studentId);

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('user_id', studentId)
      .gte('started_at', seteDiasAtras.toISOString())
      .not('finished_at', 'is', null)
      .is('skipped', false);

    const treinosSemana = logs?.length || 0;
    const logIds = (logs || []).map((l) => l.id);

    let exerciciosSemana = 0;
    if (logIds.length > 0) {
      const { data: setRows } = await supabase
        .from('workout_log_sets')
        .select('workout_log_id, exercise_id')
        .in('workout_log_id', logIds);
      const uniqueExercises = new Set((setRows || []).map((r) => `${r.workout_log_id}-${r.exercise_id}`));
      exerciciosSemana = uniqueExercises.size;
    }

    const meta = metaTreinos || 0;
    const percentual = meta > 0 ? Math.min(Math.round((treinosSemana / meta) * 100), 100) : 0;

    setConsistency({ percentual, treinosSemana, metaTreinos: meta, exerciciosSemana });
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = STATUS_LABEL[student?.status] || STATUS_LABEL.pendente;
  const access = getAccessInfo(student);

  // Toque num dia do calendário: dia com treino concluído abre o feedback
  // daquele dia; dia sem registro avisa que o aluno não treinou.
  const handleSelectDay = (dateObj, trained) => {
    if (trained) {
      setCalendarVisible(false);
      navigation.navigate('StudentHistory', {
        studentId,
        studentName: studentName || student?.name,
        filterDate: dateObj.toISOString(),
      });
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj.getTime() > today.getTime()) {
      Alert.alert('Dia futuro', 'Esse dia ainda não chegou.');
      return;
    }
    Alert.alert('Sem treino nesse dia', `${studentName || student?.name || 'O aluno'} não teve treinos registrados nesse dia.`);
  };

  const handleLiberar = async () => {
    setUpdatingAccess(true);
    const { error } = await supabase.rpc('liberar_acesso_cliente', { p_cliente_id: studentId });
    setUpdatingAccess(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    load();
  };

  const handleBloquear = async () => {
    setUpdatingAccess(true);
    const { error } = await supabase.rpc('bloquear_acesso_cliente', { p_cliente_id: studentId });
    setUpdatingAccess(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    load();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <StudentCheckinCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        streak={streak}
        totalWorkouts={totalWorkouts}
        allCheckinDates={allCheckinDates}
        onSelectDay={handleSelectDay}
      />

      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Alunos</Text>
      </TouchableOpacity>

      <Text style={styles.name}>{studentName || student?.name}</Text>
      <View style={[styles.badge, { backgroundColor: status.glow }]}>
        <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
      </View>

      <View style={styles.consistencyCard}>
        <View style={styles.consistencyCircle}>
          <Text style={styles.consistencyPercentage}>{consistency.percentual}%</Text>
        </View>
        <View style={styles.consistencyTextContainer}>
          <Text style={styles.consistencyTitle}>Consistência semanal</Text>
          <Text style={styles.consistencyDesc}>
            {consistency.treinosSemana} de {consistency.metaTreinos} treinos previstos concluídos · {consistency.exerciciosSemana} exercício
            {consistency.exerciciosSemana === 1 ? '' : 's'} executados
          </Text>
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={() => setCalendarVisible(true)} style={styles.weekCard}>
        <View style={styles.weekCardTop}>
          <Text style={styles.weekTitle}>Semana atual</Text>
          <View style={styles.calBadge}>
            <Feather name="calendar" size={10} color={colors.accent} />
            <Text style={styles.calBadgeText}>Ver calendário</Text>
          </View>
        </View>
        <View style={styles.weekRow}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, i) => {
            const dayInfo = weekDays[i] || {done:false,skipped:false};
            const status = getDayStatus(i, dayInfo.done, dayInfo.skipped);
            const iconByStatus = {
              done:     { name: 'check', color: '#04170F', bg: colors.accent, border: colors.accent, emoji: null },
              skipped:  { name: null, color: '#FF64B4', bg: 'rgba(255,100,180,0.15)', border: '#FF64B4', emoji: '❌' },
              missed:   { name: 'x', color: colors.textDim2, bg: 'transparent', border: colors.border, emoji: null },
              upcoming: { name: 'help-circle', color: colors.textDim2, bg: 'transparent', border: colors.border, emoji: null },
              extra:    { name: 'alert-circle', color: colors.amber, bg: 'transparent', border: colors.amber, emoji: null },
            }[status] || { name: 'circle', color: colors.textDim2, bg: 'transparent', border: colors.border, emoji: null };
            return (
              <View key={i} style={styles.weekDayCol}>
                <View style={[styles.weekDot, { backgroundColor: iconByStatus.bg, borderColor: iconByStatus.border }]}>
                  {iconByStatus.emoji
                    ? <Text style={{fontSize:10}}>{iconByStatus.emoji}</Text>
                    : <Feather name={iconByStatus.name} size={13} color={iconByStatus.color} />
                  }
                </View>
                <Text style={[styles.weekDayLabel, status === 'skipped' && {color:'#FF64B4'}]}>{label}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.weekLegend}>
          <Text style={styles.weekLegendItem}>✓ concluído</Text>
          <Text style={[styles.weekLegendItem, {color:'#FF64B4'}]}>❌ não foi treinar</Text>
          <Text style={styles.weekLegendItem}>✕ faltou (sem registro)</Text>
          <Text style={styles.weekLegendItem}>? ainda vai chegar</Text>
        </View>
      </TouchableOpacity>

      {access && (
        <View style={styles.accessBox}>
          <View style={styles.accessRow}>
            <Text style={styles.accessLabel}>Acesso desde</Text>
            <Text style={styles.accessValue}>{formatDate(student?.approved_at)}</Text>
          </View>
          <View style={styles.accessRow}>
            <Text style={styles.accessLabel}>Válido até</Text>
            <Text style={styles.accessValue}>{formatDate(student?.access_expires_at)}</Text>
          </View>
          <View style={styles.accessRow}>
            <Text style={styles.accessLabel}>Status de acesso</Text>
            <View style={[styles.badge, { backgroundColor: access.glow }]}>
              <Text style={[styles.badgeText, { color: access.color }]}>{access.text}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            <TouchableOpacity
              style={[styles.accessButton, styles.accessButtonGreen]}
              onPress={handleLiberar}
              disabled={updatingAccess}
            >
              <Text style={styles.accessButtonText}>{updatingAccess ? '...' : 'Liberar (+1 mês)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accessButton, styles.accessButtonRed]}
              onPress={handleBloquear}
              disabled={updatingAccess}
            >
              <Text style={styles.accessButtonTextRed}>{updatingAccess ? '...' : 'Bloquear'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ marginTop: 24 }}>
        {MENU.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.menuCard}
            activeOpacity={0.8}
            onPress={() => {
              if (item.key === 'MonthlyReport') {
                handleGenerateReport();
                return;
              }
              navigation.navigate(
                item.key,
                item.key === 'StudentChat'
                  ? { otherUserId: studentId, otherUserName: studentName || student?.name }
                  : { studentId, studentName: studentName || student?.name }
              );
            }}
          >
            <View style={styles.menuIcon}>
              {generatingReport && item.key === 'MonthlyReport' ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Feather name={item.icon} size={18} color={colors.accent} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textDim2} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  name: { fontSize: fs(22), fontWeight: '800', color: colors.text, marginBottom: vs(10) },
  badge: { alignSelf: 'flex-start', paddingHorizontal: s(12), paddingVertical: vs(5), borderRadius: radius.pill },
  badgeText: { fontSize: fs(10), fontWeight: '700' },
  consistencyCard: {
    flexDirection: 'row',
    backgroundColor: '#1C293A',
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    marginTop: vs(16),
  },
  consistencyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  consistencyPercentage: { color: '#FFF', fontWeight: 'bold', fontSize: fs(12) },
  consistencyTextContainer: { flex: 1 },
  consistencyTitle: { color: '#FFF', fontWeight: 'bold', fontSize: fs(13), marginBottom: vs(4) },
  consistencyDesc: { color: '#9CA3AF', fontSize: fs(10.5), lineHeight: 17 },
  weekCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginTop: vs(12),
  },
  weekTitle: { color: colors.textDim, fontSize: fs(10), fontWeight: '700', marginBottom: vs(10) },
  weekCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(2) },
  calBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
    paddingHorizontal: s(8),
    paddingVertical: vs(3),
    borderRadius: radius.pill,
    marginBottom: vs(8),
  },
  calBadgeText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDayCol: { alignItems: 'center', gap: 6 },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayLabel: { color: colors.textDim2, fontSize: fs(9), fontWeight: '600' },
  weekLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: vs(12) },
  weekLegendItem: { color: colors.textDim2, fontSize: fs(9) },
  menuCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: vs(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { color: colors.text, fontSize: fs(13), fontWeight: '700' },
  menuDesc: { color: colors.textDim, fontSize: fs(10), marginTop: vs(2) },
  accessBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginTop: vs(16),
  },
  accessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(8) },
  accessLabel: { color: colors.textDim, fontSize: fs(11) },
  accessValue: { color: colors.text, fontSize: fs(11), fontWeight: '600' },
  accessButton: { flex: 1, borderRadius: radius.sm - 4, paddingVertical: vs(10), alignItems: 'center' },
  accessButtonGreen: { backgroundColor: colors.accent },
  accessButtonRed: { backgroundColor: colors.redGlow, borderWidth: 1, borderColor: colors.red },
  accessButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(11) },
  accessButtonTextRed: { color: colors.red, fontWeight: '700', fontSize: fs(11) },
});

// Estilos do modal de calendário (mesmo visual do calendário do aluno na Home)
const cs = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: s(20),
    paddingBottom: vs(36),
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border2,
    alignSelf: 'center',
    marginTop: vs(12),
    marginBottom: vs(16),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(16),
  },
  sheetTitle: {
    color: colors.text,
    fontSize: fs(16),
    fontWeight: '800',
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetStats: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: s(14),
    marginBottom: vs(20),
  },
  sheetStatItem: { flex: 1, alignItems: 'center', gap: vs(4) },
  sheetStatVal: { fontSize: fs(20), fontWeight: '800', color: colors.text },
  sheetStatLabel: { color: colors.textDim, fontSize: fs(9), textAlign: 'center' },
  sheetStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(14),
  },
  calNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavTitle: {
    color: colors.text,
    fontSize: fs(13),
    fontWeight: '700',
  },
  calWeekRow: { flexDirection: 'row', marginBottom: vs(8) },
  calWeekLbl: {
    flex: 1,
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: fs(8.5),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: vs(16),
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginBottom: vs(4),
  },
  calCellDone: {
    backgroundColor: 'rgba(47,230,160,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.4)',
  },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  calDayNum: { color: colors.textDim2, fontSize: fs(11), fontWeight: '600' },
  calDayNumDone: { color: colors.accent, fontWeight: '800' },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
    padding: s(16),
    backgroundColor: 'rgba(47,230,160,0.08)',
  },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: fs(18), fontWeight: '800' },
  summaryLbl: { color: colors.textDim, fontSize: fs(9), marginTop: vs(3), textAlign: 'center' },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(47,230,160,0.2)',
  },
});
