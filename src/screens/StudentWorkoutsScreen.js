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
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

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
      const { data } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', studentId)
        .order('created_at', { ascending: false });

      if (data) {
        // Agrupa pela mesma chave que a WorkoutsScreen do aluno usa:
        // period_start + period_end. Treinos sem período = bloco único "sem_periodo".
        // Isso garante que personal e aluno vejam exatamente os mesmos grupos.
        const grouped = {};
        data.forEach((w) => {
          const key = w.period_start ? `${w.period_start}__${w.period_end}` : 'sem_periodo';
          if (!grouped[key]) {
            grouped[key] = {
              id: key,
              goal: w.goal || '',
              level: w.level || '',
              period_start: w.period_start,
              period_end: w.period_end,
              created_at: w.created_at,
              workouts: [],
            };
          }
          // Usa o goal/level do registro mais recente do grupo (igual à WorkoutsScreen)
          if (new Date(w.created_at) > new Date(grouped[key].created_at)) {
            grouped[key].goal  = w.goal  || grouped[key].goal;
            grouped[key].level = w.level || grouped[key].level;
            grouped[key].created_at = w.created_at;
          }
          grouped[key].workouts.push(w);
        });

        const freshBlocks = Object.values(grouped).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setBlocks(freshBlocks);
        setActiveBlock((prev) =>
          prev ? freshBlocks.find((b) => b.id === prev.id) || null : prev
        );
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
          // Cascata: substitutos → exercises → logs → workout
          const { data: weRows } = await supabase
            .from('workout_exercises')
            .select('id')
            .eq('workout_id', workout.id);
          const weIds = (weRows || []).map((r) => r.id);

          if (weIds.length > 0) {
            const { error: subsErr } = await supabase
              .from('workout_exercise_substitutes')
              .delete()
              .in('workout_exercise_id', weIds);
            if (subsErr) {
              Alert.alert('Erro ao apagar substitutos', subsErr.message);
              return;
            }
          }

          const { error: weErr } = await supabase
            .from('workout_exercises')
            .delete()
            .eq('workout_id', workout.id);
          if (weErr) {
            Alert.alert('Erro ao apagar exercícios', weErr.message);
            return;
          }

          await supabase.from('workout_logs').delete().eq('workout_id', workout.id);

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

  // Apaga todos os treinos de um bloco inteiro de uma vez.
  const handleDeleteBlock = (block) => {
    const count = block.workouts.length;
    const label = [block.goal, block.level].filter(Boolean).join(' · ') || 'este bloco';
    Alert.alert(
      'Apagar grupo de treinos',
      `Isso vai remover "${label}" e todos os ${count} treino${count !== 1 ? 's' : ''} dentro dele. Essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: async () => {
            const workoutIds = block.workouts.map((w) => w.id);

            // 1. Buscar os IDs dos workout_exercises para deletar os substitutos
            const { data: weRows, error: weSelectErr } = await supabase
              .from('workout_exercises')
              .select('id')
              .in('workout_id', workoutIds);

            if (weSelectErr) {
              Alert.alert('Erro', weSelectErr.message);
              return;
            }

            const weIds = (weRows || []).map((r) => r.id);

            // 2. Deletar substitutos (precisa vir antes dos workout_exercises por FK)
            if (weIds.length > 0) {
              const { error: subsErr } = await supabase
                .from('workout_exercise_substitutes')
                .delete()
                .in('workout_exercise_id', weIds);
              if (subsErr) {
                Alert.alert('Erro ao apagar substitutos', subsErr.message);
                return;
              }
            }

            // 3. Deletar workout_exercises
            const { error: weErr } = await supabase
              .from('workout_exercises')
              .delete()
              .in('workout_id', workoutIds);
            if (weErr) {
              Alert.alert('Erro ao apagar exercícios', weErr.message);
              return;
            }

            // 4. Deletar workout_logs (histórico)
            await supabase
              .from('workout_logs')
              .delete()
              .in('workout_id', workoutIds);

            // 5. Por último, deletar os workouts
            const { error } = await supabase
              .from('workouts')
              .delete()
              .in('id', workoutIds);

            if (error) {
              Alert.alert('Erro ao apagar grupo', error.message);
              return;
            }
            load();
          },
        },
      ]
    );
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
                {/* Botão de apagar o bloco inteiro */}
                <TouchableOpacity
                  style={styles.deleteBlockBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteBlock(block);
                  }}
                >
                  <Feather name="trash-2" size={14} color={colors.red} />
                </TouchableOpacity>

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
                    <Text style={styles.blockTitle}>
                      {[block.goal, block.level].filter(Boolean).join(' · ') || 'Bloco de treinos'}
                    </Text>
                    <View style={styles.blockMeta}>
                      <Text style={styles.blockMetaText}>
                        {block.workouts.length} treino{block.workouts.length !== 1 ? 's' : ''}
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
    paddingHorizontal: s(18),
    paddingTop: screenPaddingTop,
  },

  // Header
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(16),
    marginLeft: -4,
  },
  back: {
    color: colors.text,
    fontSize: fs(13),
    marginLeft: 8,
    fontWeight: '500',
  },
  eyebrow: {
    fontSize: fs(9),
    fontWeight: '700',
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: vs(2),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(20),
  },
  title: {
    fontSize: fs(20),
    fontWeight: '800',
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: s(16),
    paddingVertical: vs(10),
    borderRadius: radius.md - 4,
    gap: 6,
  },
  addButtonText: {
    color: '#08110A',
    fontWeight: '700',
    fontSize: fs(11),
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: vs(20),
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    paddingVertical: vs(12),
    paddingHorizontal: s(8),
    borderRadius: 14,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    fontSize: fs(11),
    fontWeight: '700',
    color: colors.textDim,
  },
  tabTextActive: {
    color: '#08110A',
  },

  // Blocks List
  blocksList: {
    paddingBottom: vs(20),
  },
  blockCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: vs(12),
    overflow: 'hidden',
  },
  deleteBlockBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    backgroundColor: colors.redGlow,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: vs(6),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${colors.amber}24`,
    paddingHorizontal: s(9),
    paddingVertical: vs(4),
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
    fontSize: fs(9),
    fontWeight: '700',
    color: colors.amber,
  },
  blockTitle: {
    fontSize: fs(13),
    fontWeight: '700',
    color: colors.text,
    marginBottom: vs(8),
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: vs(10),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  blockMetaText: {
    fontSize: fs(9.5),
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
    paddingBottom: vs(20),
  },
  sectionHeader: {
    fontSize: fs(9.5),
    fontWeight: '700',
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(16),
    marginBottom: vs(8),
  },
  addWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentGlow,
    paddingVertical: vs(5),
    paddingHorizontal: s(10),
    borderRadius: radius.pill,
  },
  addWorkoutBtnText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  emptyDay: { color: colors.textDim2, fontSize: fs(10.5), marginBottom: vs(10), fontStyle: 'italic' },
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
    marginBottom: vs(10),
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
    fontSize: fs(9),
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
    fontSize: fs(9),
    fontWeight: '600',
    color: colors.textDim2,
    marginBottom: vs(2),
    textTransform: 'uppercase',
  },
  dayWorkoutName: {
    fontSize: fs(12.5),
    fontWeight: '700',
    color: colors.text,
  },
  exerciseChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: s(16),
    paddingBottom: vs(12),
  },
  chip: {
    backgroundColor: `${colors.accent}1F`,
    paddingHorizontal: s(12),
    paddingVertical: vs(4),
    borderRadius: 100,
  },
  chipText: {
    fontSize: fs(9),
    fontWeight: '700',
    color: colors.accent,
  },
  chipMore: {
    fontSize: fs(9),
    color: colors.textDim,
    alignSelf: 'center',
    marginLeft: 5,
  },
  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: vs(40),
    fontSize: fs(12),
    lineHeight: 20,
  },
});
