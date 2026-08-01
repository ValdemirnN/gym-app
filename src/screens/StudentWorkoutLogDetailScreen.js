import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

function formatDateLong(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(startStr, endStr) {
  if (!endStr) return null;
  const mins = Math.round((new Date(endStr) - new Date(startStr)) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? m + 'min' : ''}`;
}

// Agrupa as séries realizadas (workout_log_sets) por exercício, mantendo a
// ordem de quando cada exercício apareceu primeiro na sessão.
function groupSetsByExercise(sets) {
  const order = [];
  const map = {};
  sets.forEach((s) => {
    const exId = s.exercise_id;
    if (!map[exId]) {
      map[exId] = { exerciseName: s.exercises?.name || 'Exercício removido', sets: [] };
      order.push(exId);
    }
    map[exId].sets.push(s);
  });
  return order.map((exId) => map[exId]);
}

export default function StudentWorkoutLogDetailScreen({ route, navigation }) {
  const { logId, studentName, workoutName } = route.params;
  const [log, setLog] = useState(null);
  const [groups, setGroups] = useState([]);
  const [exerciseNotes, setExerciseNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: logData } = await supabase
      .from('workout_logs')
      .select('id, started_at, finished_at, skipped, skip_reason, day_change_reason, workouts(name)')
      .eq('id', logId)
      .single();
    setLog(logData);

    const { data: setsData } = await supabase
      .from('workout_log_sets')
      .select('id, exercise_id, set_number, reps_done, weight_kg, exercises(name)')
      .eq('workout_log_id', logId)
      .order('set_number');
    setGroups(groupSetsByExercise(setsData || []));

    const { data: statusData } = await supabase
      .from('workout_log_exercise_status')
      .select('id, status, reason, exercises:exercise_id(name), substitute:substitute_exercise_id(name)')
      .eq('workout_log_id', logId);
    setExerciseNotes(statusData || []);

    setLoading(false);
  }, [logId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const duration = log ? formatDuration(log.started_at, log.finished_at) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{log?.workouts?.name || workoutName || 'Treino'}</Text>
      <Text style={styles.subtitle}>{formatDateLong(log?.started_at)}</Text>

      {log?.skipped ? (
        <View style={styles.noticeBoxDanger}>
          <Feather name="x-circle" size={15} color={colors.red} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.noticeTitleDanger}>Aluno marcou que não treinou nesse dia</Text>
            {log.skip_reason ? <Text style={styles.noticeTextDanger}>Motivo: {log.skip_reason}</Text> : null}
          </View>
        </View>
      ) : null}

      {!log?.skipped && log?.day_change_reason ? (
        <View style={styles.noticeBox}>
          <Feather name="alert-circle" size={15} color={colors.amber} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.noticeTitle}>Aluno fez esse treino fora do dia programado</Text>
            <Text style={styles.noticeText}>Motivo: {log.day_change_reason}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{log?.finished_at ? 'Concluído' : 'Em andamento'}</Text>
          <Text style={styles.summaryLabel}>Status</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{duration || '-'}</Text>
          <Text style={styles.summaryLabel}>Duração</Text>
        </View>
      </View>

      {exerciseNotes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Alterações feitas pelo aluno</Text>
          {exerciseNotes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              {note.status === 'pulado' ? (
                <Text style={styles.noteTitle}>
                  Pulou <Text style={styles.noteHighlight}>{note.exercises?.name || 'exercício removido'}</Text>
                </Text>
              ) : (
                <Text style={styles.noteTitle}>
                  Trocou <Text style={styles.noteHighlight}>{note.exercises?.name || 'exercício removido'}</Text> por{' '}
                  <Text style={styles.noteHighlight}>{note.substitute?.name || 'exercício removido'}</Text>
                </Text>
              )}
              {note.reason ? <Text style={styles.noteReason}>Motivo: {note.reason}</Text> : null}
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Exercícios realizados</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : groups.length === 0 ? (
        <Text style={styles.empty}>Nenhuma série registrada nessa sessão.</Text>
      ) : (
        groups.map((group, idx) => (
          <View key={idx} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{group.exerciseName}</Text>
            {group.sets.map((s) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setLabel}>Série {s.set_number}</Text>
                <Text style={styles.setValue}>
                  {s.reps_done ?? '-'} reps {s.weight_kg ? `× ${s.weight_kg}kg` : ''}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textDim, fontSize: 13, marginTop: 4, marginBottom: 20, textTransform: 'capitalize' },
  summaryRow: { flexDirection: 'row', marginBottom: 24, gap: 10 },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14 },
  summaryValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  empty: { color: colors.textDim, fontSize: 14, marginTop: 8 },
  exerciseCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: 12 },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setLabel: { color: colors.textDim, fontSize: 13 },
  setValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  noticeBoxDanger: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.redGlow,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 20,
  },
  noticeTitleDanger: { color: colors.red, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  noticeTextDanger: { color: colors.red, fontSize: 13 },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.amberGlow,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 20,
  },
  noticeTitle: { color: colors.amber, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  noticeText: { color: colors.amber, fontSize: 13 },
  noteCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  noteTitle: { color: colors.text, fontSize: 14, lineHeight: 20 },
  noteHighlight: { fontWeight: '700', color: colors.accent },
  noteReason: { color: colors.textDim, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
});
