import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
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

export default function WorkoutsScreen({ navigation }) {
  const { session } = useAuth();
  const [sections, setSections] = useState([]);

  const loadWorkouts = useCallback(async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, name, created_at, day_of_week')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setSections(groupByDay(data || []));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Treinos</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nenhum treino criado ainda. Peça pro seu personal montar seu primeiro plano.
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
              <Feather name="zap" size={17} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
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
  cardTitle: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: '700' },
});
