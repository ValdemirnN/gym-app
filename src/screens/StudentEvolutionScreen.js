import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/theme';
import { s, vs, fs, screenPaddingTop } from '../utils/responsive';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthName(monthIndex) {
  const months = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ];
  return months[monthIndex];
}

// Retorna os 7 últimos dias como array de { label, dayOfWeek, date, trained }
function buildLastSevenDays(trainedDates) {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const labels = ['D','S','T','Q','Q','S','S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toDateString();
    result.push({
      label: labels[d.getDay()],
      isToday: i === 0,
      trained: trainedDates.has(dateStr),
      dayNum: d.getDate(),
    });
  }
  return result;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ icon, emoji, value, label, sublabel, accentColor }) {
  const accent = accentColor || colors.accent;
  return (
    <View style={[styles.metricCard, { borderColor: `${accent}30` }]}>
      <LinearGradient
        colors={[`${accent}18`, 'transparent']}
        style={styles.metricGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.metricIconWrap, { backgroundColor: `${accent}22` }]}>
        {emoji ? (
          <Text style={{ fontSize: fs(18) }}>{emoji}</Text>
        ) : (
          <Feather name={icon} size={18} color={accent} />
        )}
      </View>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sublabel ? <Text style={styles.metricSublabel}>{sublabel}</Text> : null}
    </View>
  );
}

