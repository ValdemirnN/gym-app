import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { insertRow } from '../lib/dataClient';
import { generateUUID } from '../utils/uuid';
import { useAuth } from '../context/AuthContext';
import { colors, radius, getMuscleColor } from '../theme/theme';
import InlineDemoVideo from '../components/InlineDemoVideo';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DAY_LABEL = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

const WEEKDAY_KEYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const todayKey = () => WEEKDAY_KEYS[new Date().getDay()];

export default function WorkoutDetailScreen({ route, navigation }) {
  const { workoutId, workoutIds: workoutIdsParam, workoutName, dayOfWeek } = route.params;
  const workoutIds = React.useMemo(() => workoutIdsParam || [workoutId], [workoutIdsParam, workoutId]);
  const primaryWorkoutId = workoutIds[0];
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [starting, setStarting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  // { [workoutExerciseId]: Set(indices) } — séries concluídas, só visual
  const [doneSets, setDoneSets] = useState({});

  const [dayChangeReason, setDayChangeReason] = useState('');
  const [showDayChangeModal, setShowDayChangeModal] = useState(false);

  const [skipReason, setSkipReason] = useState('');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const [workoutMeta, setWorkoutMeta] = useState(null);

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from('workout_exercises')
      .select(
        'id, target_sets, target_reps, target_reps_detail, target_duration_minutes, target_distance_km, target_intensity, progression_note, drop_last, drop_note, rest_seconds, order_index, combo_group, exercises(id, name, muscle_group, video_id, exercise_type, instructions, tip), workout_exercise_substitutes(substitute_exercise_id, target_sets, target_reps, target_reps_detail, drop_last, drop_note, instructions, exercises:substitute_exercise_id(id, name, muscle_group, video_id, instructions, tip))'
      )
      .in('workout_id', workoutIds)
      .order('order_index');
    setItems(data || []);

    const { data: meta } = await supabase
      .from('workouts')
      .select('level, goal, period_start, period_end')
      .eq('id', primaryWorkoutId)
      .maybeSingle();
    setWorkoutMeta(meta);
  }, [workoutIds, primaryWorkoutId]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  // Página ativa (arrastada) dentro do card de cada exercício expandido:
  // 0 = exercício principal, 1+ = cada substituto cadastrado pelo personal.
  const [substitutePage, setSubstitutePage] = useState({}); // { [workoutExerciseId]: pageIndex }

  const toggleExpand = (item) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };

  const toggleSetDone = (workoutExerciseId, setIndex) => {
    setDoneSets((prev) => {
      const current = new Set(prev[workoutExerciseId] || []);
      if (current.has(setIndex)) current.delete(setIndex);
      else current.add(setIndex);
      return { ...prev, [workoutExerciseId]: current };
    });
  };

  const createLogAndGo = async (extraFields) => {
    setStarting(true);
    const id = generateUUID();
    const { offline, error } = await insertRow('workout_logs', {
      id,
      user_id: session.user.id,
      workout_id: primaryWorkoutId,
      started_at: new Date().toISOString(),
      ...extraFields,
    });
    setStarting(false);

    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }

    if (offline) {
      Alert.alert(
        'Sem internet',
        'Sem problema — pode treinar normalmente. Assim que seu celular conectar na internet, o treino é enviado pro seu personal automaticamente.'
      );
    }

    navigation.navigate('ActiveWorkout', { logId: id, workoutName, exercises: items });
  };

  const handleIniciar = () => {
    if (dayOfWeek && dayOfWeek !== todayKey()) {
      setShowDayChangeModal(true);
      return;
    }
    createLogAndGo({});
  };

  const confirmDayChange = () => {
    if (!dayChangeReason.trim()) {
      Alert.alert('Conta pra gente', 'Escreva rapidamente por que está fazendo esse treino hoje.');
      return;
    }
    setShowDayChangeModal(false);
    const reason = dayChangeReason.trim();
    setDayChangeReason('');
    createLogAndGo({ day_change_reason: reason });
  };

  const confirmSkip = async () => {
    if (!skipReason.trim()) {
      Alert.alert('Conta pra gente', 'Escreva rapidamente o motivo de não treinar hoje.');
      return;
    }
    setSkipping(true);
    const now = new Date().toISOString();
    const { offline, error } = await insertRow('workout_logs', {
      id: generateUUID(),
      user_id: session.user.id,
      workout_id: primaryWorkoutId,
      started_at: now,
      finished_at: now,
      skipped: true,
      skip_reason: skipReason.trim(),
    });
    setSkipping(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setShowSkipModal(false);
    setSkipReason('');
    Alert.alert(
      'Tudo certo',
      offline
        ? 'Guardado no aparelho — assim que voltar a internet, seu personal vai ser avisado que você não treinou hoje.'
        : 'Avisamos seu personal que você não vai treinar hoje.'
    );
    navigation.goBack();
  };

  const groupedItems = React.useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const label =
        item.exercises.exercise_type === 'cardio' ? 'Cardio' : item.exercises.muscle_group || 'Outros';
      const color = getMuscleColor(item.exercises.muscle_group, item.exercises.exercise_type);
      if (!map.has(label)) map.set(label, { label, color, exercises: [] });
      map.get(label).exercises.push(item);
    });
    return Array.from(map.values());
  }, [items]);

  // Flat list of all items in order, used for prev/next navigation inside expanded card
  const allItems = React.useMemo(() => items, [items]);

  const { width: windowWidth } = useWindowDimensions();
  // largura do conteúdo dentro do card: tela - margem do card (20*2) - padding da área expandida (14*2)
  const pageWidth = windowWidth - 68;

  // Monta a lista de "páginas" arrastáveis de um exercício: a principal + os substitutos
  // que o personal cadastrou pra ele. Cada página tem tudo que precisa pra se auto-renderizar.
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

  // Renderiza o conteúdo de UMA página (principal ou substituto) dentro do card expandido:
  // tracker de séries, vídeo embutido, descanso, "como executar" e dica.
  const renderExercisePage = (page, item, idx) => {
    const isMain = !page.isSubstitute;
    const repsList = page.target_reps_detail
      ? page.target_reps_detail.split(',').map((s) => s.trim())
      : Array.from({ length: page.target_sets || 1 }, () => String(page.target_reps ?? '-'));
    const isDropSet = !!page.drop_last;
    const doneCount = isMain ? (doneSets[item.id] || new Set()).size : 0;

    return (
      <View style={{ width: pageWidth }}>
        {page.exercise?.exercise_type !== 'cardio' && (
          <View style={styles.tracker}>
            <View style={styles.trackerHead}>
              <Text style={styles.trackerLabel}>{isMain ? 'Séries de hoje' : 'Séries deste substituto'}</Text>
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
                    {done && <Feather name="check" size={10} color="#06251b" style={{ marginTop: 1 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            {isDropSet && (
              <View style={styles.dropExplainBox}>
                <Feather name="zap" size={12} color={colors.amber} />
                <Text style={styles.dropExplainText}>
                  {page.drop_note ? page.drop_note : 'Drop set na última série — consulte seu personal para mais detalhes.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Vídeo embutido direto no card — sem trocar de tela */}
        {page.exercise?.video_id ? (
          <View style={styles.videoSection}>
            <View style={styles.videoSectionLabelRow}>
              <Feather name="play-circle" size={13} color={colors.accent} />
              <Text style={styles.videoSectionLabel}>
                {isMain ? 'Vídeo de demonstração' : `Vídeo · ${page.exercise?.name}`}
              </Text>
            </View>
            <InlineDemoVideo videoId={page.exercise.video_id} />
          </View>
        ) : null}

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

        {page.instructions ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Como executar</Text>
            <Text style={styles.instructionsText}>{page.instructions}</Text>
          </View>
        ) : null}

        {page.tip ? (
          <View style={styles.tip}>
            <Feather name="zap" size={16} color={colors.accent} />
            <Text style={styles.tipText}>
              <Text style={styles.tipTextBold}>Dica do professor: </Text>
              {page.tip}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderExerciseCard = (item, group, idx) => {
    const isExpanded = expandedId === item.id;
    const repsList = item.target_reps_detail
      ? item.target_reps_detail.split(',').map((s) => s.trim())
      : Array.from({ length: item.target_sets || 1 }, () => String(item.target_reps));
    const isDropSet = !!item.drop_last;
    const doneCount = (doneSets[item.id] || new Set()).size;
    const totalSets = repsList.length;

    // Progress ring values (0-1)
    const progress = totalSets > 0 ? doneCount / totalSets : 0;

    return (
      <View key={item.id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: group.color }, isExpanded && styles.cardExpanded]}>
        {/* ── Collapsed header ─────────────────────────── */}
        <TouchableOpacity style={styles.cardMain} activeOpacity={0.8} onPress={() => toggleExpand(item)}>
          <View style={[styles.cardIcon, { backgroundColor: group.color + '26' }]}>
            <Feather name={item.exercises.exercise_type === 'cardio' ? 'heart' : 'zap'} size={17} color={group.color} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName}>{item.exercises.name}</Text>
            <Text style={styles.exerciseDetail}>
              {item.exercises.exercise_type === 'cardio'
                ? [
                    item.target_duration_minutes ? `${item.target_duration_minutes} min` : null,
                    item.target_distance_km ? `${item.target_distance_km} km` : null,
                    item.target_intensity ? `intensidade ${item.target_intensity}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Cardio'
                : item.target_reps_detail
                ? `${item.target_sets} séries: ${item.target_reps_detail.split(',').join(', ')} reps`
                : `${item.target_sets} séries x ${item.target_reps} reps`}
            </Text>
            {item.progression_note ? (
              <Text style={styles.progressionNote}>↗ {item.progression_note}</Text>
            ) : null}
          </View>

          {/* Series progress ring (compact, shown when any sets done) */}
          {doneCount > 0 && !isExpanded ? (
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{doneCount}/{totalSets}</Text>
            </View>
          ) : null}

          {/* Chip de substitutos disponíveis (só quando recolhido) */}
          {!isExpanded && (item.workout_exercise_substitutes || []).length > 0 ? (
            <View style={styles.subCountChip}>
              <Feather name="repeat" size={11} color={colors.accent} />
              <Text style={styles.subCountChipText}>{item.workout_exercise_substitutes.length}</Text>
            </View>
          ) : null}

          {/* Video thumb or expand chevron */}
          {item.exercises.video_id && !isExpanded ? (
            <TouchableOpacity
              style={styles.videoThumb}
              onPress={(e) => { e.stopPropagation(); toggleExpand(item); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.videoThumbPlay}>
                <Feather name="play" size={13} color="#08110A" />
              </View>
              <Text style={styles.videoThumbLabel}>Ver vídeo</Text>
            </TouchableOpacity>
          ) : !isExpanded ? (
            <View style={styles.videoThumbEmpty}>
              <Feather name="video-off" size={14} color={colors.textDim2} />
            </View>
          ) : null}

          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textDim} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* ── Expanded area ─────────────────────────────── */}
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
                    setExpandedId(allItems[idx - 1].id);
                  }}
                >
                  <Feather name="chevron-left" size={16} color={idx === 0 ? colors.textFaint : colors.textDim} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navMain} onPress={() => toggleExpand(item)}>
                  <Text style={styles.navMainText}>Recolher</Text>
                  <Feather name="chevron-up" size={16} color="#06251b" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navSide, idx === allItems.length - 1 && styles.navSideDisabled]}
                  disabled={idx === allItems.length - 1}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpandedId(allItems[idx + 1].id);
                  }}
                >
                  <Feather name="chevron-right" size={16} color={idx === allItems.length - 1 ? colors.textFaint : colors.textDim} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={18} color={colors.textDim} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {dayOfWeek ? <Text style={styles.eyebrow}>{DAY_LABEL[dayOfWeek] || dayOfWeek}</Text> : null}
          <Text style={styles.title}>{workoutName}</Text>
          {(workoutMeta?.goal || workoutMeta?.level) && (
            <Text style={styles.metaLabel}>{[workoutMeta?.goal, workoutMeta?.level].filter(Boolean).join(' · ')}</Text>
          )}
        </View>
      </View>

      <FlatList
        data={groupedItems}
        keyExtractor={(g) => g.label}
        contentContainerStyle={{ paddingBottom: 12 }}
        renderItem={({ item: group }) => (
          <View>
            <View style={styles.groupLabelRow}>
              <View style={[styles.groupDot, { backgroundColor: group.color }]} />
              <Text style={styles.groupLabelText}>{group.label}</Text>
              <View style={styles.groupLine} />
            </View>
            {group.exercises.map((item) => {
              const globalIdx = allItems.findIndex((ex) => ex.id === item.id);
              return renderExerciseCard(item, group, globalIdx);
            })}
          </View>
        )}
      />

      <View style={styles.bottombar}>
        <TouchableOpacity style={styles.startButton} onPress={handleIniciar} disabled={starting} activeOpacity={0.85}>
          <Feather name="play" size={16} color="#08110A" />
          <Text style={styles.startButtonText}>{starting ? 'Abrindo...' : 'Iniciar Treino'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipDayButton} onPress={() => setShowSkipModal(true)}>
          <Text style={styles.skipDayButtonText}>Não vou treinar hoje</Text>
        </TouchableOpacity>
      </View>

      {/* Modal: justificar troca do dia do treino */}
      <Modal visible={showDayChangeModal} transparent animationType="slide" onRequestClose={() => setShowDayChangeModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Esse treino é de {DAY_LABEL[dayOfWeek] || dayOfWeek}</Text>
            <Text style={styles.modalSubtitle}>
              Sem problema fazer hoje. Só escreva rapidinho o motivo pro seu personal entender.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: não pude ir na academia na quarta, vou repor hoje"
              placeholderTextColor={colors.textDim2}
              value={dayChangeReason}
              onChangeText={setDayChangeReason}
              multiline
              autoFocus
            />
            <TouchableOpacity style={styles.modalConfirm} onPress={confirmDayChange} disabled={starting}>
              <Text style={styles.modalConfirmText}>{starting ? 'Abrindo...' : 'Continuar e iniciar treino'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowDayChangeModal(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: justificar que não vai treinar hoje */}
      <Modal visible={showSkipModal} transparent animationType="slide" onRequestClose={() => setShowSkipModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Por que não vai treinar hoje?</Text>
            <Text style={styles.modalSubtitle}>
              Isso ajuda seu personal a entender e ajustar seu treino se precisar (ex: dor, imprevisto, deficiência momentânea).
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Escreva o motivo"
              placeholderTextColor={colors.textDim2}
              value={skipReason}
              onChangeText={setSkipReason}
              multiline
              autoFocus
            />
            <TouchableOpacity style={[styles.modalConfirm, styles.modalConfirmDanger]} onPress={confirmSkip} disabled={skipping}>
              <Text style={styles.modalConfirmText}>{skipping ? 'Enviando...' : 'Confirmar que não vou treinar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowSkipModal(false)}>
              <Text style={styles.modalCloseText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 60 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, marginBottom: 14 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  eyebrow: { color: colors.textDim2, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  metaLabel: { color: colors.textDim2, fontSize: 11.5, marginTop: 4 },

  groupLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabelText: { color: colors.textDim, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  groupLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // ── Card ───────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 1,
    marginHorizontal: 20,
    marginBottom: 9,
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: colors.accentDark,
    backgroundColor: colors.surface2,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 14,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exerciseName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  exerciseDetail: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  progressionNote: { color: colors.amber, fontSize: 12, marginTop: 4, fontWeight: '600', lineHeight: 17 },

  progressBadge: {
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accentDark,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 4,
  },
  progressBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },

  subCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.3)',
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginRight: 4,
  },
  subCountChipText: { color: colors.accent, fontSize: 10.5, fontWeight: '700' },

  videoThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  videoThumbPlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  videoThumbLabel: { color: colors.accent, fontSize: 8.5, fontWeight: '700', marginTop: 4 },
  videoThumbEmpty: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Expanded area ──────────────────────────────────────
  expandedArea: {
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

  // Vídeo embutido dentro do card (sem trocar de tela)
  videoSection: { marginBottom: 12 },
  videoSectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  videoSectionLabel: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },

  // Series tracker
  tracker: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
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
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setPill: {
    flex: 1,
    minWidth: 60,
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

  // Instructions & tip
  section: { marginTop: 4, marginBottom: 12 },
  sectionHeading: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  instructionsText: { color: '#c7c9d1', fontSize: 13, lineHeight: 19 },
  tip: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)',
    borderRadius: radius.md,
    padding: 12,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  tipText: { color: '#d6d8de', fontSize: 12, lineHeight: 17, flex: 1 },
  tipTextBold: { color: colors.accent, fontWeight: '700' },

  // Prev/next nav
  exnav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
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

  // Bottom bar
  bottombar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  startButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: colors.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  startButtonText: { color: '#04170F', fontWeight: '700', fontSize: 16 },
  skipDayButton: { alignItems: 'center', paddingVertical: 14 },
  skipDayButtonText: { color: colors.textDim, fontSize: 13, textDecorationLine: 'underline' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalSubtitle: { color: colors.textDim, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  modalInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalConfirm: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 14, alignItems: 'center' },
  modalConfirmDanger: { backgroundColor: colors.red },
  modalConfirmText: { color: '#04170F', fontWeight: '700', fontSize: 15 },
  modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
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
    marginBottom: 12,
  },
  restText: { color: colors.textDim, fontSize: 12.5 },
  restValue: { color: colors.text, fontWeight: '700' },
});
