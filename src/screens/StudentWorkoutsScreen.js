import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SectionList,
  Alert,
} from 'react-native';
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

const DAY_SHORT = {
  segunda: 'SEG',
  terca: 'TER',
  quarta: 'QUA',
  quinta: 'QUI',
  sexta: 'SEX',
  sabado: 'SÁB',
  domingo: 'DOM',
};

const REAL_DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

function groupByDay(workouts) {
  const groups = {};
  workouts.forEach((w) => {
    const key = w.day_of_week || null;
    if (!groups[key]) groups[key] = [];
    groups[key].push(w);
  });
  // Sempre mostra todos os 7 dias da semana (mesmo sem treino cadastrado),
  // pra sempre ter onde clicar em "Adicionar treino". "Sem dia definido"
  // só aparece se realmente existir algum treino sem day_of_week.
  const days = REAL_DAYS.map((key) => ({
    key,
    title: DAY_LABEL[key],
    data: groups[key] || [],
  }));
  if (groups[null]) {
    days.push({ key: null, title: 'Sem dia definido', data: groups[null] });
  }
  return days;
}

export default function StudentWorkoutsScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const [blocks, setBlocks] = useState([]);
  const [activeBlock, setActiveBlock] = useState(null);
  const [activeTab, setActiveTab] = useState('ativos');

  const load = useCallback(async () => {
    try {
      // Carrega blocos de treino
      const { data } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });

      if (data) {
        // Agrupa por bloco
        const grouped = {};
        data.forEach((w) => {
          if (!grouped[w.block_id || 'default']) {
            grouped[w.block_id || 'default'] = {
              id: w.block_id || 'default',
              name: w.block_name || 'Bloco padrão',
              goal: w.goal || 'Treino',
              level: w.level || 'Intermediário',
              status: 'andamento',
              created_at: w.created_at,
              workouts: [],
            };
          }
          grouped[w.block_id || 'default'].workouts.push(w);
        });

        const freshBlocks = Object.values(grouped);
        setBlocks(freshBlocks);
        setActiveBlock((prev) => (prev ? freshBlocks.find((b) => b.id === prev.id) || null : prev));
      }
    } catch (error) {
      console.error('Erro ao carregar treinos:', error);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openBlockDetail = (block) => {
    setActiveBlock(block);
  };

  const closeBlockDetail = () => {
    setActiveBlock(null);
  };

  const handleDeleteWorkout = (workout) => {
    Alert.alert('Remover treino', `Remover "${workout.name}" de ${DAY_LABEL[workout.day_of_week] || 'sem dia'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('workouts').delete().eq('id', workout.id);
          if (error) {
            Alert.alert('Erro', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const diasDesde = (dateStr) => {
    if (!dateStr) return 'hoje';
    const dias = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 0) return 'hoje';
    if (dias === 1) return 'há 1 dia';
    return `há ${dias} dias`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // Lista de Blocos
  if (!activeBlock) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={20} color={colors.text} />
          <Text style={styles.back}>{studentName}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TREINOS</Text>
            <Text style={styles.title}>Meus Treinos</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CreateWorkoutForStudent', { studentId, studentName })}
          >
            <Feather name="plus" size={16} color="#08110A" strokeWidth={3} />
            <Text style={styles.addButtonText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {['ativos', 'finalizados'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'ativos' ? 'Ativos' : 'Finalizados'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Blocos List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.blocksList}
        >
          {blocks.length === 0 ? (
            <Text style={styles.empty}>Nenhum treino cadastrado. Toque em "Novo" para criar.</Text>
          ) : (
            blocks.map((block) => (
              <TouchableOpacity
                key={block.id}
                style={styles.blockCard}
                onPress={() => openBlockDetail(block)}
                activeOpacity={0.8}
              >
                <View style={styles.blockCardContent}>
                  <View style={styles.blockIcon}>
                    <Feather name="layers" size={18} color={colors.accent} />
                  </View>

                  <View style={styles.blockInfo}>
                    <View style={styles.blockStatusRow}>
                      <View style={styles.statusPill}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>Em andamento</Text>
                      </View>
                    </View>
                    <Text style={styles.blockTitle}>{block.goal} · {block.level}</Text>
                    <View style={styles.blockMeta}>
                      <Text style={styles.blockMetaText}>
                        {block.workouts.length} exercícios
                      </Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.blockMetaText}>criado {diasDesde(block.created_at)}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // Detalhamento do Bloco
  const blockWorkouts = groupByDay(activeBlock.workouts);

  return (
    <View style={styles.container}>
      {/* Header Detail */}
      <TouchableOpacity style={styles.backRow} onPress={closeBlockDetail}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <View style={[styles.header, { marginBottom: 12 }]}>
        <View>
          <Text style={styles.eyebrow}>BLOCO</Text>
          <Text style={styles.title}>{activeBlock.goal}</Text>
        </View>
      </View>

      {/* Tabs Detail */}
      <View style={styles.tabsContainer}>
        {['blocos', 'historico'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'blocos' ? 'Blocos' : 'Histórico'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dias List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.daysList}>
        {blockWorkouts.length === 0 ? (
          <Text style={styles.empty}>Nenhum dia cadastrado neste bloco.</Text>
        ) : (
          blockWorkouts.map((section, idx) => (
            <View key={idx}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>{section.title}</Text>
                <TouchableOpacity
                  style={styles.addWorkoutBtn}
                  onPress={() =>
                    navigation.navigate('CreateWorkoutForStudent', {
                      studentId,
                      studentName,
                      presetDayOfWeek: section.key,
                    })
                  }
                >
                  <Feather name="plus" size={12} color={colors.accent} />
                  <Text style={styles.addWorkoutBtnText}>Adicionar treino</Text>
                </TouchableOpacity>
              </View>
              {section.data.length === 0 ? (
                <Text style={styles.emptyDay}>Nenhum treino cadastrado ainda.</Text>
              ) : (
              section.data.map((workout) => (
                <TouchableOpacity
                  key={workout.id}
                  style={styles.dayCard}
                  onPress={() =>
                    navigation.navigate('StudentWorkoutDetail', {
                      workoutId: workout.id,
                      workoutName: workout.name,
                      studentId,
                      studentName,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <View style={styles.dayCardContent}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>
                        {workout.day_of_week ? DAY_SHORT[workout.day_of_week] : '—'}
                      </Text>
                    </View>

                    <View style={styles.dayInfo}>
                      <Text style={styles.dayLabel}>{DAY_LABEL[workout.day_of_week] || 'Sem dia'}</Text>
                      <Text style={styles.dayWorkoutName}>{workout.name}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.addExerciseBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        navigation.navigate('CreateWorkoutForStudent', {
                          studentId,
                          studentName,
                          workoutId: workout.id,
                          workoutName: workout.name,
                          initialStep: 1,
                        });
                      }}
                    >
                      <Feather name="plus" size={16} color={colors.accent} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeWorkoutBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteWorkout(workout);
                      }}
                    >
                      <Feather name="trash-2" size={15} color={colors.red} />
                    </TouchableOpacity>

                    <Feather name="chevron-right" size={16} color={colors.textDim2} />
                  </View>

                  {workout.exercises && workout.exercises.length > 0 && (
                    <View style={styles.exerciseChips}>
                      {workout.exercises.slice(0, 3).map((ex, i) => (
                        <View key={i} style={styles.chip}>
                          <Text style={styles.chipText}>{ex.name}</Text>
                        </View>
                      ))}
                      {workout.exercises.length > 3 && (
                        <Text style={styles.chipMore}>+{workout.exercises.length - 3}</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 18,
    paddingTop: 60,
  },

  // Header
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: -4,
  },
  back: {
    color: colors.text,
    fontSize: 15,
    marginLeft: 8,
    fontWeight: '500',
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md - 4,
    gap: 6,
  },
  addButtonText: {
    color: '#08110A',
    fontWeight: '700',
    fontSize: 13,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDim,
  },
  tabTextActive: {
    color: '#08110A',
  },

  // Blocks List
  blocksList: {
    paddingBottom: 20,
  },
  blockCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  blockCardContent: {
    flexDirection: 'row',
    gap: 12,
  },
  blockIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: `${colors.accent}1F`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  blockInfo: {
    flex: 1,
  },
  blockStatusRow: {
    marginBottom: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${colors.amber}24`,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.amber,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  blockMetaText: {
    fontSize: 11.5,
    color: colors.textDim,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textDim2,
  },

  // Days List
  daysList: {
    paddingBottom: 20,
  },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  addWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentGlow,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  addWorkoutBtnText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  emptyDay: { color: colors.textDim2, fontSize: 12.5, marginBottom: 10, fontStyle: 'italic' },
  removeWorkoutBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dayCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface3,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  dayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  dayInfo: {
    flex: 1,
  },
  addExerciseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dayLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textDim2,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  dayWorkoutName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
  },
  exerciseChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chip: {
    backgroundColor: `${colors.accent}1F`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  chipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.accent,
  },
  chipMore: {
    fontSize: 9.5,
    color: colors.textDim,
    alignSelf: 'center',
    marginLeft: 5,
  },
  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    lineHeight: 20,
  },
});