function ConsistencyBar({ day }) {
  return (
    <View style={styles.consistencyItem}>
      <View
        style={[
          styles.consistencyBar,
          {
            backgroundColor: day.trained
              ? colors.accent
              : day.isToday
              ? `${colors.accent}40`
              : colors.surface3,
            height: day.trained ? vs(44) : day.isToday ? vs(28) : vs(20),
            borderWidth: day.isToday && !day.trained ? 1 : 0,
            borderColor: colors.accent,
          },
        ]}
      />
      <Text
        style={[
          styles.consistencyDayLabel,
          day.trained && { color: colors.accent },
          day.isToday && !day.trained && { color: colors.accent },
        ]}
      >
        {day.label}
      </Text>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function StudentEvolutionScreen({ navigation }) {
  const { session } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [monthWorkouts, setMonthWorkouts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [avgPerWeek, setAvgPerWeek] = useState(0);
  const [lastSevenDays, setLastSevenDays] = useState([]);
  const [monthCheckins, setMonthCheckins] = useState(new Set());
  const [totalMinutes, setTotalMinutes] = useState(0);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const loadData = useCallback(async () => {
    const userId = session.user.id;

    // Busca todos os treinos concluídos
    const { data: allDone } = await supabase
      .from('workout_logs')
      .select('started_at, finished_at')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .eq('skipped', false)
      .order('started_at', { ascending: false });

    const logs = allDone || [];
    setTotalWorkouts(logs.length);

    // Datas treinadas como Set de dateString
    const trainedDates = new Set(logs.map((l) => new Date(l.started_at).toDateString()));

    // Treinos do mês selecionado
    const { year, month } = selectedMonth;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const monthLogs = logs.filter((l) => {
      const d = new Date(l.started_at);
      return d >= monthStart && d <= monthEnd;
    });
    setMonthWorkouts(monthLogs.length);

    // Dias check-in do mês (para calendário externo se necessário)
    const checkinDays = new Set(
      monthLogs.map((l) => new Date(l.started_at).getDate())
    );
    setMonthCheckins(checkinDays);

    // Streak atual
    let streakCount = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!trainedDates.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (trainedDates.has(cursor.toDateString())) {
      streakCount++;
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreak(streakCount);

    // Maior streak histórico
    let maxStreak = 0;
    let tempStreak = 0;
    const sortedDates = [...trainedDates]
      .map((d) => new Date(d))
      .sort((a, b) => a - b);
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const diff = (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
        tempStreak = diff === 1 ? tempStreak + 1 : 1;
      }
      if (tempStreak > maxStreak) maxStreak = tempStreak;
    }
    setLongestStreak(maxStreak);

    // Média por semana (últimas 4 semanas)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const recentLogs = logs.filter((l) => new Date(l.started_at) >= fourWeeksAgo);
    setAvgPerWeek(Math.round((recentLogs.length / 4) * 10) / 10);

    // Últimos 7 dias
    setLastSevenDays(buildLastSevenDays(trainedDates));

    // Total de minutos treinados
    let minutes = 0;
    logs.forEach((l) => {
      if (l.finished_at && l.started_at) {
        const diff = (new Date(l.finished_at) - new Date(l.started_at)) / 60000;
        if (diff > 0 && diff < 300) minutes += diff; // ignora outliers
      }
    });
    setTotalMinutes(Math.round(minutes));
  }, [session, selectedMonth]);

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

  const changeMonth = (delta) => {
    setSelectedMonth((prev) => {
      let newMonth = prev.month + delta;
      let newYear = prev.year;
      if (newMonth < 0) { newMonth = 11; newYear--; }
      if (newMonth > 11) { newMonth = 0; newYear++; }
      return { year: newYear, month: newMonth };
    });
  };

  const today = new Date();
  const isCurrentMonth =
    selectedMonth.year === today.getFullYear() &&
    selectedMonth.month === today.getMonth();

  const daysInMonth = getDaysInMonth(selectedMonth.year, selectedMonth.month);
  const firstDayOfWeek = new Date(selectedMonth.year, selectedMonth.month, 1).getDay();
  const consistencyPct = daysInMonth > 0 ? Math.round((monthWorkouts / daysInMonth) * 100) : 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  // ─── Mini Calendar ─────────────────────────────────────────────────────────
  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evolução</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* ── Streak Hero ── */}
        <LinearGradient
          colors={['rgba(47,230,160,0.22)', 'rgba(47,230,160,0.06)']}
          style={styles.streakHero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.streakContent}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>
              {streak === 1 ? 'dia seguido' : 'dias seguidos'}
            </Text>
            <Text style={styles.streakSub}>
              Recorde: {longestStreak} {longestStreak === 1 ? 'dia' : 'dias'}
            </Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakRight}>
            <View style={styles.streakStat}>
              <Text style={styles.streakStatVal}>{totalWorkouts}</Text>
              <Text style={styles.streakStatLabel}>Treinos{'\n'}totais</Text>
            </View>
            <View style={styles.streakStat}>
              <Text style={styles.streakStatVal}>{avgPerWeek}</Text>
              <Text style={styles.streakStatLabel}>Média{'\n'}por semana</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Métricas rápidas ── */}
        <View style={styles.metricsRow}>
          <MetricCard
            emoji="📅"
            value={monthWorkouts}
            label="Treinos no mês"
            sublabel={`${consistencyPct}% de consistência`}
            accentColor={colors.blue}
          />
          <MetricCard
            emoji="⏱️"
            value={totalHours > 0 ? `${totalHours}h${totalMins > 0 ? ` ${totalMins}m` : ''}` : `${totalMinutes}m`}
            label="Tempo total"
            sublabel="de treino acumulado"
            accentColor={colors.amber}
          />
        </View>

        {/* ── Consistência 7 dias ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Últimos 7 dias</Text>
          <View style={styles.consistencyChart}>
            {lastSevenDays.map((day, i) => (
              <ConsistencyBar key={i} day={day} />
            ))}
          </View>
          <View style={styles.consistencyLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>Treinou</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.accent }]} />
              <Text style={styles.legendText}>Hoje</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.surface3 }]} />
              <Text style={styles.legendText}>Não treinou</Text>
            </View>
          </View>
        </View>

        {/* ── Calendário do mês ── */}
        <View style={styles.sectionCard}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.calArrowBtn} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color={colors.textDim} />
            </TouchableOpacity>
            <Text style={styles.calMonthLabel}>
              {getMonthName(selectedMonth.month)} {selectedMonth.year}
            </Text>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              style={styles.calArrowBtn}
              activeOpacity={0.7}
              disabled={isCurrentMonth}
            >
              <Feather name="chevron-right" size={18} color={isCurrentMonth ? colors.textFaint : colors.textDim} />
            </TouchableOpacity>
          </View>

          {/* Rótulos dos dias da semana */}
          <View style={styles.calWeekLabels}>
            {['D','S','T','Q','Q','S','S'].map((l, i) => (
              <Text key={i} style={styles.calWeekLabel}>{l}</Text>
            ))}
          </View>

          {/* Grade de dias */}
          <View style={styles.calGrid}>
            {calendarDays.map((day, i) => {
              if (day === null) return <View key={`empty-${i}`} style={styles.calCell} />;
              const isToday =
                isCurrentMonth && day === today.getDate();
              const trained = monthCheckins.has(day);
              return (
                <View
                  key={day}
                  style={[
                    styles.calCell,
                    trained && styles.calCellTrained,
                    isToday && !trained && styles.calCellToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.calDayText,
                      trained && styles.calDayTextTrained,
                      isToday && !trained && styles.calDayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                  {trained && <View style={styles.calDot} />}
                </View>
              );
            })}
          </View>

          {/* Resumo do mês */}
          <View style={styles.calSummary}>
            <View style={styles.calSummaryItem}>
              <Text style={[styles.calSummaryVal, { color: colors.accent }]}>{monthWorkouts}</Text>
              <Text style={styles.calSummaryLabel}>treinos</Text>
            </View>
            <View style={styles.calSummaryDivider} />
            <View style={styles.calSummaryItem}>
              <Text style={[styles.calSummaryVal, { color: colors.blue }]}>{daysInMonth - monthWorkouts}</Text>
              <Text style={styles.calSummaryLabel}>descanso</Text>
            </View>
            <View style={styles.calSummaryDivider} />
            <View style={styles.calSummaryItem}>
              <Text style={[styles.calSummaryVal, { color: colors.amber }]}>{consistencyPct}%</Text>
              <Text style={styles.calSummaryLabel}>consistência</Text>
            </View>
          </View>
        </View>

        {/* ── Motivação ── */}
        <LinearGradient
          colors={['rgba(255,182,72,0.16)', 'rgba(255,182,72,0.06)']}
          style={styles.motivationCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.motivationEmoji}>
            {streak >= 7 ? '🏆' : streak >= 3 ? '⚡' : '💪'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.motivationTitle}>
              {streak >= 7
                ? 'Você está em chamas!'
                : streak >= 3
                ? 'Continue assim!'
                : 'Cada treino conta!'}
            </Text>
            <Text style={styles.motivationText}>
              {streak >= 7
                ? `${streak} dias seguidos. Consistência é a chave do sucesso.`
                : streak >= 3
                ? `${streak} dias seguidos. Você está construindo o hábito.`
                : 'Comece hoje e construa sua sequência de treinos.'}
            </Text>
          </View>
        </LinearGradient>

        <View style={{ height: vs(20) }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CAL_CELL = s(40);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: screenPaddingTop,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(18),
    paddingBottom: vs(14),
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: fs(16),
    fontWeight: '800',
  },

  scrollContent: {
    paddingHorizontal: s(18),
    paddingBottom: vs(40),
  },

  // Streak Hero
  streakHero: {
    borderRadius: 22,
    padding: s(20),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
    marginBottom: vs(14),
  },
  streakContent: {
    flex: 1,
    alignItems: 'center',
  },
  streakEmoji: { fontSize: fs(28), marginBottom: vs(4) },
  streakNumber: {
    color: colors.accent,
    fontSize: fs(40),
    fontWeight: '900',
    lineHeight: fs(44),
  },
  streakLabel: {
    color: colors.text,
    fontSize: fs(11),
    fontWeight: '700',
    marginTop: vs(2),
  },
  streakSub: {
    color: colors.textDim,
    fontSize: fs(9),
    marginTop: vs(4),
  },
  streakDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: s(16),
  },
  streakRight: { flex: 1, gap: vs(16) },
  streakStat: { alignItems: 'center' },
  streakStatVal: {
    color: colors.text,
    fontSize: fs(22),
    fontWeight: '800',
  },
  streakStatLabel: {
    color: colors.textDim,
    fontSize: fs(9),
    textAlign: 'center',
    marginTop: vs(2),
    lineHeight: fs(13),
  },

  // Métricas
  metricsRow: {
    flexDirection: 'row',
    gap: s(10),
    marginBottom: vs(14),
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    padding: s(16),
    overflow: 'hidden',
    gap: vs(6),
  },
  metricGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  metricIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: fs(22),
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.text,
    fontSize: fs(11),
    fontWeight: '700',
  },
  metricSublabel: {
    color: colors.textDim,
    fontSize: fs(9),
  },

  // Section Card
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: s(18),
    marginBottom: vs(14),
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fs(13),
    fontWeight: '800',
    marginBottom: vs(16),
  },

  // Consistência 7 dias
  consistencyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: vs(60),
    marginBottom: vs(12),
  },
  consistencyItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: vs(6),
  },
  consistencyBar: {
    width: s(22),
    borderRadius: 8,
  },
  consistencyDayLabel: {
    color: colors.textDim2,
    fontSize: fs(9),
    fontWeight: '600',
  },
  consistencyLegend: {
    flexDirection: 'row',
    gap: s(16),
    marginTop: vs(4),
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textDim, fontSize: fs(9) },

  // Calendário
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(14),
  },
  calArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calMonthLabel: {
    color: colors.text,
    fontSize: fs(13),
    fontWeight: '700',
  },
  calWeekLabels: {
    flexDirection: 'row',
    marginBottom: vs(6),
  },
  calWeekLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: fs(9),
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginBottom: vs(4),
  },
  calCellTrained: {
    backgroundColor: 'rgba(47,230,160,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.4)',
  },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  calDayText: {
    color: colors.textDim2,
    fontSize: fs(11),
    fontWeight: '600',
  },
  calDayTextTrained: {
    color: colors.accent,
    fontWeight: '800',
  },
  calDayTextToday: {
    color: colors.accent,
  },
  calDot: {
    position: 'absolute',
    bottom: vs(4),
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  calSummary: {
    flexDirection: 'row',
    marginTop: vs(16),
    paddingTop: vs(16),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  calSummaryItem: { flex: 1, alignItems: 'center' },
  calSummaryVal: { fontSize: fs(20), fontWeight: '800' },
  calSummaryLabel: { color: colors.textDim, fontSize: fs(9), marginTop: vs(2) },
  calSummaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },

  // Motivação
  motivationCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,182,72,0.25)',
    padding: s(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(14),
  },
  motivationEmoji: { fontSize: fs(28) },
  motivationTitle: {
    color: colors.text,
    fontSize: fs(13),
    fontWeight: '800',
    marginBottom: vs(3),
  },
  motivationText: {
    color: colors.textDim,
    fontSize: fs(10),
    lineHeight: fs(15),
  },
});
