import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';
import { Feather } from '@expo/vector-icons';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDayStatus(dayIndex, isDone, isSkipped) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const dayDate = new Date(startOfWeek);
  dayDate.setDate(startOfWeek.getDate() + dayIndex);

  if (isSkipped) return 'skipped';
  if (dayIndex === 0) return isDone ? 'done' : 'extra';
  if (isDone) return 'done';
  if (dayDate.getTime() === today.getTime()) return 'today';
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

// ─── CheckinCalendarModal ──────────────────────────────────────────────────────

function CheckinCalendarModal({ visible, onClose, streak, totalWorkouts, monthCheckins, allCheckinDates }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const isCurrentMonth =
    viewMonth.year === today.getFullYear() && viewMonth.month === today.getMonth();

  const daysInMonth = getDaysInMonth(viewMonth.year, viewMonth.month);
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();

  // Filtra check-ins do mês visível
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
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Título */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Check-in de Treinos</Text>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn} activeOpacity={0.7}>
              <Feather name="x" size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          {/* Stats resumo */}
          <View style={styles.sheetStats}>
            <View style={styles.sheetStatItem}>
              <Text style={[styles.sheetStatVal, { color: colors.accent }]}>{streak}</Text>
              <Text style={styles.sheetStatLabel}>🔥 Sequência</Text>
            </View>
            <View style={styles.sheetStatDivider} />
            <View style={styles.sheetStatItem}>
              <Text style={[styles.sheetStatVal, { color: colors.blue }]}>{monthTotal}</Text>
              <Text style={styles.sheetStatLabel}>📅 Treinos no mês</Text>
            </View>
            <View style={styles.sheetStatDivider} />
            <View style={styles.sheetStatItem}>
              <Text style={[styles.sheetStatVal, { color: colors.amber }]}>{totalWorkouts}</Text>
              <Text style={styles.sheetStatLabel}>💪 Total geral</Text>
            </View>
          </View>

          {/* Navegação do mês */}
          <View style={styles.calNavRow}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.calNavBtn} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color={colors.textDim} />
            </TouchableOpacity>
            <Text style={styles.calNavTitle}>
              {getMonthName(viewMonth.month)} {viewMonth.year}
            </Text>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              style={styles.calNavBtn}
              activeOpacity={0.7}
              disabled={isCurrentMonth}
            >
              <Feather
                name="chevron-right"
                size={18}
                color={isCurrentMonth ? colors.textFaint : colors.textDim}
              />
            </TouchableOpacity>
          </View>

          {/* Dias da semana */}
          <View style={styles.calWeekRow}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((l) => (
              <Text key={l} style={styles.calWeekLbl}>{l}</Text>
            ))}
          </View>

          {/* Grade do calendário */}
          <View style={styles.calGrid}>
            {calendarCells.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={styles.calCell} />;
              const isToday = isCurrentMonth && day === today.getDate();
              const trained = visibleCheckins.has(day);
              return (
                <View
                  key={day}
                  style={[
                    styles.calCell,
                    trained && styles.calCellDone,
                    isToday && !trained && styles.calCellToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.calDayNum,
                      trained && styles.calDayNumDone,
                      isToday && !trained && { color: colors.accent },
                    ]}
                  >
                    {day}
                  </Text>
                  {trained && (
                    <Feather name="check" size={9} color="#08120C" style={{ marginTop: 1 }} />
                  )}
                </View>
              );
            })}
          </View>

          {/* Resumo do mês */}
          <LinearGradient
            colors={['rgba(47,230,160,0.14)', 'rgba(47,230,160,0.06)']}
            style={styles.summaryCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: colors.accent }]}>{monthTotal}</Text>
                <Text style={styles.summaryLbl}>dias treinados</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: colors.amber }]}>{consistency}%</Text>
                <Text style={styles.summaryLbl}>consistência</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryVal, { color: colors.blue }]}>
                  {daysInMonth - monthTotal}
                </Text>
                <Text style={styles.summaryLbl}>dias de descanso</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { session } = useAuth();
  const [recentLogs, setRecentLogs] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [weekDays, setWeekDays] = useState([
    {done:false,skipped:false},{done:false,skipped:false},{done:false,skipped:false},
    {done:false,skipped:false},{done:false,skipped:false},{done:false,skipped:false},{done:false,skipped:false},
  ]);
  const [hasParq, setHasParq] = useState(true);
  const [financeStatus, setFinanceStatus] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [allCheckinDates, setAllCheckinDates] = useState([]);

  const loadData = useCallback(async () => {
    const userId = session.user.id;

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .single();
    if (profileRow) {
      setProfileName(profileRow.name);
      setAvatarUrl(profileRow.avatar_url);
    }

    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id, started_at, finished_at, skipped, skip_reason, workouts(name)')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);
    setRecentLogs(logs || []);

    const { data: allDone } = await supabase
      .from('workout_logs')
      .select('started_at')
      .eq('user_id', userId)
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

    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const days = Array.from({length:7},()=>({done:false,skipped:false}));
    doneLogs.forEach((log) => {
      const d = new Date(log.started_at);
      if (d >= startOfWeek) days[d.getDay()].done = true;
    });
    const { data: skippedLogs } = await supabase
      .from('workout_logs')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', startOfWeek.toISOString())
      .eq('skipped', true);
    (skippedLogs || []).forEach((log) => {
      const d = new Date(log.started_at);
      const dayIdx = d.getDay();
      if (!days[dayIdx].done) days[dayIdx].skipped = true;
    });
    setWeekDays(days);

    const { data: parq } = await supabase
      .from('parq_responses')
      .select('id')
      .eq('student_id', userId)
      .limit(1)
      .maybeSingle();
    setHasParq(!!parq);

    const { data: acc } = await supabase
      .from('profiles')
      .select('access_expires_at, access_blocked')
      .eq('id', userId)
      .single();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { data: payments } = await supabase
      .from('payments')
      .select('status, reference_month')
      .eq('cliente_id', userId);
    const emDia = (payments || []).some(
      (p) => p.status === 'confirmado' && (p.reference_month || '').startsWith(currentMonthKey)
    );
    const bloqueado =
      acc?.access_blocked || (acc?.access_expires_at && new Date(acc.access_expires_at) < now);
    setFinanceStatus({ emDia, bloqueado });

    const { count: unread } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setUnreadCount(unread || 0);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const showFinanceNotice = financeStatus && (!financeStatus.emDia || financeStatus.bloqueado);

  const ACTIONS = [
    { key: 'chat', icon: 'message-circle', label: 'Falar com personal', onPress: () => navigation.navigate('TalkToPersonal') },
    { key: 'desafios', icon: 'award', label: 'Desafios', onPress: () => navigation.navigate('StudentChallenge') },
    { key: 'faturas', icon: 'credit-card', label: 'Faturas', onPress: () => navigation.navigate('Faturas') },
    { key: 'parq', icon: 'file-text', label: 'Saúde (PAR-Q)', onPress: () => navigation.navigate('Parq') },
  ];

  // Check-ins do mês atual (para exibição no resumo do card)
  const now = new Date();
  const monthCheckins = new Set(
    allCheckinDates
      .filter((d) => {
        const date = new Date(d);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      })
      .map((d) => new Date(d).getDate())
  );
  const monthTotal = monthCheckins.size;
  const daysInCurrentMonth = getDaysInMonth(now.getFullYear(), now.getMonth());
  const consistencyPct =
    daysInCurrentMonth > 0 ? Math.round((monthTotal / daysInCurrentMonth) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* ── Modal de Calendário ── */}
      <CheckinCalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        streak={streak}
        totalWorkouts={totalWorkouts}
        monthCheckins={monthCheckins}
        allCheckinDates={allCheckinDates}
      />

      <FlatList
        data={recentLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <>
            {/* ── Header ── */}
            <View style={styles.header}>
              <Avatar uri={avatarUrl} size={48} ringColor={colors.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.eyebrow}>BEM-VINDO DE VOLTA</Text>
                <Text style={styles.greeting}>Olá, {profileName || 'atleta'} 👋</Text>
              </View>
              <TouchableOpacity
                style={styles.bell}
                onPress={() => navigation.navigate('NotificationsScreen')}
                activeOpacity={0.7}
              >
                <Feather name="bell" size={18} color={colors.textDim} />
                {unreadCount > 0 && <View style={styles.bellDot} />}
              </TouchableOpacity>
            </View>

            {/* ── Stats hero — AGORA CLICÁVEL ── */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setCalendarVisible(true)}
            >
              <View style={styles.statsCard}>
                {/* Badge de toque */}
                <View style={styles.calBadge}>
                  <Feather name="calendar" size={10} color={colors.accent} />
                  <Text style={styles.calBadgeText}>Ver calendário</Text>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBlock}>
                    <View style={styles.statIcon}>
                      <Text style={styles.statIconEmoji}>🔥</Text>
                    </View>
                    <View>
                      <Text style={styles.statNumber}>{streak}</Text>
                      <Text style={styles.statLabel}>dia{streak === 1 ? '' : 's'} seguidos</Text>
                    </View>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBlock}>
                    <View style={styles.statIcon}>
                      <Text style={styles.statIconEmoji}>💪</Text>
                    </View>
                    <View>
                      <Text style={styles.statNumber}>{totalWorkouts}</Text>
                      <Text style={styles.statLabel}>treinos no total</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.weekTrack}>
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, i) => {
                    const dayInfo = weekDays[i] || { done: false, skipped: false };
                    const status = getDayStatus(i, dayInfo.done, dayInfo.skipped);
                    const isDone = status === 'done';
                    const isSkipped = status === 'skipped';
                    const isToday = status === 'today';
                    const dotStyle = isDone
                      ? styles.weekDotDone
                      : isSkipped
                      ? styles.weekDotSkipped
                      : isToday
                      ? styles.weekDotToday
                      : status === 'extra'
                      ? styles.weekDotExtra
                      : null;
                    return (
                      <View key={i} style={styles.weekDay}>
                        <View style={[styles.weekDot, dotStyle]}>
                          {isDone && <Feather name="check" size={12} color="#08120C" />}
                          {isSkipped && <Text style={{ fontSize: 10 }}>❌</Text>}
                          {!isDone && !isSkipped && isToday && (
                            <View style={styles.weekDotInnerToday} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.weekDayLabel,
                            isDone && styles.weekDayLabelDone,
                            isSkipped && styles.weekDayLabelSkipped,
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Resumo do mês atual */}
                <View style={styles.monthSummaryRow}>
                  <View style={styles.monthSummaryItem}>
                    <Text style={[styles.monthSummaryVal, { color: colors.accent }]}>
                      {monthTotal}
                    </Text>
                    <Text style={styles.monthSummaryLbl}>treinos em {getMonthName(now.getMonth()).slice(0,3)}</Text>
                  </View>
                  <View style={styles.monthSummaryDivider} />
                  <View style={styles.monthSummaryItem}>
                    <Text style={[styles.monthSummaryVal, { color: colors.amber }]}>
                      {consistencyPct}%
                    </Text>
                    <Text style={styles.monthSummaryLbl}>consistência</Text>
                  </View>
                  <View style={styles.monthSummaryDivider} />
                  <View style={styles.monthSummaryItem}>
                    <Text style={styles.monthSummaryHint}>Toque para ver{'\n'}o calendário</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* ── Notices ── */}
            {(showFinanceNotice || !hasParq) && (
              <View style={styles.notices}>
                {showFinanceNotice && (
                  <TouchableOpacity
                    style={[styles.notice, styles.noticeAmber]}
                    onPress={() => navigation.navigate('Faturas')}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.noticeIcon, styles.noticeIconAmber]}>
                      <Feather name="credit-card" size={16} color={colors.amber} />
                    </View>
                    <View style={styles.noticeInfo}>
                      <Text style={[styles.noticeTitle, { color: colors.amber }]}>
                        {financeStatus.bloqueado ? 'Acesso bloqueado' : 'Mensalidade pendente'}
                      </Text>
                      <Text style={styles.noticeSub}>Ver faturas e histórico de pagamentos</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textDim2} />
                  </TouchableOpacity>
                )}
                {!hasParq && (
                  <TouchableOpacity
                    style={[styles.notice, styles.noticeBlue]}
                    onPress={() => navigation.navigate('Parq')}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.noticeIcon, styles.noticeIconBlue]}>
                      <Feather name="file-text" size={16} color={colors.blue} />
                    </View>
                    <View style={styles.noticeInfo}>
                      <Text style={[styles.noticeTitle, { color: colors.blue }]}>
                        Responda seu questionário de saúde
                      </Text>
                      <Text style={styles.noticeSub}>Leva 1 minuto e é importante antes de treinar</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textDim2} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Acesso rápido ── */}
            <Text style={styles.sectionLabel}>ACESSO RÁPIDO</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.featuredTile}
                onPress={() => navigation.navigate('Workouts')}
                activeOpacity={0.85}
              >
                <View style={styles.featuredLeft}>
                  <View style={styles.featuredIcon}>
                    <Feather name="zap" size={19} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={styles.featuredLabel}>Treinos</Text>
                    <Text style={styles.featuredSub}>Ver seu plano da semana</Text>
                  </View>
                </View>
                <View style={styles.featuredArrow}>
                  <Feather name="chevron-right" size={15} color="#08120C" />
                </View>
              </TouchableOpacity>

              {/* Evolução tile — NOVO */}
              <TouchableOpacity
                style={styles.evolutionTile}
                onPress={() => navigation.navigate('StudentEvolution')}
                activeOpacity={0.85}
              >
                <View style={styles.evolutionLeft}>
                  <View style={styles.evolutionIcon}>
                    <Feather name="trending-up" size={19} color={colors.blue} />
                  </View>
                  <View>
                    <Text style={styles.evolutionLabel}>Evolução</Text>
                    <Text style={styles.evolutionSub}>Dashboard de progresso</Text>
                  </View>
                </View>
                <View style={styles.evolutionArrow}>
                  <Feather name="chevron-right" size={15} color={colors.blue} />
                </View>
              </TouchableOpacity>

              {/* Meus Feedbacks tile */}
              <TouchableOpacity
                style={styles.feedbacksTile}
                onPress={() => navigation.navigate('WorkoutFeedbackHistory')}
                activeOpacity={0.85}
              >
                <View style={styles.feedbacksLeft}>
                  <View style={styles.feedbacksIcon}>
                    <Feather name="message-square" size={19} color="#c084fc" />
                  </View>
                  <View>
                    <Text style={styles.feedbacksLabel}>Meus Feedbacks</Text>
                    <Text style={styles.feedbacksSub}>Histórico de comentários</Text>
                  </View>
                </View>
                <View style={styles.feedbacksArrow}>
                  <Feather name="chevron-right" size={15} color="#c084fc" />
                </View>
              </TouchableOpacity>

              <View style={styles.actionsRow}>
                {ACTIONS.slice(0, 2).map((a) => (
                  <TouchableOpacity key={a.key} style={styles.actionTile} onPress={a.onPress} activeOpacity={0.85}>
                    <View style={styles.actionIcon}>
                      <Feather name={a.icon} size={17} color={colors.accent} />
                    </View>
                    <Text style={styles.actionLabel}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.actionsRow}>
                {ACTIONS.slice(2, 4).map((a) => (
                  <TouchableOpacity key={a.key} style={styles.actionTile} onPress={a.onPress} activeOpacity={0.85}>
                    <View style={styles.actionIcon}>
                      <Feather name={a.icon} size={17} color={colors.accent} />
                    </View>
                    <Text style={styles.actionLabel}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 22 }]}>ÚLTIMOS TREINOS</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Você ainda não registrou nenhum treino. Vá até a aba "Treinos" para começar!
          </Text>
        }
        renderItem={({ item }) => {
          const status = item.skipped ? 'skipped' : item.finished_at ? 'done' : 'pending';
          return (
            <View style={styles.workoutItem}>
              <View style={styles.workoutIcon}>
                <Feather name="zap" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutName}>{item.workouts?.name || 'Treino'}</Text>
                <Text style={styles.workoutDate}>
                  {new Date(item.started_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(item.started_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {item.skipped && item.skip_reason ? (
                  <Text style={styles.workoutReason}>Motivo: {item.skip_reason}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusPill,
                  status === 'done' && styles.statusPillDone,
                  status === 'skipped' && styles.statusPillSkipped,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    status === 'done' && styles.statusPillTextDone,
                    status === 'skipped' && styles.statusPillTextSkipped,
                  ]}
                >
                  {status === 'done' ? '✅ Concluído' : status === 'pending' ? 'Em andamento' : '❌ Não treinou'}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: s(18),
    paddingTop: screenPaddingTop,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(18) },
  eyebrow: {
    color: colors.textDim2,
    fontSize: fs(9),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  greeting: { color: colors.text, fontSize: fs(16), fontWeight: '700', marginTop: vs(2) },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },

  // Stats card
  statsCard: {
    borderRadius: 22,
    padding: s(20),
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accentGlow,
  },
  calBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(47,230,160,0.12)',
    borderRadius: 20,
    paddingHorizontal: s(8),
    paddingVertical: vs(3),
    marginBottom: vs(10),
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
  },
  calBadgeText: {
    color: colors.accent,
    fontSize: fs(9),
    fontWeight: '700',
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconEmoji: { fontSize: fs(17) },
  statNumber: { color: colors.text, fontSize: fs(20), fontWeight: '800', lineHeight: 24 },
  statLabel: { color: colors.textDim, fontSize: fs(9), marginTop: vs(2) },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 14,
  },

  weekTrack: { flexDirection: 'row', justifyContent: 'space-between', marginTop: vs(18) },
  weekDay: { alignItems: 'center', gap: 6 },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekDotToday: { borderColor: colors.accent, borderWidth: 1.5 },
  weekDotExtra: { borderColor: colors.amber },
  weekDotSkipped: { backgroundColor: 'rgba(255,100,180,0.15)', borderColor: '#FF64B4' },
  weekDotInnerToday: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  weekDayLabel: { color: colors.textDim2, fontSize: fs(9), fontWeight: '600' },
  weekDayLabelDone: { color: colors.accent },
  weekDayLabelSkipped: { color: '#FF64B4' },

  // Resumo do mês (dentro do statsCard)
  monthSummaryRow: {
    flexDirection: 'row',
    marginTop: vs(16),
    paddingTop: vs(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  monthSummaryItem: { flex: 1, alignItems: 'center' },
  monthSummaryVal: { fontSize: fs(16), fontWeight: '800' },
  monthSummaryLbl: { color: colors.textDim, fontSize: fs(8.5), marginTop: vs(2), textAlign: 'center' },
  monthSummaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  monthSummaryHint: {
    color: colors.textFaint,
    fontSize: fs(8.5),
    textAlign: 'center',
    lineHeight: fs(13),
  },

  // Notices
  notices: { marginTop: vs(14), gap: 10 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  noticeAmber: { backgroundColor: colors.amberGlow, borderColor: 'rgba(253,180,78,.3)' },
  noticeBlue: { backgroundColor: colors.blueGlow, borderColor: 'rgba(91,155,255,.3)' },
  noticeIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  noticeIconAmber: { backgroundColor: 'rgba(253,180,78,.18)' },
  noticeIconBlue: { backgroundColor: 'rgba(91,155,255,.18)' },
  noticeInfo: { flex: 1 },
  noticeTitle: { fontSize: fs(11.5), fontWeight: '700' },
  noticeSub: { color: colors.textDim, fontSize: fs(9), marginTop: vs(2) },

  // Acesso rápido
  sectionLabel: {
    color: colors.textDim,
    fontSize: fs(10.5),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: vs(22),
    marginBottom: vs(10),
  },
  actionsGrid: { gap: 10 },
  featuredTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(51,226,139,.35)',
    borderRadius: 18,
    padding: 16,
  },
  featuredLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featuredIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(51,226,139,.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredLabel: { color: colors.text, fontSize: fs(13), fontWeight: '700' },
  featuredSub: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(2) },
  featuredArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Evolução tile
  evolutionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.blueGlow,
    borderWidth: 1,
    borderColor: 'rgba(79,168,255,.35)',
    borderRadius: 18,
    padding: 16,
  },
  evolutionLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  evolutionIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(79,168,255,.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evolutionLabel: { color: colors.text, fontSize: fs(13), fontWeight: '700' },
  evolutionSub: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(2) },
  evolutionArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(79,168,255,.16)',
    borderWidth: 1,
    borderColor: 'rgba(79,168,255,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Feedbacks tile
  feedbacksTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.35)',
    borderRadius: 18,
    padding: 16,
  },
  feedbacksLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  feedbacksIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: 'rgba(192,132,252,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbacksLabel: { color: colors.text, fontSize: fs(13), fontWeight: '700' },
  feedbacksSub: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(2) },
  feedbacksArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(192,132,252,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.text, fontSize: fs(11.5), fontWeight: '700' },

  // Empty
  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: vs(40),
    fontSize: fs(12),
    lineHeight: 20,
  },

  // Workout items
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: vs(10),
  },
  workoutIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutName: { color: colors.text, fontSize: fs(11.5), fontWeight: '700' },
  workoutDate: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(2) },
  workoutReason: { color: colors.textDim, fontSize: fs(9), marginTop: vs(2), fontStyle: 'italic' },

  statusPill: {
    fontSize: fs(9),
    paddingHorizontal: s(10),
    paddingVertical: vs(6),
    borderRadius: 100,
    backgroundColor: colors.amberGlow,
    borderWidth: 1,
    borderColor: 'rgba(253,180,78,.3)',
  },
  statusPillDone: { backgroundColor: colors.accentGlow, borderColor: 'rgba(51,226,139,.3)' },
  statusPillSkipped: {
    backgroundColor: 'rgba(255,100,180,0.15)',
    borderColor: 'rgba(255,100,180,0.35)',
  },
  statusPillText: { fontSize: fs(9), fontWeight: '700', color: colors.amber },
  statusPillTextDone: { color: colors.accent },
  statusPillTextSkipped: { color: '#FF64B4', fontWeight: '700' },

  // ── Modal / Sheet ──────────────────────────────────────────────────────────
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

  // Stats no sheet
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

  // Nav do mês no sheet
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

  // Grade do calendário no sheet
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

  // Summary card no sheet
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
    padding: s(16),
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
