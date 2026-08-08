import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';
import InlineDemoVideo from '../components/InlineDemoVideo';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StudentWorkoutDetailScreen({ route, navigation }) {
  const { workoutId, workoutName, studentId, studentName } = route.params;
  const [items, setItems] = useState([]);
  const [videos, setVideos] = useState([]);
  const [attachTarget, setAttachTarget] = useState(null); // { exerciseId, name }
  const [attachSearch, setAttachSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [doneSets, setDoneSets] = useState({}); // { [workoutExerciseId]: Set(indices) } — só visual, não persiste
  const [editingField, setEditingField] = useState(null); // { exerciseId, field: 'instructions' | 'tip' }
  const [editingValue, setEditingValue] = useState('');
  const [savingField, setSavingField] = useState(false);
  // Página ativa (arrastada) dentro do card de cada exercício expandido:
  // 0 = exercício principal, 1+ = cada substituto cadastrado pra esse aluno.
  const [substitutePage, setSubstitutePage] = useState({}); // { [workoutExerciseId]: pageIndex }

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('workout_exercises')
      .select(
        'id, target_sets, target_reps, target_reps_detail, progression_note, drop_last, drop_note, rest_seconds, order_index, exercises(id, name, muscle_group, video_id, instructions, tip), workout_exercise_substitutes(substitute_exercise_id, target_sets, target_reps, target_reps_detail, drop_last, drop_note, instructions, exercises:substitute_exercise_id(id, name, muscle_group, video_id, instructions, tip))'
      )
      .eq('workout_id', workoutId)
      .order('order_index');
    setItems(data || []);
  }, [workoutId]);

  const loadVideos = useCallback(async () => {
    const { data } = await supabase.from('exercise_videos').select('id, name').order('name');
    setVideos(data || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadVideos();
    }, [load, loadVideos])
  );

  // Expande/recolhe o exercício no próprio card — nunca navega pra outra tela.
  const toggleExpand = (item) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };

  // Marca/desmarca uma série como feita (visual, pro personal acompanhar durante o
  // atendimento — não é a execução oficial do aluno, que fica na tela dele)
  const toggleSetDone = (workoutExerciseId, setIndex) => {
    setDoneSets((prev) => {
      const current = new Set(prev[workoutExerciseId] || []);
      if (current.has(setIndex)) current.delete(setIndex);
      else current.add(setIndex);
      return { ...prev, [workoutExerciseId]: current };
    });
  };

  const startEditingField = (exerciseId, field, currentValue) => {
    setEditingField({ exerciseId, field });
    setEditingValue(currentValue || '');
  };

  const saveEditingField = async () => {
    if (!editingField) return;
    setSavingField(true);
    const { error } = await supabase
      .from('exercises')
      .update({ [editingField.field]: editingValue.trim() || null })
      .eq('id', editingField.exerciseId);
    setSavingField(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setEditingField(null);
    setEditingValue('');
    load();
  };

  const attachVideo = async (video) => {
    const { error } = await supabase.from('exercises').update({ video_id: video.id }).eq('id', attachTarget.exerciseId);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setAttachTarget(null);
    setAttachSearch('');
    load();
  };

  const detachVideo = async (exerciseId) => {
    const { error } = await supabase.from('exercises').update({ video_id: null }).eq('id', exerciseId);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    load();
  };

  const manageVideo = (item) => {
    const { id: exerciseId, name, video_id: videoId } = item.exercises;
    if (!videoId) {
      setAttachTarget({ exerciseId, name });
      return;
    }
    Alert.alert(name, 'O que deseja fazer com o vídeo deste exercício?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Trocar vídeo', onPress: () => setAttachTarget({ exerciseId, name }) },
      { text: 'Remover vídeo', style: 'destructive', onPress: () => detachVideo(exerciseId) },
    ]);
  };

  const attachSearchLower = attachSearch.trim().toLowerCase();
  const filteredAttachVideos = attachSearchLower
    ? videos.filter((v) => (v.name || '').toLowerCase().includes(attachSearchLower))
    : videos;

  const handleDelete = () => {
    Alert.alert('Excluir treino', `Tem certeza que quer excluir "${workoutName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
          if (error) {
            Alert.alert('Erro', error.message);
          } else {
            navigation.goBack();
          }
        },
      },
    ]);
  };

  const { width: windowWidth } = useWindowDimensions();
  // largura do conteúdo dentro do card: tela - padding do container (20*2) - padding da área expandida (14*2)
  const pageWidth = windowWidth - 68;

  // Monta a lista de "páginas" arrastáveis de um exercício: a principal + os substitutos
  // cadastrados pra esse aluno.
  const buildPages = (item) => {
    const mainPage = {
      key: 'main',
      isSubstitute: false,
      exercise: item.exercises,
      target_sets: item.target_sets,
      target_reps: item.target_reps,
      target_reps_detail: item.target_reps_detail,
      drop_last: item.drop_last,
      drop_note: item.drop_note,
      instructions: item.exercises?.instructions,
      tip: item.exercises?.tip,
    };
    const subPages = (item.workout_exercise_substitutes || []).map((s) => ({
      key: s.substitute_exercise_id,
      isSubstitute: true,
      exercise: s.exercises,
      target_sets: s.target_sets || item.target_sets,
      target_reps: s.target_reps || item.target_reps,
      target_reps_detail: s.target_reps_detail,
      drop_last: s.drop_last,
      drop_note: s.drop_note,
      instructions: s.instructions || s.exercises?.instructions,
      tip: s.exercises?.tip,
    }));
    return [mainPage, ...subPages];
  };

  // Renderiza o conteúdo de UMA página (principal ou substituto) dentro do card expandido.
  // Anexar/trocar vídeo e editar "como executar"/"dica" só ficam disponíveis na página
  // principal — pra editar um substituto, o personal usa a tela de montar o treino.
  const renderExercisePage = (page, item, idx) => {
    const isMain = !page.isSubstitute;
    const repsList = page.target_reps_detail
      ? page.target_reps_detail.split(',').map((s) => s.trim())
      : Array.from({ length: page.target_sets || 1 }, () => String(page.target_reps ?? '-'));
    const isDropSet = !!page.drop_last;
    const doneCount = isMain ? (doneSets[item.id] || new Set()).size : 0;

    return (
      <View style={{ width: pageWidth }}>
        {page.exercise?.video_id ? (
          <View style={styles.videoSection}>
            {!isMain && (
              <View style={styles.videoSectionLabelRow}>
                <Feather name="play-circle" size={13} color={colors.accent} />
                <Text style={styles.videoSectionLabel}>Vídeo · {page.exercise?.name}</Text>
              </View>
            )}
            <InlineDemoVideo videoId={page.exercise.video_id} />
          </View>
        ) : isMain ? (
          <TouchableOpacity
            style={[styles.videoCard, styles.videoCardCenter, styles.videoCardEmptyTap]}
            onPress={() => setAttachTarget({ exerciseId: item.exercises.id, name: item.exercises.name })}
          >
            <Feather name="video" size={20} color={colors.accent} />
            <Text style={styles.videoCardEmptyLink}>Sem vídeo · tocar pra anexar</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.videoCard, styles.videoCardCenter]}>
            <Feather name="video-off" size={20} color={colors.textDim2} />
            <Text style={styles.videoCardEmptyText}>Esse substituto ainda não tem vídeo.</Text>
          </View>
        )}

        <View style={styles.tracker}>
          <View style={styles.trackerHead}>
            <Text style={styles.trackerLabel}>{isMain ? 'Séries' : 'Séries deste substituto'}</Text>
            <View style={styles.trackerBadge}>
              <Text style={styles.trackerBadgeText}>
                {isMain ? `${doneCount}/${repsList.length}` : `${repsList.length} séries`}
              </Text>
            </View>
          </View>
          <View style={styles.sets}>
            {repsList.map((reps, i) => {
              const isLast = i === repsList.length - 1;
              const isDrop = isLast && isDropSet;
              const done = isMain && (doneSets[item.id] || new Set()).has(i);
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={isMain ? 0.7 : 1}
                  disabled={!isMain}
                  style={[
                    styles.setPill,
                    done && styles.setPillDone,
                    isDrop && !done && styles.setPillDrop,
                    !isMain && styles.setPillReadOnly,
                  ]}
                  onPress={isMain ? () => toggleSetDone(item.id, i) : undefined}
                >
                  <Text style={[styles.setPillN, done && styles.setPillTextDone]}>
                    {isDrop ? 'DROP' : `SÉRIE ${i + 1}`}
                  </Text>
                  {!isDrop && (
                    <>
                      <Text style={[styles.setPillReps, done && styles.setPillTextDone]}>{reps}</Text>
                      <Text style={[styles.setPillUnit, done && styles.setPillTextDone]}>reps</Text>
                    </>
                  )}
                  {isDrop && (
                    <Feather name="zap" size={14} color={done ? '#06251b' : colors.amber} style={{ marginTop: 2 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {isDropSet && (
            <View style={styles.dropExplainBox}>
              <Feather name="zap" size={12} color={colors.amber} />
              <Text style={styles.dropExplainText}>
                {page.drop_note
                  ? page.drop_note
                  : 'Drop set na última série — o personal ainda não descreveu como funciona.'}
              </Text>
            </View>
          )}
        </View>

        {isMain && item.rest_seconds ? (
          <View style={styles.restRow}>
            <Feather name="clock" size={13} color={colors.textDim} />
            <Text style={styles.restText}>
              Descanso entre séries:{' '}
              <Text style={styles.restValue}>
                {item.rest_seconds >= 60
                  ? `${Math.floor(item.rest_seconds / 60)} min${item.rest_seconds % 60 > 0 ? ` ${item.rest_seconds % 60} seg` : ''}`
                  : `${item.rest_seconds} segundos`}
              </Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionHeading}>Como executar</Text>
            {isMain && (
              <TouchableOpacity
                onPress={() => startEditingField(item.exercises.id, 'instructions', item.exercises.instructions)}
              >
                <Feather name="edit-3" size={14} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>
          {page.instructions ? (
            <Text style={styles.instructionsText}>{page.instructions}</Text>
          ) : (
            <Text style={styles.emptyFieldText}>
              {isMain ? 'Nenhuma instrução cadastrada ainda. Toca no lápis pra escrever.' : 'Nenhuma instrução cadastrada ainda.'}
            </Text>
          )}
        </View>

        <View style={[styles.tip, !page.tip && styles.tipEmpty]}>
          <Feather name="zap" size={16} color={page.tip ? colors.accent : colors.textFaint} />
          <View style={{ flex: 1 }}>
            {page.tip ? (
              <Text style={styles.tipText}>
                <Text style={styles.tipTextBold}>Dica do professor: </Text>
                {page.tip}
              </Text>
            ) : (
              <Text style={styles.emptyFieldText}>Nenhuma dica cadastrada ainda.</Text>
            )}
          </View>
          {isMain && (
            <TouchableOpacity onPress={() => startEditingField(item.exercises.id, 'tip', item.exercises.tip)}>
              <Feather name="edit-3" size={14} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Treinos de {studentName}</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>{workoutName}</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('CreateWorkoutForStudent', { studentId, studentName, workoutId, workoutName })
          }
        >
          <Text style={styles.editLink}>Editar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        {items.length === 0 && <Text style={styles.empty}>Nenhum exercício nesse treino.</Text>}

        {items.map((item, idx) => {
          const isExpanded = expandedId === item.id;
          const repsList = item.target_reps_detail
            ? item.target_reps_detail.split(',').map((s) => s.trim())
            : Array.from({ length: item.target_sets || 1 }, () => String(item.target_reps));
          const isDropSet = !!item.drop_last;
          const doneCount = (doneSets[item.id] || new Set()).size;

          const summaryReps = isDropSet
            ? [...repsList.slice(0, -1), 'drop'].join(', ')
            : repsList.join(', ');

          return (
            <View key={item.id} style={[styles.card, isExpanded && styles.cardExpanded]}>
              <TouchableOpacity style={styles.cardMain} activeOpacity={0.8} onPress={() => toggleExpand(item)}>
                <View style={styles.cardIcon}>
                  <Feather name="zap" size={17} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{item.exercises.name}</Text>
                  <Text style={styles.exerciseDetail}>
                    {item.target_reps_detail
                      ? `${item.target_sets} séries: ${summaryReps} reps`
                      : `${item.target_sets} séries x ${item.target_reps} reps`}{' '}
                    · {item.exercises.muscle_group}
                  </Text>
                  {item.progression_note ? (
                    <Text style={styles.progressionNote}>↗ {item.progression_note}</Text>
                  ) : null}
                </View>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textDim} />
              </TouchableOpacity>
              {!isExpanded && (item.workout_exercise_substitutes || []).length > 0 ? (
                <View style={styles.subCountChip}>
                  <Feather name="repeat" size={11} color={colors.accent} />
                  <Text style={styles.subCountChipText}>{item.workout_exercise_substitutes.length}</Text>
                </View>
              ) : null}
              {item.exercises.video_id ? (
                <TouchableOpacity style={styles.manageButton} onPress={() => manageVideo(item)}>
                  <Feather name="more-vertical" size={18} color={colors.textDim} />
                </TouchableOpacity>
              ) : null}

              {isExpanded && (() => {
                const pages = buildPages(item);
                const hasSubstitutes = pages.length > 1;
                const activePage = substitutePage[item.id] || 0;

                return (
                  <View style={styles.expandedArea}>
                    {hasSubstitutes && (
                      <View style={styles.subHeaderRow}>
                        <Text style={styles.subHeaderLabel}>
                          {activePage === 0
                            ? 'Exercício principal'
                            : `Substituto ${activePage} de ${pages.length - 1} · ${pages[activePage].exercise?.name}`}
                        </Text>
                        <View style={styles.dotsRow}>
                          {pages.map((p, i) => (
                            <View key={p.key} style={[styles.dot, i === activePage && styles.dotActive]} />
                          ))}
                        </View>
                      </View>
                    )}

                    {hasSubstitutes ? (
                      <FlatList
                        data={pages}
                        keyExtractor={(p) => p.key}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        initialScrollIndex={activePage}
                        getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
                        onMomentumScrollEnd={(e) => {
                          const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
                          setSubstitutePage((prev) => ({ ...prev, [item.id]: i }));
                        }}
                        renderItem={({ item: page }) => renderExercisePage(page, item, idx)}
                      />
                    ) : (
                      renderExercisePage(pages[0], item, idx)
                    )}

                    {hasSubstitutes && (
                      <View style={styles.swipeHint}>
                        <Feather name="chevrons-left" size={12} color={colors.textFaint} />
                        <Text style={styles.swipeHintText}>Arraste pro lado pra ver os substitutos</Text>
                        <Feather name="chevrons-right" size={12} color={colors.textFaint} />
                      </View>
                    )}

                    {/* Nav: prev / collapse / next (troca de exercício, não de página) */}
                    <View style={styles.exnav}>
                      <TouchableOpacity
                        style={[styles.navSide, idx === 0 && styles.navSideDisabled]}
                        disabled={idx === 0}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setExpandedId(items[idx - 1].id);
                        }}
                      >
                        <Feather name="chevron-left" size={16} color={idx === 0 ? colors.textFaint : colors.textDim} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.navMain} onPress={() => toggleExpand(item)}>
                        <Text style={styles.navMainText}>Recolher</Text>
                        <Feather name="chevron-up" size={16} color="#06251b" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.navSide, idx === items.length - 1 && styles.navSideDisabled]}
                        disabled={idx === items.length - 1}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setExpandedId(items[idx + 1].id);
                        }}
                      >
                        <Feather
                          name="chevron-right"
                          size={16}
                          color={idx === items.length - 1 ? colors.textFaint : colors.textDim}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
        <Text style={styles.deleteButtonText}>Excluir treino</Text>
      </TouchableOpacity>

      <Modal visible={!!attachTarget} transparent animationType="slide" onRequestClose={() => setAttachTarget(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Vídeo para "{attachTarget?.name}"</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Buscar vídeo pelo nome"
              placeholderTextColor={colors.textDim2}
              value={attachSearch}
              onChangeText={setAttachSearch}
              autoFocus
            />
            <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
              {filteredAttachVideos.length === 0 ? (
                <Text style={styles.modalEmpty}>Nenhum vídeo encontrado.</Text>
              ) : (
                filteredAttachVideos.map((v) => (
                  <TouchableOpacity key={v.id} style={styles.modalVideoRow} onPress={() => attachVideo(v)}>
                    <Feather name="film" size={14} color={colors.accent} />
                    <Text style={styles.modalVideoText}> {v.name}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => {
                const target = attachTarget;
                setAttachTarget(null);
                navigation.navigate('UploadVideo', {
                  exerciseId: target?.exerciseId,
                  exerciseName: target?.name,
                });
              }}
            >
              <Text style={styles.uploadLink}>+ Enviar vídeo novo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setAttachTarget(null)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Editar "Como executar" ou "Dica do professor" de um exercício (fica salvo pra
          todo mundo que usa esse exercício, já que instructions/tip vivem na tabela exercises) */}
      <Modal visible={!!editingField} transparent animationType="slide" onRequestClose={() => setEditingField(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingField?.field === 'tip' ? 'Dica do professor' : 'Como executar'}
            </Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]}
              placeholder={
                editingField?.field === 'tip'
                  ? 'Ex: mantenha as escápulas retraídas o tempo todo...'
                  : 'Ex: Deite no banco com os pés firmes no chão...'
              }
              placeholderTextColor={colors.textDim2}
              value={editingValue}
              onChangeText={setEditingValue}
              multiline
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.editSaveButton, { flex: 1, backgroundColor: colors.surface3 }]}
                onPress={() => setEditingField(null)}
              >
                <Text style={[styles.editSaveButtonText, { color: colors.textDim }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editSaveButton, { flex: 1 }]} onPress={saveEditingField} disabled={savingField}>
                <Text style={styles.editSaveButtonText}>{savingField ? '...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, flex: 1 },
  editLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 1,
    marginBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardExpanded: {
    borderColor: colors.accentDark,
    backgroundColor: colors.surface2,
  },
  cardMain: {
    flex: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButton: { paddingHorizontal: 14, paddingVertical: 14 },
  subCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'center',
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.3)',
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginRight: 6,
  },
  subCountChipText: { color: colors.accent, fontSize: 10.5, fontWeight: '700' },
  exerciseName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  exerciseDetail: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  progressionNote: { color: colors.amber, fontSize: 11.5, marginTop: 3, fontWeight: '600' },

  // ----- área expandida (equivalente ao redesign em HTML) -----
  expandedArea: {
    width: '100%',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  // Header do pager de substitutos (mostra qual página está ativa)
  subHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  subHeaderLabel: { color: colors.textDim, fontSize: 11.5, fontWeight: '700', flex: 1 },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 14 },
  swipeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2, marginBottom: 4 },
  swipeHintText: { color: colors.textFaint, fontSize: 10.5 },
  videoSection: { marginBottom: 0 },
  videoSectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  videoSectionLabel: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
  videoCard: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: '#0c0b09',
    overflow: 'hidden',
  },
  videoCardCenter: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  videoCardEmptyTap: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface3 },
  videoCardEmptyText: { color: colors.textDim2, fontSize: 12 },
  videoCardEmptyLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  tracker: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  trackerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  trackerLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trackerBadge: {
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  trackerBadgeText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  sets: { flexDirection: 'row', gap: 8 },
  setPill: {
    flex: 1,
    aspectRatio: 1 / 1.05,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  setPillDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  setPillDrop: { backgroundColor: colors.amberGlow, borderColor: 'rgba(255,182,72,0.4)' },
  setPillN: { fontSize: 8.5, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.4 },
  setPillReps: { fontSize: 17, fontWeight: '700', color: colors.text },
  setPillUnit: { fontSize: 8, color: colors.textFaint, fontWeight: '600' },
  setPillTextDone: { color: '#06251b' },
  setPillReadOnly: { opacity: 0.55 },
  dropExplainBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dropExplainText: { color: colors.amber, fontSize: 11.5, lineHeight: 16, flex: 1 },

  section: { marginTop: 18 },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionHeading: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  instructionsText: { color: '#c7c9d1', fontSize: 13, lineHeight: 19 },
  emptyFieldText: { color: colors.textFaint, fontSize: 12.5, lineHeight: 17, fontStyle: 'italic' },

  tip: {
    marginTop: 16,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  tipEmpty: { backgroundColor: colors.surface3, borderColor: colors.border },
  tipText: { color: '#d6d8de', fontSize: 12, lineHeight: 17, flex: 1 },
  tipTextBold: { color: colors.accent, fontWeight: '700' },
  editSaveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  editSaveButtonText: { color: '#06251b', fontWeight: '700', fontSize: 14 },

  exnav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  navSide: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSideDisabled: { opacity: 0.4 },
  navMain: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  navMainText: { color: '#06251b', fontWeight: '700', fontSize: 13 },

  addVideoChip: { flexDirection: 'row', alignItems: 'center' },
  addVideoLabel: { color: colors.textDim, fontSize: 11.5 },
  deleteButton: {
    borderRadius: radius.sm,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.red,
  },
  deleteButtonText: { color: colors.red, fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxHeight: '75%',
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  modalEmpty: { color: colors.textDim, fontSize: 13, paddingVertical: 12 },
  modalVideoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalVideoText: { color: colors.text, fontSize: 14 },
  uploadLink: { color: colors.accent, fontSize: 13, marginTop: 12, marginBottom: 4, fontWeight: '600' },
  modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  modalCloseText: { color: colors.textDim, fontSize: 14 },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  restText: { color: colors.textDim, fontSize: 12.5 },
  restValue: { color: colors.text, fontWeight: '700' },
});
