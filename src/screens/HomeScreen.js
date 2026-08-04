import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { Feather } from '@expo/vector-icons';

function getDayStatus(dayIndex, isDone) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const dayDate = new Date(startOfWeek);
  dayDate.setDate(startOfWeek.getDate() + dayIndex);

  if (dayIndex === 0) return isDone ? 'done' : 'extra'; // domingo = dia extra
  if (isDone) return 'done';
  if (dayDate.getTime() === today.getTime()) return 'today';
  if (dayDate.getTime() > today.getTime()) return 'upcoming';
  return 'missed';
}

export default function HomeScreen({ navigation }) {
  const { session } = useAuth();
  const [recentLogs, setRecentLogs] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [weekDays, setWeekDays] = useState([false, false, false, false, false, false, false]); // dom..sáb
  const [hasParq, setHasParq] = useState(true); // true por padrão pra não piscar o aviso à toa
  const [financeStatus, setFinanceStatus] = useState(null); // { emDia, bloqueado }

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

    // Sequência de dias treinados seguidos (streak) + total de treinos concluídos
    const { data: allDone } = await supabase
      .from('workout_logs')
      .select('started_at')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .is('skipped', false)
      .order('started_at', { ascending: false });

    setTotalWorkouts((allDone || []).length);

    const doneDates = new Set((allDone || []).map((l) => new Date(l.started_at).toDateString()));
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
    const days = [false, false, false, false, false, false, false];
    (allDone || []).forEach((log) => {
      const d = new Date(log.started_at);
      if (d >= startOfWeek) days[d.getDay()] = true;
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
    const emDia = (payments || []).some((p) => p.status === 'confirmado' && (p.reference_month || '').startsWith(currentMonthKey));
    const bloqueado = acc?.access_blocked || (acc?.access_expires_at && new Date(acc.access_expires_at) < now);
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

  return (
    <View style={styles.container}>
      <FlatList
        data={recentLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <>
            {/* ---------- Header ---------- */}
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

            {/* ---------- Stats hero (streak + total + semana) ---------- */}
            <View style={styles.statsCard}>
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
                  const status = getDayStatus(i, weekDays[i]);
                  const isDone = status === 'done';
                  const isToday = status === 'today';
                  return (
                    <View key={i} style={styles.weekDay}>
                      <View
                        style={[
                          styles.weekDot,
                          isDone && styles.weekDotDone,
                          isToday && styles.weekDotToday,
                          status === 'extra' && styles.weekDotExtra,
                        ]}
                      >
                        {isDone && <Feather name="check" size={12} color="#08120C" />}
                      </View>
                      <Text style={[styles.weekDayLabel, isDone && styles.weekDayLabelDone]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ---------- Notices ---------- */}
            {(showFinanceNotice || !hasParq) && (
              <View style={styles.notices}>
                {showFinanceNotice && (
                  <TouchableOpacity style={[styles.notice, styles.noticeAmber]} onPress={() => navigation.navigate('Faturas')} activeOpacity={0.85}>
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
                  <TouchableOpacity style={[styles.notice, styles.noticeBlue]} onPress={() => navigation.navigate('Parq')} activeOpacity={0.85}>
                    <View style={[styles.noticeIcon, styles.noticeIconBlue]}>
                      <Feather name="file-text" size={16} color={colors.blue} />
                    </View>
                    <View style={styles.noticeInfo}>
                      <Text style={[styles.noticeTitle, { color: colors.blue }]}>Responda seu questionário de saúde</Text>
                      <Text style={styles.noticeSub}>Leva 1 minuto e é importante antes de treinar</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textDim2} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ---------- Acesso rápido ---------- */}
            <Text style={styles.sectionLabel}>ACESSO RÁPIDO</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.featuredTile} onPress={() => navigation.navigate('Workouts')} activeOpacity={0.85}>
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
          <Text style={styles.empty}>Você ainda não registrou nenhum treino. Vá até a aba "Treinos" para começar!</Text>
        }
        renderItem={({ item }) => {
          const status = item.skipped ? 'blocked' : item.finished_at ? 'done' : 'pending';
          return (
            <View style={styles.workoutItem}>
              <View style={styles.workoutIcon}>
                <Feather name="zap" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutName}>{item.workouts?.name || 'Treino'}</Text>
                <Text style={styles.workoutDate}>
                  {new Date(item.started_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(item.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.skipped && item.skip_reason ? (
                  <Text style={styles.workoutReason}>Motivo: {item.skip_reason}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusPill,
                  status === 'done' && styles.statusPillDone,
                  status === 'blocked' && styles.statusPillBlocked,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    status === 'done' && styles.statusPillTextDone,
                    status === 'blocked' && styles.statusPillTextBlocked,
                  ]}
                >
                  {status === 'done' ? 'Concluído' : status === 'pending' ? 'Em andamento' : 'Não treinou'}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18, paddingTop: 56 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  eyebrow: { color: colors.textDim2, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  greeting: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
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

  // Stats hero
  statsCard: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accentGlow,
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
  statIconEmoji: { fontSize: 19 },
  statNumber: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 24 },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 14 },

  weekTrack: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
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
  weekDayLabel: { color: colors.textDim2, fontSize: 9.5, fontWeight: '600' },
  weekDayLabelDone: { color: colors.accent },

  // Notices
  notices: { marginTop: 14, gap: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, borderWidth: 1 },
  noticeAmber: { backgroundColor: colors.amberGlow, borderColor: 'rgba(253,180,78,.3)' },
  noticeBlue: { backgroundColor: colors.blueGlow, borderColor: 'rgba(91,155,255,.3)' },
  noticeIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  noticeIconAmber: { backgroundColor: 'rgba(253,180,78,.18)' },
  noticeIconBlue: { backgroundColor: 'rgba(91,155,255,.18)' },
  noticeInfo: { flex: 1 },
  noticeTitle: { fontSize: 13.5, fontWeight: '700' },
  noticeSub: { color: colors.textDim, fontSize: 11, marginTop: 2 },

  // Acesso rápido
  sectionLabel: {
    color: colors.textDim,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
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
  featuredLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  featuredSub: { color: colors.textDim2, fontSize: 11, marginTop: 2 },
  featuredArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
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
  actionLabel: { color: colors.text, fontSize: 13.5, fontWeight: '700' },

  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20 },

  // Últimos treinos
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: 10,
  },
  workoutIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutName: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  workoutDate: { color: colors.textDim2, fontSize: 11, marginTop: 2 },
  workoutReason: { color: colors.textDim, fontSize: 11, marginTop: 2, fontStyle: 'italic' },

  statusPill: {
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: colors.amberGlow,
    borderWidth: 1,
    borderColor: 'rgba(253,180,78,.3)',
  },
  statusPillDone: { backgroundColor: colors.accentGlow, borderColor: 'rgba(51,226,139,.3)' },
  statusPillBlocked: { backgroundColor: colors.redGlow, borderColor: 'rgba(251,100,103,.3)' },
  statusPillText: { fontSize: 10, fontWeight: '700', color: colors.amber },
  statusPillTextDone: { color: colors.accent },
  statusPillTextBlocked: { color: colors.red },
});
