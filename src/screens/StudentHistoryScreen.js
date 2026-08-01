import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(startStr, endStr) {
  if (!endStr) return null;
  const mins = Math.round((new Date(endStr) - new Date(startStr)) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? m + 'min' : ''}`;
}

export default function StudentHistoryScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const [logs, setLogs] = useState([]);
  const [currentWorkout, setCurrentWorkout] = useState(null);

  const load = useCallback(async () => {
    const { data: logsData } = await supabase
      .from('workout_logs')
      .select('id, started_at, finished_at, skipped, skip_reason, day_change_reason, workouts(name)')
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

  const concluidos = logs.filter((l) => l.finished_at).length;

  const diasComTreinoAtual = currentWorkout
    ? Math.floor((Date.now() - new Date(currentWorkout.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

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
          <Text style={styles.summaryLabel}>Treinos concluídos</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{diasComTreinoAtual !== null ? `${diasComTreinoAtual}d` : '-'}</Text>
          <Text style={styles.summaryLabel}>
            {currentWorkout ? `Nesse treino (${currentWorkout.name})` : 'Sem treino atual'}
          </Text>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma sessão de treino registrada ainda.</Text>}
        renderItem={({ item }) => {
          const duration = formatDuration(item.started_at, item.finished_at);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('StudentWorkoutLogDetail', {
                  logId: item.id,
                  studentName,
                  workoutName: item.workouts?.name,
                })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.workouts?.name || 'Treino removido'}</Text>
                <Text style={styles.cardSubtitle}>{formatDate(item.started_at)}</Text>
                {item.skipped && item.skip_reason ? (
                  <Text style={styles.reasonText} numberOfLines={2}>Motivo: {item.skip_reason}</Text>
                ) : null}
                {!item.skipped && item.day_change_reason ? (
                  <Text style={styles.reasonText} numberOfLines={2}>Trocou o dia: {item.day_change_reason}</Text>
                ) : null}
              </View>
              {item.skipped ? (
                <View style={styles.badgeSkipped}>
                  <Text style={styles.badgeSkippedText}>Não treinou</Text>
                </View>
              ) : item.finished_at ? (
                <View style={styles.badgeDone}>
                  <Text style={styles.badgeDoneText}>{duration || 'Concluído'}</Text>
                </View>
              ) : (
                <View style={styles.badgePending}>
                  <Text style={styles.badgePendingText}>Em andamento</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  summaryValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badgeDone: { backgroundColor: colors.accentGlow, borderRadius: radius.sm - 4, paddingHorizontal: 10, paddingVertical: 5 },
  badgeDoneText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  badgePending: { backgroundColor: colors.amberGlow, borderRadius: radius.sm - 4, paddingHorizontal: 10, paddingVertical: 5 },
  badgePendingText: { color: colors.amber, fontSize: 12, fontWeight: '700' },
  badgeSkipped: { backgroundColor: colors.redGlow, borderRadius: radius.sm - 4, paddingHorizontal: 10, paddingVertical: 5 },
  badgeSkippedText: { color: colors.red, fontSize: 12, fontWeight: '700' },
  reasonText: { color: colors.textDim, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
});
