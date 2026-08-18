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
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';
import InlineDemoVideo from '../components/InlineDemoVideo';
import WarmupExerciseList from '../components/WarmupExerciseList';
import { useAuth } from '../context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function StudentWorkoutDetailScreen({ route, navigation }) {
  const { workoutId, workoutName, studentId, studentName } = route.params;
  const { session } = useAuth();
  const [warmupItems, setWarmupItems] = useState([]);
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
        'id, target_sets, target_reps, target_reps_detail, progression_note, drop_last, drop_note, rest_seconds, order_index, combo_group, is_warmup, exercises(id, name, muscle_group, video_id, instructions, tip), workout_exercise_substitutes(substitute_exercise_id, target_sets, target_reps, target_reps_detail, drop_last, drop_note, instructions, exercises:substitute_exercise_id(id, name, muscle_group, video_id, instructions, tip))'
      )
      .eq('workout_id', workoutId)
      .order('order_index');
    const allData = data || [];
    setWarmupItems(allData.filter((it) => it.is_warmup));
    setItems(allData.filter((it) => !it.is_warmup));
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
          // Cascata: substitutos → exercises → logs → workout
          const { data: weRows } = await supabase
            .from('workout_exercises')
            .select('id')
            .eq('workout_id', workoutId);
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
            .eq('workout_id', workoutId);
          if (weErr) {
            Alert.alert('Erro ao apagar exercícios', weErr.message);
            return;
          }

          await supabase.from('workout_logs').delete().eq('workout_id', workoutId);

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
          <View style={[styles.videoSection, { alignItems: 'center' }]}>
            {!isMain && (
              <View style={styles.videoSectionBanner}>
                <Feather name="play-circle" size={s(14)} color={colors.accent} />
                <Text style={styles.videoSectionBannerText}>Vídeo demonstrativo</Text>
                <Text style={styles.videoSectionBannerName} numberOfLines={1}>{page.exercise?.name}</Text>
              </View>
            )}
            <View style={{ width: '100%', alignSelf: 'stretch' }}>
              <InlineDemoVideo videoId={page.exercise.video_id} />
            </View>
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

        <View style={[styles.tracker, { marginHorizontal: s(14) }]}>
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
          <View style={[styles.restRow, { marginHorizontal: s(14) }]}>
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

        <View style={[styles.section, { marginHorizontal: s(14) }]}>
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

        <View style={[styles.tip, !page.tip && styles.tipEmpty, { marginHorizontal: s(14) }]}>
          <Feather name="zap" size={16} color={page.tip ? colors.accent : colors.textFaint} />
          <View style={{ flex: 1 }}>
            {page.tip ? (
              <Text style={styles.tipText}>
                <Text style={styles.tipTextBold}>Dica do professor: </Text>
                {page.tip}
              </Text>
            ) : (
              <Text style={styles.emptyFieldText}>Nenhuma dica cadastrada ainda. Toca no lápis pra escrever.</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() =>
              startEditingField(
                page.exercise?.id,
                'tip',
                page.tip,
              )
            }
          >
            <Feather name="edit-3" size={14} color={colors.textDim} />
          </TouchableOpacity>
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
        {warmupItems.length > 0 && (
          <WarmupExerciseList
            items={warmupItems}
            isPersonal={true}
            workoutId={workoutId}
            onReload={load}
          />
        )}
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

          // Parceiros combinados para o badge do card recolhido
          const comboPartners = item.combo_group
            ? items.filter((e) => e.combo_group === item.combo_group && e.id !== item.id)
            : [];
          const hasSubstitutes = (item.workout_exercise_substitutes || []).length > 0;
          const hasVideo = !!item.exercises.video_id;

          return (
            <View key={item.id} style={[styles.card, isExpanded && styles.cardExpanded]}>

              {/* ── CARD RECOLHIDO ── */}
              <TouchableOpacity
                style={styles.cardMain}
                activeOpacity={0.8}
                onPress={() => toggleExpand(item)}
              >
                {/* Ícone */}
                <View style={styles.cardIcon}>
                  <Feather name="zap" size={s(17)} color={colors.accent} />
                </View>

                {/* Bloco central */}
                <View style={styles.cardCenter}>
                  {/* Linha 1: nome + chevron */}
                  <View style={styles.cardNameRow}>
                    <Text style={styles.exerciseName} numberOfLines={1}>
                      {item.exercises.name}
                    </Text>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={s(16)}
                      color={colors.textDim}
                    />
                    {hasVideo && (
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation(); manageVideo(item); }}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        style={{ paddingLeft: s(4) }}
                      >
                        <Feather name="more-vertical" size={s(16)} color={colors.textDim} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Linha 2: séries + grupo muscular */}
                  <Text style={styles.exerciseDetail} numberOfLines={1}>
                    {item.target_reps_detail
                      ? `${item.target_sets} séries: ${summaryReps} reps`
                      : `${item.target_sets} séries x ${item.target_reps} reps`}
                    {'  ·  '}{item.exercises.muscle_group}
                  </Text>

                  {/* Linha 3: chips de status (combinado, substituto, vídeo, progressão) */}
                  {!isExpanded && (
                    <View style={styles.cardTagsRow}>
                      {comboPartners.length > 0 && (
                        <View style={styles.tagCombo}>
                          <Feather name="repeat" size={s(10)} color={colors.amber} />
                          <Text style={styles.tagComboText} numberOfLines={1}>
                            {' '}com {comboPartners.map((p) => p.exercises.name).join(', ')}
                          </Text>
                        </View>
                      )}
                      {hasSubstitutes && (
                        <View style={styles.tagSub}>
                          <Feather name="refresh-cw" size={s(10)} color={colors.accent} />
                          <Text style={styles.tagSubText}>
                            {' '}{item.workout_exercise_substitutes.length} sub
                          </Text>
                        </View>
                      )}
                      {hasVideo && (
                        <View style={styles.tagVideo}>
                          <Feather name="play-circle" size={s(10)} color={colors.blue} />
                          <Text style={styles.tagVideoText}> Vídeo</Text>
                        </View>
                      )}
                      {item.progression_note ? (
                        <View style={styles.tagProg}>
                          <Text style={styles.tagProgText} numberOfLines={1}>
                            ↗ {item.progression_note}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {isExpanded && (() => {
                const pages = buildPages(item);
                const hasSubstitutes = pages.length > 1;
                const activePage = substitutePage[item.id] || 0;

                return (
                  <View style={styles.expandedArea}>
                    {/* Barra de navegação entre principal e substitutos — no topo, bem visível */}
                    {hasSubstitutes && (
                      <View style={styles.pageNavRow}>
                        <TouchableOpacity
                          style={[styles.pageNavBtn, activePage === 0 && styles.pageNavBtnDisabled]}
                          disabled={activePage === 0}
                          onPress={() => setSubstitutePage((prev) => ({ ...prev, [item.id]: activePage - 1 }))}
                        >
                          <Feather name="chevron-left" size={s(18)} color={activePage === 0 ? colors.textFaint : colors.text} />
                        </TouchableOpacity>

                        <View style={styles.pageNavCenter}>
                          <Text style={styles.pageNavLabel}>
                            {activePage === 0
                              ? '⚡  Exercício principal'
                              : `↺  Substituto ${activePage} de ${pages.length - 1}`}
                          </Text>
                          {activePage > 0 && (
                            <Text style={[styles.pageNavSubName, { color: colors.text }]} numberOfLines={1}>
                              {pages[activePage].exercise?.name}
                            </Text>
                          )}
                        </View>

                        <TouchableOpacity
                          style={[styles.pageNavBtn, activePage === pages.length - 1 && styles.pageNavBtnDisabled]}
                          disabled={activePage === pages.length - 1}
                          onPress={() => setSubstitutePage((prev) => ({ ...prev, [item.id]: activePage + 1 }))}
                        >
                          <Feather name="chevron-right" size={s(18)} color={activePage === pages.length - 1 ? colors.textFaint : colors.text} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Conteúdo da página ativa */}
                    {renderExercisePage(pages[activePage] || pages[0], item, idx)}



                    {/* Mini-card do parceiro combinado: mostra o outro exercício do combo */}
                    {item.combo_group && (() => {
                      const partner = items.find(
                        (e) => e.combo_group === item.combo_group && e.id !== item.id
                      );
                      if (!partner) return null;
                      return (
                        <View style={styles.comboPartnerCard}>
                          <View style={styles.comboPartnerHeader}>
                            <Feather name="repeat" size={s(12)} color={colors.amber} />
                            <Text style={styles.comboPartnerHeaderText}>
                              Exercício combinado — faça em sequência
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.comboPartnerRow}
                            activeOpacity={0.8}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setExpandedId(partner.id);
                            }}
                          >
                            <View style={styles.comboPartnerIcon}>
                              <Feather name="zap" size={s(15)} color={colors.amber} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.comboPartnerName}>{partner.exercises.name}</Text>
                              <Text style={styles.comboPartnerDetail}>
                                {partner.target_reps_detail
                                  ? `${partner.target_sets} séries: ${partner.target_reps_detail.split(',').join(', ')} reps`
                                  : `${partner.target_sets} séries x ${partner.target_reps} reps`}
                                {' · '}{partner.exercises.muscle_group}
                              </Text>
                            </View>
                            <Feather name="chevron-right" size={s(16)} color={colors.amber} />
                          </TouchableOpacity>
                        </View>
                      );
                    })()}

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
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(18) },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, flex: 1 },
  editLink: { color: colors.accent, fontSize: fs(12), fontWeight: '600' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(40), fontSize: fs(12) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ms(16),
    marginBottom: vs(10),
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: colors.accentDark,
    backgroundColor: colors.surface2,
    flexDirection: 'column',
  },
  // TouchableOpacity que ocupa todo o espaço exceto o botão ⋮
  cardMain: {
    flex: 1,
    padding: s(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  cardIcon: {
    width: s(40),
    height: s(40),
    borderRadius: ms(12),
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Bloco de texto central
  cardCenter: {
    flex: 1,
    minWidth: 0,
    gap: vs(3),
  },
  // Linha do nome + chevron + ⋮
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(6),
  },
  // Linha horizontal de tags/chips
  cardTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(4),
    marginTop: vs(4),
  },
  manageButton: {
    paddingHorizontal: s(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'center',
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.3)',
    borderRadius: radius.pill,
    paddingVertical: vs(3),
    paddingHorizontal: s(7),
    marginRight: 6,
  },
  subCountChipText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },

  // Tags do card recolhido
  tagCombo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberGlow,
    borderRadius: ms(6),
    paddingHorizontal: s(7),
    paddingVertical: vs(3),
  },
  tagComboText: { color: colors.amber, fontSize: fs(9), fontWeight: '700', flexShrink: 1 },
  tagSub: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    borderRadius: ms(6),
    paddingHorizontal: s(7),
    paddingVertical: vs(3),
  },
  tagSubText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  tagVideo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.blueGlow,
    borderRadius: ms(6),
    paddingHorizontal: s(7),
    paddingVertical: vs(3),
  },
  tagVideoText: { color: colors.blue, fontSize: fs(9), fontWeight: '700' },
  tagProg: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(6),
    paddingHorizontal: s(2),
    paddingVertical: vs(2),
  },
  tagProgText: { color: colors.amber, fontSize: fs(9), fontWeight: '600', flexShrink: 1 },
  exerciseName: { color: colors.text, fontSize: fs(12.5), fontWeight: '700' },
  exerciseDetail: { color: colors.textDim, fontSize: fs(10.5), marginTop: vs(2) },
  comboBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: vs(3),
  },
  comboBadgeText: {
    color: colors.amber,
    fontSize: fs(9),
    fontWeight: '700',
    flexShrink: 1,
  },

  // Mini-card do parceiro combinado (dentro do expandedArea)
  comboPartnerCard: {
    marginHorizontal: s(14),
    marginTop: vs(14),
    marginBottom: vs(4),
    borderWidth: 1,
    borderColor: colors.amber + '55',
    borderRadius: ms(12),
    backgroundColor: colors.amberGlow,
    overflow: 'hidden',
  },
  comboPartnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(12),
    paddingTop: vs(8),
    paddingBottom: vs(4),
  },
  comboPartnerHeaderText: {
    color: colors.amber,
    fontSize: fs(9),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  comboPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(12),
    paddingBottom: vs(10),
    gap: s(10),
  },
  comboPartnerIcon: {
    width: s(34),
    height: s(34),
    borderRadius: ms(10),
    backgroundColor: colors.amber + '22',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  comboPartnerName: {
    color: colors.text,
    fontSize: fs(12),
    fontWeight: '800',
  },
  comboPartnerDetail: {
    color: colors.textDim,
    fontSize: fs(10),
    marginTop: vs(2),
  },
  progressionNote: { color: colors.amber, fontSize: fs(9.5), marginTop: vs(3), fontWeight: '600' },

  // ----- área expandida (equivalente ao redesign em HTML) -----
  expandedArea: {
    width: '100%',
    paddingBottom: vs(14),
  },
  // Header do pager de substitutos (mostra qual página está ativa)
  subHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(10), paddingHorizontal: s(14) },
  subHeaderLeft: { flex: 1, marginRight: s(8) },

  // Pill "Exercício principal"
  subHeaderPillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: colors.accentGlow,
    borderRadius: ms(8),
    paddingHorizontal: s(10),
    paddingVertical: vs(5),
    alignSelf: 'flex-start',
  },
  subHeaderPillMainText: { color: colors.accent, fontSize: fs(10), fontWeight: '700' },

  // Pill "Substituto N/X · Nome"
  subHeaderPillSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: colors.amberGlow,
    borderRadius: ms(8),
    paddingHorizontal: s(10),
    paddingVertical: vs(5),
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  subHeaderPillSubLabel: { color: colors.amber, fontSize: fs(9), fontWeight: '700', flexShrink: 0 },
  subHeaderPillSubName: { color: colors.text, fontSize: fs(11), fontWeight: '800', flexShrink: 1 },

  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 14 },
  swipeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: vs(2), marginBottom: vs(4) },
  swipeHintText: { color: colors.textFaint, fontSize: fs(9) },

  // Navegação entre principal e substitutos (substituiu FlatList)
  pageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(10),
    marginBottom: vs(4),
    marginHorizontal: s(14),
    backgroundColor: colors.surface3,
    borderRadius: ms(10),
    paddingHorizontal: s(4),
    paddingVertical: vs(4),
  },
  pageNavBtn: {
    width: s(36),
    height: s(36),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(8),
    backgroundColor: colors.surface,
  },
  pageNavBtnDisabled: { opacity: 0.3 },
  pageNavLabel: { color: colors.textDim, fontSize: fs(10), fontWeight: '700' },
  videoSection: { marginBottom: vs(0), width: '100%' },
  videoSectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: vs(8) },
  videoSectionLabel: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700' },

  // Banner de vídeo no substituto — mais visível que o label anterior
  videoSectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: colors.blueGlow,
    borderRadius: ms(8),
    paddingHorizontal: s(12),
    paddingVertical: vs(6),
    marginHorizontal: s(14),
    marginBottom: vs(10),
    flexWrap: 'wrap',
  },
  videoSectionBannerText: { color: colors.blue, fontSize: fs(9), fontWeight: '700' },
  videoSectionBannerName: { color: colors.text, fontSize: fs(12), fontWeight: '800', flex: 1 },

  // Chip compacto de "Vídeo" no card recolhido
  videoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    backgroundColor: colors.blueGlow,
    borderRadius: ms(6),
    paddingHorizontal: s(7),
    paddingVertical: vs(3),
    marginRight: s(4),
  },
  videoChipText: { color: colors.blue, fontSize: fs(9), fontWeight: '700' },
  videoCard: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: '60%',
    borderRadius: 0,
    backgroundColor: '#0c0b09',
    overflow: 'hidden',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCardCenter: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  videoCardEmptyTap: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface3 },
  videoCardEmptyText: { color: colors.textDim2, fontSize: fs(10) },
  videoCardEmptyLink: { color: colors.accent, fontSize: fs(11), fontWeight: '600' },

  tracker: {
    marginTop: vs(14),
    marginHorizontal: s(14),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  trackerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(10) },
  trackerLabel: {
    color: colors.textFaint,
    fontSize: fs(9),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trackerBadge: {
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: vs(3),
    paddingHorizontal: s(9),
  },
  trackerBadgeText: { color: colors.text, fontSize: fs(9), fontWeight: '700' },
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
  setPillN: { fontSize: fs(9), fontWeight: '700', color: colors.textFaint, letterSpacing: 0.4 },
  setPillReps: { fontSize: fs(15), fontWeight: '700', color: colors.text },
  setPillUnit: { fontSize: fs(9), color: colors.textFaint, fontWeight: '600' },
  setPillTextDone: { color: '#06251b' },
  setPillReadOnly: { opacity: 0.55 },
  dropExplainBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    marginTop: vs(12),
    paddingTop: vs(12),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dropExplainText: { color: colors.amber, fontSize: fs(9.5), lineHeight: 16, flex: 1 },

  section: { marginTop: vs(14) },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(8) },
  sectionHeading: { color: colors.text, fontSize: fs(12.5), fontWeight: '700' },
  instructionsText: { color: '#c7c9d1', fontSize: fs(11), lineHeight: 19 },
  emptyFieldText: { color: colors.textFaint, fontSize: fs(10.5), lineHeight: 17, fontStyle: 'italic' },

  tip: {
    marginTop: vs(12),
    marginBottom: vs(4),
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
    borderRadius: radius.md,
    padding: s(12),
    flexDirection: 'row',
    gap: s(9),
    alignItems: 'flex-start',
  },
  tipEmpty: { backgroundColor: colors.surface3, borderColor: colors.border },
  tipText: { color: '#d6d8de', fontSize: fs(10), lineHeight: 17, flex: 1 },
  tipTextBold: { color: colors.accent, fontWeight: '700' },
  editSaveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: vs(13),
    alignItems: 'center',
    marginTop: vs(4),
  },
  editSaveButtonText: { color: '#06251b', fontWeight: '700', fontSize: fs(12) },

  exnav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: vs(18) },
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
  navMainText: { color: '#06251b', fontWeight: '700', fontSize: fs(11) },

  addVideoChip: { flexDirection: 'row', alignItems: 'center' },
  addVideoLabel: { color: colors.textDim, fontSize: fs(9.5) },
  deleteButton: {
    borderRadius: radius.sm,
    padding: 16,
    alignItems: 'center',
    marginTop: vs(12),
    borderWidth: 1,
    borderColor: colors.red,
  },
  deleteButtonText: { color: colors.red, fontWeight: '700', fontSize: fs(13) },
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
  modalTitle: { color: colors.text, fontSize: fs(14), fontWeight: '700', marginBottom: vs(12) },
  modalInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: vs(12),
    fontSize: fs(12),
  },
  modalEmpty: { color: colors.textDim, fontSize: fs(11), paddingVertical: vs(12) },
  modalVideoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: vs(12), borderBottomWidth: 1, borderBottomColor: colors.border },
  modalVideoText: { color: colors.text, fontSize: fs(12) },
  uploadLink: { color: colors.accent, fontSize: fs(11), marginTop: vs(12), marginBottom: vs(4), fontWeight: '600' },
  modalClose: { marginTop: vs(12), alignItems: 'center', paddingVertical: vs(10) },
  modalCloseText: { color: colors.textDim, fontSize: fs(12) },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: vs(10),
    paddingHorizontal: s(12),
    marginBottom: vs(14),
  },
  restText: { color: colors.textDim, fontSize: fs(10.5) },
  restValue: { color: colors.text, fontWeight: '700' },
});
