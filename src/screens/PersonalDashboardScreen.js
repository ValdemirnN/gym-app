import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function PersonalDashboardScreen({ navigation }) {
  const { session, profile } = useAuth();
  const [stats, setStats] = useState({
    total: 0, ativos: 0, pendentes: 0,
    treinosSemana: 0, consistencia: 0, metaTreinos: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: clientsRaw } = await supabase
      .from('profiles')
      .select('id, name, status, avatar_url, is_excluded')
      .eq('personal_id', session.user.id);

    const clients = (clientsRaw || []).filter((c) => !c.is_excluded);
    const total = clients?.length || 0;
    const ativos = clients?.filter((c) => c.status === 'aprovado').length || 0;
    const pendentes = clients?.filter((c) => c.status === 'pendente').length || 0;

    let treinosSemana = 0;
    const clientIds = (clients || []).map((c) => c.id);
    const nameById = Object.fromEntries((clients || []).map((c) => [c.id, c.name]));
    const avatarById = Object.fromEntries((clients || []).map((c) => [c.id, c.avatar_url]));

    if (clientIds.length > 0) {
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      const { count } = await supabase
        .from('workout_logs')
        .select('id', { count: 'exact', head: true })
        .in('user_id', clientIds)
        .gte('started_at', seteDiasAtras.toISOString())
        .not('finished_at', 'is', null)
        .is('skipped', false);
      treinosSemana = count || 0;

      const { data: recentLogs } = await supabase
        .from('workout_logs')
        .select('id, started_at, finished_at, skipped, skip_reason, user_id, workouts(name)')
        .in('user_id', clientIds)
        .order('started_at', { ascending: false })
        .limit(5);
      setRecent(
        (recentLogs || []).map((log) => ({
          ...log,
          studentName: nameById[log.user_id] || 'Aluno',
          studentAvatar: avatarById[log.user_id] || null,
        }))
      );
    } else {
      setRecent([]);
    }

    let metaTreinos = 0;
    const activeIds = (clients || []).filter((c) => c.status === 'aprovado').map((c) => c.id);
    if (activeIds.length > 0) {
      const { count: workoutsCount } = await supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .in('user_id', activeIds);
      metaTreinos = workoutsCount || 0;
    }
    let percentual = 0;
    if (metaTreinos > 0) {
      percentual = Math.min(Math.round((treinosSemana / metaTreinos) * 100), 100);
    }

    const { count: unread } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    setUnreadCount(unread || 0);

    setStats({ total, ativos, pendentes, treinosSemana, consistencia: percentual, metaTreinos });
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const goToLog = (log) => {
    navigation.navigate('PersonalStudents', {
      screen: 'StudentWorkoutLogDetail',
      params: { logId: log.id, studentName: log.studentName, workoutName: log.workouts?.name },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.greetingRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Avatar uri={profile?.avatar_url} size={s(isSmallDevice ? 44 : 52)} />
          <View style={{ marginLeft: s(12), flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              Olá, {profile?.name || 'treinador'} 👋
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.bellIconContainer}
          onPress={() => navigation.navigate('NotificationsScreen')}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={s(isSmallDevice ? 20 : 24)} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeCount}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>Aqui está o resumo da sua carteira de alunos</Text>

      {/* Grid de estatísticas */}
      <View style={styles.grid}>
        <View style={[styles.card, styles.cardGreen]}>
          <Text style={styles.cardValue}>{stats.total}</Text>
          <Text style={styles.cardLabel}>Alunos no total</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{stats.ativos}</Text>
          <Text style={styles.cardLabel}>Ativos</Text>
        </View>
        <View style={[styles.card, stats.pendentes > 0 && styles.cardAlert]}>
          <Text style={styles.cardValue}>{stats.pendentes}</Text>
          <Text style={styles.cardLabel}>Pendentes de pagamento</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{stats.treinosSemana}</Text>
          <Text style={styles.cardLabel}>Treinos nos últimos 7 dias</Text>
        </View>
      </View>

      {/* Card de consistência */}
      <View style={styles.consistencyCard}>
        <View style={styles.consistencyCircle}>
          <Text style={styles.consistencyPercentage}>{stats.consistencia}%</Text>
        </View>
        <View style={styles.consistencyTextContainer}>
          <Text style={styles.consistencyTitle}>Consistência semanal</Text>
          <Text style={styles.consistencyDesc}>
            {stats.treinosSemana} de {stats.metaTreinos} treinos previstos foram concluídos essa semana.
          </Text>
        </View>
      </View>

      {/* Aviso de pendentes */}
      {stats.pendentes > 0 && (
        <View style={styles.tip}>
          <Feather name="alert-triangle" size={s(14)} color={colors.amber} />
          <Text style={styles.tipText}>
            {' '}Você tem {stats.pendentes} aluno{stats.pendentes > 1 ? 's' : ''} pendente
            {stats.pendentes > 1 ? 's' : ''} de pagamento. Vá até a aba "Alunos" para revisar.
          </Text>
        </View>
      )}

      {/* Ações rápidas */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('PersonalStudents')}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionIcon}>
            <Feather name="users" size={s(isSmallDevice ? 16 : 19)} color={colors.accent} />
          </View>
          <Text style={styles.quickActionText}>Ver alunos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('Challenges')}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionIcon}>
            <Feather name="award" size={s(isSmallDevice ? 16 : 19)} color={colors.accent} />
          </View>
          <Text style={styles.quickActionText}>Desafios</Text>
        </TouchableOpacity>
      </View>

      {/* Atividade recente */}
      <Text style={styles.sectionTitle}>Atividade recente</Text>
      <Text style={styles.subtitle2}>Toque em um treino para ver o detalhamento completo</Text>

      {recent.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Nenhum treino registrado pelos seus alunos ainda. Assim que alguém treinar, aparece aqui.
          </Text>
        </View>
      ) : (
        recent.map((log) => (
          <TouchableOpacity
            key={log.id}
            style={styles.activityCard}
            activeOpacity={0.8}
            onPress={() => goToLog(log)}
          >
            <Avatar uri={log.studentAvatar} size={s(isSmallDevice ? 34 : 40)} />
            <View style={{ flex: 1, marginLeft: s(12) }}>
              <Text style={styles.activityTitle}>{log.studentName}</Text>
              <Text style={styles.activitySubtitle}>
                {log.workouts?.name || 'Treino removido'} · {formatDate(log.started_at)}
              </Text>
            </View>

            {log.skipped ? (
              <View style={styles.badgeBlocked}>
                <Text style={styles.badgeTextBlocked}>Não treinou</Text>
              </View>
            ) : log.finished_at ? (
              <View style={styles.badgeDone}>
                <Text style={styles.badgeDoneText}>Concluído</Text>
              </View>
            ) : (
              <View style={styles.badgePending}>
                <Text style={styles.badgePendingText}>Em andamento</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: screenPaddingH,
    paddingTop: screenPaddingTop,
    paddingBottom: vs(40),
  },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(4),
  },

  bellIconContainer: {
    position: 'relative',
    padding: s(8),
    backgroundColor: colors.surface,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: s(18),
    height: s(18),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeCount: { color: '#FFF', fontSize: fs(9), fontWeight: 'bold' },

  greeting: { fontSize: fs(isSmallDevice ? 16 : 18), fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fs(isSmallDevice ? 12 : 14), color: colors.textDim, marginTop: vs(4), marginBottom: vs(20) },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: s(isSmallDevice ? 14 : 18),
    marginBottom: vs(12),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGreen: { borderColor: colors.accent },
  cardAlert: { borderColor: colors.amber },
  cardValue: { fontSize: fs(isSmallDevice ? 22 : 28), fontWeight: '800', color: colors.text },
  cardLabel: { fontSize: fs(isSmallDevice ? 10 : 12), color: colors.textDim, marginTop: vs(4) },

  consistencyCard: {
    flexDirection: 'row',
    backgroundColor: '#1C293A',
    borderRadius: radius.lg,
    padding: s(isSmallDevice ? 12 : 16),
    alignItems: 'center',
    marginBottom: vs(16),
    marginTop: vs(4),
  },
  consistencyCircle: {
    width: s(isSmallDevice ? 50 : 60),
    height: s(isSmallDevice ? 50 : 60),
    borderRadius: s(isSmallDevice ? 25 : 30),
    borderWidth: 4,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(14),
  },
  consistencyPercentage: { color: '#FFF', fontWeight: 'bold', fontSize: fs(isSmallDevice ? 13 : 16) },
  consistencyTextContainer: { flex: 1 },
  consistencyTitle: { color: '#FFF', fontWeight: 'bold', fontSize: fs(isSmallDevice ? 14 : 16), marginBottom: vs(4) },
  consistencyDesc: { color: '#9CA3AF', fontSize: fs(isSmallDevice ? 11 : 13), lineHeight: vs(isSmallDevice ? 16 : 18) },

  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.amberGlow,
    borderRadius: radius.sm,
    padding: s(isSmallDevice ? 12 : 16),
    marginTop: vs(6),
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },
  tipText: { color: colors.amber, fontSize: fs(isSmallDevice ? 11 : 13), lineHeight: vs(isSmallDevice ? 17 : 19), flex: 1 },

  quickActionsRow: { flexDirection: 'row', marginTop: vs(20), marginBottom: vs(6), gap: s(8) },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: vs(isSmallDevice ? 12 : 16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    width: s(isSmallDevice ? 34 : 40),
    height: s(isSmallDevice ? 34 : 40),
    borderRadius: ms(12),
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(6),
  },
  quickActionText: { color: colors.text, fontSize: fs(isSmallDevice ? 11 : 13), fontWeight: '700' },

  sectionTitle: { color: colors.text, fontSize: fs(isSmallDevice ? 16 : 18), fontWeight: '800', marginTop: vs(20), marginBottom: vs(10) },
  subtitle2: { color: colors.textDim2, fontSize: fs(isSmallDevice ? 11 : 12), marginTop: vs(-6), marginBottom: vs(10) },

  emptyBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: s(16) },
  emptyText: { color: colors.textDim, fontSize: fs(isSmallDevice ? 12 : 13), lineHeight: vs(19) },

  activityCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: s(isSmallDevice ? 10 : 14),
    marginBottom: vs(8),
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityTitle: { color: colors.text, fontSize: fs(isSmallDevice ? 13 : 15), fontWeight: '700' },
  activitySubtitle: { color: colors.textDim, fontSize: fs(isSmallDevice ? 11 : 12), marginTop: vs(2) },

  badgeDone: { backgroundColor: colors.accentGlow, borderRadius: ms(6), paddingHorizontal: s(10), paddingVertical: vs(5) },
  badgeDoneText: { color: colors.accent, fontSize: fs(isSmallDevice ? 10 : 11), fontWeight: '700' },
  badgePending: { backgroundColor: colors.amberGlow, borderRadius: ms(6), paddingHorizontal: s(10), paddingVertical: vs(5) },
  badgePendingText: { color: colors.amber, fontSize: fs(isSmallDevice ? 10 : 11), fontWeight: '700' },
  badgeBlocked: { backgroundColor: colors.redGlow, borderRadius: ms(6), paddingHorizontal: s(10), paddingVertical: vs(5) },
  badgeTextBlocked: { color: colors.red, fontSize: fs(isSmallDevice ? 10 : 11), fontWeight: '700' },
});
