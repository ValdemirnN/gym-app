import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

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

export default function StudentWorkoutsScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const [sections, setSections] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, name, created_at, day_of_week')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });
    setSections(groupByDay(data || []));
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const diasDesde = (dateStr) => {
    const dias = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return 'criado hoje';
    if (dias === 1) return 'há 1 dia';
    return `há ${dias} dias`;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Treinos</Text>
        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreateWorkoutForStudent', { studentId, studentName })}
        >
          <Feather name="plus" size={14} color="#04170F" />
          <Text style={styles.addButtonText}> Novo</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Esse aluno ainda não tem nenhum treino. Toque em "Novo" para montar o primeiro.</Text>
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('StudentWorkoutDetail', {
                workoutId: item.id,
                workoutName: item.name,
                studentId,
                studentName,
              })
            }
          >
            <View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>{diasDesde(item.created_at)}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textDim2} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.sm - 4,
  },
  addButtonText: { color: '#04170F', fontWeight: '700', fontSize: 13 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20 },
  sectionHeader: {
    color: colors.textDim2,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
