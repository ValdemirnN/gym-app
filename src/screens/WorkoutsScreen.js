import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { getPendingCount, onQueueChange } from '../lib/syncManager';

const DAY_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo', null];
const DAY_LABEL = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

function groupByDay(workouts) {
  const groups = {};
  workouts.forEach((w) => {
    const key = w.day_of_week || null;
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  });
  return DAY_ORDER.filter((key) => groups[key]).map((key) => ({
    title: key ? DAY_LABEL[key] : 'Sem dia definido',
    data: groups[key],
  }));
}

export default function WorkoutsScreen({ navigation }) {
  const { session } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getPendingCount().then(setPendingCount);
    const unsubscribe = onQueueChange(setPendingCount);
    return unsubscribe;
  }, []);

  const [allWorkouts, setAllWorkouts] = useState([]);
  const [tab, setTab] = useState('rotinas'); // 'rotinas' | 'aerobico'

  const loadWorkouts = useCallback(async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, name, created_at, day_of_week, goal, level, period_start, period_end')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    const workoutIds = (data || []).map((w) => w.id);
    let cardioWorkoutIds = new Set();
    if (workoutIds.length > 0) {
      const { data: exRows } = await supabase
        .from('workout_exercises')
        .select('workout_id, exercises(exercise_type)')
        .in('workout_id', workoutIds);
      (exRows || []).forEach((r) => {
        if (r.exercises?.exercise_type === 'cardio') cardioWorkoutIds.add(r.workout_id);
      });
    }

    setAllWorkouts((data || []).map((w) => ({ ...w, hasCardio: cardioWorkoutIds.has(w.id) })));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  const filteredWorkouts = allWorkouts.filter((w) => (tab === 'aerobico' ? w.hasCardio : true));
  const sections = groupByDay(filteredWorkouts);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Treinos</Text>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tabButton, tab === 'rotinas' && styles.tabButtonActive]} onPress={() => setTab('rotinas')}>
          <Text style={[styles.tabButtonText, tab === 'rotinas' && styles.tabButtonTextActive]}>Rotinas de Treinos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, tab === 'aerobico' && styles.tabButtonActive]} onPress={() => setTab('aerobico')}>
          <Text style={[styles.tabButtonText, tab === 'aerobico' && styles.tabButtonTextActive]}>Aeróbico</Text>
        </TouchableOpacity>
      </View>

      {pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Feather name="upload-cloud" size={14} color={colors.accent} />
          <Text style={styles.syncBannerText}>
            {pendingCount} treino{pendingCount > 1 ? 's' : ''} salvo{pendingCount > 1 ? 's' : ''} no aparelho,
            aguardando internet pra enviar
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'aerobico'
              ? 'Nenhum treino com cardio cadastrado ainda.'
              : 'Nenhum treino criado ainda. Peça pro seu personal montar seu primeiro plano.'}
          </Text>
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('WorkoutDetail', {
                workoutId: item.id,
                workoutName: item.name,
                dayOfWeek: item.day_of_week,
              })
            }
          >
            <View style={styles.cardIcon}>
              <Feather name={item.hasCardio ? 'heart' : 'zap'} size={17} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {(item.goal || item.level) && (
                <Text style={styles.cardMeta}>{[item.goal, item.level].filter(Boolean).join(' · ')}</Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.textDim2} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 60 },
  header: { marginBottom: 16 },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  syncBannerText: { color: colors.accent, fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20 },
  sectionHeader: {
    color: colors.textDim2,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 1,
    padding: 14,
    marginBottom: 10,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  cardMeta: { color: colors.textDim, fontSize: 11.5, marginTop: 2, textTransform: 'capitalize' },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabButtonText: { color: colors.textDim, fontSize: 12.5, fontWeight: '700' },
  tabButtonTextActive: { color: '#04170F' },
});
