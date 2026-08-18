/**
 * WorkoutDetailScreen — Visão do Aluno (Somente Leitura)
 *
 * Refatorações principais:
 * 1. Toggle Principal/Alt totalmente reformulado: ao trocar de aba, o nome do
 *    exercício no topo do card muda imediatamente com fade animado.
 * 2. Tela estritamente somente leitura: nenhum botão de edição, anexar vídeo,
 *    remover ou qualquer ação de escrita. O aluno só visualiza e marca séries.
 * 3. Tipos e estado limpos: `ExercisePage` descreve claramente a união
 *    Principal + Substituto, sem ambiguidade.
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  FlatList,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { insertRow } from '../lib/dataClient';
import { generateUUID } from '../utils/uuid';
import { useAuth } from '../context/AuthContext';
import { colors, radius, getMuscleColor } from '../theme/theme';
import { s, vs, ms, fs, screenPaddingH, screenPaddingTop } from '../utils/responsive';
import InlineDemoVideo from '../components/InlineDemoVideo';
import WarmupExerciseList from '../components/WarmupExerciseList';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Tipos internos ────────────────────────────────────────────────────────────
/**
 * @typedef {Object} ExercisePage
 * @property {'main'|string}  key              - 'main' ou substitute_exercise_id
 * @property {boolean}        isSubstitute
 * @property {string}         label            - 'Principal' | 'Alt 1', 'Alt 2'…
 * @property {Object}         exercise         - linha da tabela exercises
 * @property {number}         target_sets
 * @property {string|null}    target_reps_detail
 * @property {number|null}    target_reps
 * @property {boolean}        drop_last
 * @property {string|null}    drop_note
 * @property {string|null}    instructions
 * @property {string|null}    rest_seconds     - só existe na página principal
 */

// ─── Constantes ───────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Monta a lista tipada de páginas de um exercício.
 * @param {Object} item - linha de workout_exercises com joins
 * @returns {ExercisePage[]}
 */
function buildPages(item) {
  const main = {
    key: 'main',
    isSubstitute: false,
    label: 'Principal',
    exercise: item.exercises,
    target_sets: item.target_sets,
    target_reps: item.target_reps,
    target_reps_detail: item.target_reps_detail,
    drop_last: item.drop_last,
    drop_note: item.drop_note,
    instructions: item.exercises?.instructions,
    rest_seconds: item.rest_seconds,
  };

  const subs = (item.workout_exercise_substitutes || []).map((sub, i) => ({
    key: sub.substitute_exercise_id,
    isSubstitute: true,
    label: `Alt ${i + 1}`,
    exercise: sub.exercises,
    target_sets: sub.target_sets ?? item.target_sets,
    target_reps: sub.target_reps ?? item.target_reps,
    target_reps_detail: sub.target_reps_detail ?? null,
    drop_last: sub.drop_last ?? false,
    drop_note: sub.drop_note ?? null,
    instructions: sub.instructions ?? sub.exercises?.instructions ?? null,
    rest_seconds: null,
  }));

  return [main, ...subs];
}

/**
 * Expande target_reps_detail ou gera array uniforme.
 * @param {ExercisePage} page
 * @returns {string[]}
 */
function getRepsList(page) {
  if (page.target_reps_detail) {
    return page.target_reps_detail.split(',').map((r) => r.trim());
  }
  return Array.from(
    { length: page.target_sets || 1 },
    () => String(page.target_reps ?? '-')
  );
}

// ─── Sub-componente: Nome do exercício com fade ao trocar ─────────────────────
function AnimatedExerciseName({ name, style }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const prevName = useRef(name);

  React.useEffect(() => {
    if (prevName.current !== name) {
      prevName.current = name;
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [name, opacity]);

  return (
    <Animated.Text style={[style, { opacity }]} numberOfLines={2}>
      {name}
    </Animated.Text>
  );
}

// ─── Sub-componente: Conteúdo de uma página (Principal ou Alt) ────────────────
function ExercisePageContent({ page, workoutExerciseId, doneSets, onToggleSet }) {
  const repsList = getRepsList(page);
  const isDropSet = !!page.drop_last;
  const doneSet = doneSets[workoutExerciseId] || new Set();

  return (
    <View>
      {/* Vídeo demonstrativo */}
      {page.exercise?.video_id ? (
        <View style={contentStyles.videoWrap}>
          <InlineDemoVideo videoId={page.exercise.video_id} />
        </View>
      ) : (
        <View style={contentStyles.videoEmpty}>
          <Feather name="video-off" size={s(20)} color={colors.textDim2} />
          <Text style={contentStyles.videoEmptyText}>Sem vídeo demonstrativo</Text>
        </View>
      )}

      {/* Descanso entre séries (só no Principal) */}
      {!page.isSubstitute && page.rest_seconds ? (
        <View style={contentStyles.restRow}>
          <Feather name="clock" size={s(13)} color={colors.textDim} />
          <Text style={contentStyles.restText}>
            Descanso:{' '}
            <Text style={contentStyles.restValue}>
              {page.rest_seconds >= 60
                ? `${Math.floor(page.rest_seconds / 60)}min${
                    page.rest_seconds % 60 > 0 ? ` ${page.rest_seconds % 60}s` : ''
                  }`
                : `${page.rest_seconds}s`}
            </Text>
          </Text>
        </View>
      ) : null}

      {/* Tracker de séries */}
      <View style={contentStyles.tracker}>
        <View style={contentStyles.trackerHead}>
          <Text style={contentStyles.trackerLabel}>Séries</Text>
          <View style={contentStyles.trackerBadge}>
            <Text style={contentStyles.trackerBadgeText}>
              {doneSet.size}/{repsList.length}
            </Text>
          </View>
        </View>

        <View style={contentStyles.setsRow}>
          {repsList.map((reps, i) => {
            const isLast = i === repsList.length - 1;
            const isDrop = isLast && isDropSet;
            const done = doneSet.has(i);
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                style={[
                  contentStyles.setPill,
                  done && contentStyles.setPillDone,
                  isDrop && !done && contentStyles.setPillDrop,
                ]}
                onPress={() => onToggleSet(i)}
              >
                <Text style={[contentStyles.setPillN, done && contentStyles.setPillTextDone]}>
                  {isDrop ? 'DROP' : `SÉRIE ${i + 1}`}
                </Text>
                {!isDrop && (
                  <>
                    <Text style={[contentStyles.setPillReps, done && contentStyles.setPillTextDone]}>
                      {reps}
                    </Text>
                    <Text style={[contentStyles.setPillUnit, done && contentStyles.setPillTextDone]}>
                      reps
                    </Text>
                  </>
                )}
                {isDrop && (
                  <Feather
                    name="zap"
                    size={s(14)}
                    color={done ? '#06251b' : colors.amber}
                    style={{ marginTop: vs(2) }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {isDropSet && page.drop_note && (
          <View style={contentStyles.dropNote}>
            <Feather name="zap" size={s(12)} color={colors.amber} />
            <Text style={contentStyles.dropNoteText}>{page.drop_note}</Text>
          </View>
        )}
      </View>

      {/* Como executar */}
      {page.instructions ? (
        <View style={contentStyles.section}>
          <Text style={contentStyles.sectionTitle}>Como executar</Text>
          <Text style={contentStyles.instructionsText}>{page.instructions}</Text>
        </View>
      ) : null}

      {/* Dica do personal (somente leitura, sem botão de editar) */}
      {page.exercise?.tip ? (
        <View style={contentStyles.tipBox}>
          <Feather name="zap" size={s(15)} color={colors.accent} style={{ flexShrink: 0 }} />
          <Text style={contentStyles.tipText}>
            <Text style={contentStyles.tipBold}>Dica do professor: </Text>
            {page.exercise.tip}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const contentStyles = StyleSheet.create({
  videoWrap: { marginBottom: vs(12), width: '100%' },
  videoEmpty: {
    height: vs(80),
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(6),
    marginBottom: vs(12),
  },
  videoEmptyText: { color: colors.textDim2, fontSize: fs(10) },

  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: vs(8),
    paddingHorizontal: s(12),
    marginBottom: vs(12),
  },
  restText: { color: colors.textDim, fontSize: fs(10.5) },
  restValue: { color: colors.text, fontWeight: '700' },

  tracker: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: s(14),
    marginBottom: vs(12),
  },
  trackerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(10),
  },
  trackerLabel: {
    color: colors.textFaint,
    fontSize: fs(9),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trackerBadge: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: vs(3),
    paddingHorizontal: s(9),
  },
  trackerBadgeText: { color: colors.text, fontSize: fs(9), fontWeight: '700' },

  setsRow: { flexDirection: 'row', gap: s(7) },
  setPill: {
    flex: 1,
    aspectRatio: 1 / 1.05,
    borderRadius: s(12),
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(1),
  },
  setPillDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  setPillDrop: { backgroundColor: colors.amberGlow, borderColor: 'rgba(255,182,72,0.4)' },
  setPillN: { fontSize: fs(8), fontWeight: '700', color: colors.textFaint, letterSpacing: 0.4 },
  setPillReps: { fontSize: fs(15), fontWeight: '700', color: colors.text },
  setPillUnit: { fontSize: fs(9), color: colors.textFaint, fontWeight: '600' },
  setPillTextDone: { color: '#06251b' },

  dropNote: {
    flexDirection: 'row',
    gap: s(7),
    alignItems: 'flex-start',
    marginTop: vs(12),
    paddingTop: vs(12),
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  dropNoteText: { color: colors.amber, fontSize: fs(9.5), lineHeight: vs(16), flex: 1 },

  section: { marginBottom: vs(12) },
  sectionTitle: {
    color: colors.text,
    fontSize: fs(12),
    fontWeight: '700',
    marginBottom: vs(6),
  },
  instructionsText: { color: '#c7c9d1', fontSize: fs(11), lineHeight: vs(19) },

  tipBox: {
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.2)',
    borderRadius: radius.md,
    padding: s(12),
    flexDirection: 'row',
    gap: s(9),
    alignItems: 'flex-start',
    marginBottom: vs(4),
  },
  tipText: { color: '#d6d8de', fontSize: fs(10), lineHeight: vs(17), flex: 1 },
  tipBold: { color: colors.accent, fontWeight: '700' },
});

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function WorkoutDetailScreen({ route, navigation }) {
  const { workoutId, workoutIds: workoutIdsParam, workoutName, dayOfWeek } = route.params;
  const workoutIds = React.useMemo(() => workoutIdsParam || [workoutId], [workoutIdsParam, workoutId]);
  const primaryWorkoutId = workoutIds[0];
  const { session } = useAuth();

  // ── Dados ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [warmupItems, setWarmupItems] = useState([]);
  const [workoutMeta, setWorkoutMeta] = useState(null);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [warmupConfirmed, setWarmupConfirmed] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  /** { [workoutExerciseId: string]: number } — índice da página ativa (0 = Principal) */
  const [activePageMap, setActivePageMap] = useState({});
  /** { [workoutExerciseId: string]: Set<number> } — séries marcadas (só visual) */
  const [doneSets, setDoneSets] = useState({});

  // ── Fluxo de início / skip ─────────────────────────────────────────────────
  const [starting, setStarting] = useState(false);
  const [dayChangeReason, setDayChangeReason] = useState('');
  const [showDayChangeModal, setShowDayChangeModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // ── Carga de dados ─────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from('workout_exercises')
      .select(
        'id, target_sets, target_reps, target_reps_detail, target_duration_minutes, target_distance_km, target_intensity, progression_note, drop_last, drop_note, rest_seconds, order_index, combo_group, is_warmup, exercises(id, name, muscle_group, video_id, exercise_type, instructions, tip), workout_exercise_substitutes(substitute_exercise_id, target_sets, target_reps, target_reps_detail, drop_last, drop_note, instructions, exercises:substitute_exercise_id(id, name, muscle_group, video_id, instructions, tip))'
      )
      .in('workout_id', workoutIds)
      .order('order_index');

    const allData = data || [];
    setWarmupItems(allData.filter((it) => it.is_warmup));
    setItems(allData.filter((it) => !it.is_warmup));

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
      setWarmupConfirmed(false);
    }, [loadItems])
  );

  // ── Interações do aluno ────────────────────────────────────────────────────
  const toggleExpand = (item) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };

  /** Alterna aba (Principal / Alt) — causa fade no nome do exercício */
  const selectPage = (workoutExerciseId, pageIndex) => {
    setActivePageMap((prev) => ({ ...prev, [workoutExerciseId]: pageIndex }));
  };

  /** Marca/desmarca série como concluída (visual — não persiste) */
  const toggleSetDone = (workoutExerciseId, setIndex) => {
    setDoneSets((prev) => {
      const current = new Set(prev[workoutExerciseId] || []);
      if (current.has(setIndex)) current.delete(setIndex);
      else current.add(setIndex);
      return { ...prev, [workoutExerciseId]: current };
    });
  };

  // ── Início do treino ───────────────────────────────────────────────────────
  const createLogAndGo = async (extraFields = {}) => {
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
    navigation.navigate('ActiveWorkout', {
      logId: id,
      workoutLogId: id,
      workoutId: primaryWorkoutId,
      workoutIds,
      workoutName,
      exercises: items,
      offline: !!offline,
    });
  };

  const handleIniciar = () => {
    if (warmupItems.length > 0 && !warmupConfirmed) {
      Alert.alert(
        '🔥 Aquecimento obrigatório',
        'Abra o card de aquecimento, leia as instruções e toque em "Confirmar Aquecimento" antes de iniciar o treino.'
      );
      return;
    }
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

  // ── Agrupamento por músculo ────────────────────────────────────────────────
  const groupedItems = React.useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const group = item.exercises?.muscle_group || 'Outros';
      if (!map[group]) map[group] = [];
      map[group].push(item);
    });
    return Object.entries(map).map(([label, exercises]) => ({
      label,
      exercises,
      color: getMuscleColor(label, exercises[0]?.exercises?.exercise_type),
    }));
  }, [items]);

  const allItems = React.useMemo(() => items, [items]);

  // ── Render de card ─────────────────────────────────────────────────────────
  const renderExerciseCard = (item, group, globalIdx) => {
    const isExpanded = expandedId === item.id;
    const pages = buildPages(item);
    const hasSubstitutes = pages.length > 1;
    const activePageIndex = activePageMap[item.id] || 0;
    const activePage = pages[activePageIndex] || pages[0];

    // Sumário da página principal (para o card recolhido)
    const mainRepsList = getRepsList(pages[0]);
    const summaryReps = pages[0].drop_last
      ? [...mainRepsList.slice(0, -1), 'drop'].join(', ')
      : mainRepsList.join(', ');

    const doneCount = (doneSets[item.id] || new Set()).size;
    const totalSets = activePage.target_sets || 1;
    const comboPartners = item.combo_group
      ? items.filter((e) => e.combo_group === item.combo_group && e.id !== item.id)
      : [];

    return (
      <View key={item.id} style={[styles.card, isExpanded && styles.cardExpanded]}>

        {/* ── HEADER DO CARD (recolhido ou expandido) ─── */}
        <TouchableOpacity
          style={styles.cardTop}
          onPress={() => toggleExpand(item)}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.dot, { backgroundColor: group.color }]} />
            <View style={{ flex: 1 }}>
              {/* Nome muda via fade ao trocar de aba — mesmo no card recolhido */}
              <AnimatedExerciseName
                name={isExpanded ? activePage.exercise?.name : item.exercises?.name}
                style={styles.exName}
              />
              <Text style={styles.exMeta}>
                {item.target_sets}×{summaryReps}
                {item.rest_seconds ? `  ·  ${item.rest_seconds}s descanso` : ''}
              </Text>
              {comboPartners.length > 0 && (
                <Text style={styles.comboTag}>
                  ⚡ Combinado com {comboPartners.map((p) => p.exercises?.name).join(', ')}
                </Text>
              )}
            </View>
          </View>

          {/* Badges + indicador de progresso — SEM botão ⋮ de edição */}
          <View style={styles.cardRight}>
            {hasSubstitutes && !isExpanded && (
              <View style={styles.subBadge}>
                <Text style={styles.subBadgeText}>ALT</Text>
              </View>
            )}
            <View style={styles.setsIndicator}>
              <Text style={styles.setsIndicatorText}>
                {doneCount}/{item.target_sets}
              </Text>
            </View>
            <Feather
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={s(16)}
              color={colors.textDim}
            />
          </View>
        </TouchableOpacity>

        {/* ── CONTEÚDO EXPANDIDO ─── */}
        {isExpanded && (
          <View style={styles.expandedContent}>

            {/* Barra de navegação Principal / Substituto (igual à tela do personal) */}
            {hasSubstitutes && (
              <View style={styles.pageNavRow}>
                <TouchableOpacity
                  style={[styles.pageNavBtn, activePageIndex === 0 && styles.pageNavBtnDisabled]}
                  disabled={activePageIndex === 0}
                  onPress={() => selectPage(item.id, activePageIndex - 1)}
                >
                  <Feather
                    name="chevron-left"
                    size={s(18)}
                    color={activePageIndex === 0 ? colors.textFaint : colors.text}
                  />
                </TouchableOpacity>

                <View style={styles.pageNavCenter}>
                  {activePageIndex === 0 ? (
                    <View style={styles.pagePillMain}>
                      <Feather name="zap" size={s(10)} color={colors.accent} />
                      <Text style={styles.pagePillMainText}>Exercício principal</Text>
                    </View>
                  ) : (
                    <View style={styles.pagePillSub}>
                      <Feather name="refresh-cw" size={s(10)} color={colors.amber} />
                      <Text style={styles.pagePillSubLabel}>
                        Substituto {activePageIndex}/{pages.length - 1}
                      </Text>
                      <Text style={styles.pagePillSubName} numberOfLines={1}>
                        {activePage.exercise?.name}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.pageNavBtn, activePageIndex === pages.length - 1 && styles.pageNavBtnDisabled]}
                  disabled={activePageIndex === pages.length - 1}
                  onPress={() => selectPage(item.id, activePageIndex + 1)}
                >
                  <Feather
                    name="chevron-right"
                    size={s(18)}
                    color={activePageIndex === pages.length - 1 ? colors.textFaint : colors.text}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Conteúdo da página ativa (vídeo, séries, instruções, dica) */}
            <ExercisePageContent
              page={activePage}
              workoutExerciseId={item.id}
              doneSets={doneSets}
              onToggleSet={(setIndex) => toggleSetDone(item.id, setIndex)}
            />

            {/* Mini-card do combo (quando existe parceiro) */}
            {item.combo_group && (() => {
              const partner = items.find(
                (e) => e.combo_group === item.combo_group && e.id !== item.id
              );
              if (!partner) return null;
              return (
                <TouchableOpacity
                  style={styles.comboPartnerCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpandedId(partner.id);
                  }}
                >
                  <Feather name="repeat" size={s(12)} color={colors.amber} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comboPartnerLabel}>Faça em sequência com:</Text>
                    <Text style={styles.comboPartnerName}>{partner.exercises?.name}</Text>
                  </View>
                  <Feather name="chevron-right" size={s(15)} color={colors.amber} />
                </TouchableOpacity>
              );
            })()}

            {/* Navegação entre exercícios */}
            {(() => {
              const idx = globalIdx;
              return (
                <View style={styles.exnav}>
                  <TouchableOpacity
                    style={[styles.navSide, idx === 0 && styles.navSideDisabled]}
                    disabled={idx === 0}
                    onPress={() => setExpandedId(allItems[idx - 1].id)}
                  >
                    <Feather
                      name="chevron-left"
                      size={s(16)}
                      color={idx === 0 ? colors.textFaint : colors.textDim}
                    />
                  </TouchableOpacity>

                  {/* Botão central: avança série ou indica conclusão */}
                  <TouchableOpacity
                    style={styles.navMain}
                    onPress={() => {
                      const repsList = getRepsList(activePage);
                      const total = repsList.length;
                      const done = (doneSets[item.id] || new Set()).size;
                      toggleSetDone(item.id, done < total ? done : done - 1);
                    }}
                  >
                    <Feather
                      name={doneCount >= totalSets ? 'check' : 'zap'}
                      size={s(14)}
                      color="#06251b"
                    />
                    <Text style={styles.navMainText}>
                      {doneCount >= totalSets ? 'Concluído' : `Série ${doneCount + 1}`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.navSide, idx === allItems.length - 1 && styles.navSideDisabled]}
                    disabled={idx === allItems.length - 1}
                    onPress={() => setExpandedId(allItems[idx + 1].id)}
                  >
                    <Feather
                      name="chevron-right"
                      size={s(16)}
                      color={idx === allItems.length - 1 ? colors.textFaint : colors.textDim}
                    />
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        )}
      </View>
    );
  };

  // ── Render principal ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Topbar */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={s(18)} color={colors.textDim} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {dayOfWeek ? (
            <Text style={styles.eyebrow}>{DAY_LABEL[dayOfWeek] || dayOfWeek}</Text>
          ) : null}
          <Text style={styles.title}>{workoutName}</Text>
          {(workoutMeta?.goal || workoutMeta?.level) && (
            <Text style={styles.metaLabel}>
              {[workoutMeta?.goal, workoutMeta?.level].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {/* Sem botão "Editar" — aluno não pode editar */}
      </View>

      {/* Lista de exercícios */}
      <FlatList
        data={groupedItems}
        keyExtractor={(g) => g.label}
        contentContainerStyle={{ paddingBottom: vs(12) }}
        ListHeaderComponent={
          warmupItems.length > 0 ? (
            <WarmupExerciseList
              items={warmupItems}
              isPersonal={false}
              warmupConfirmed={warmupConfirmed}
              onConfirmWarmup={() => setWarmupConfirmed(true)}
            />
          ) : null
        }
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

      {/* Bottombar */}
      <View style={styles.bottombar}>
        {warmupItems.length > 0 && !warmupConfirmed && (
          <View style={styles.warmupLockBanner}>
            <Feather name="lock" size={s(13)} color={colors.amber} />
            <Text style={styles.warmupLockText}>
              Confirme o aquecimento para desbloquear o treino
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.startButton,
            warmupItems.length > 0 && !warmupConfirmed && styles.startButtonLocked,
          ]}
          onPress={handleIniciar}
          disabled={starting}
          activeOpacity={0.85}
        >
          <Feather
            name={warmupItems.length > 0 && !warmupConfirmed ? 'lock' : 'play'}
            size={s(16)}
            color="#08110A"
          />
          <Text style={styles.startButtonText}>
            {starting ? 'Abrindo...' : 'Iniciar Treino'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomRowButtons}>
          <TouchableOpacity style={styles.skipDayButton} onPress={() => setShowSkipModal(true)}>
            <Text style={styles.skipDayButtonText}>Não vou treinar hoje</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.feedbackHistoryBtn}
            onPress={() => navigation.navigate('WorkoutFeedbackHistory')}
          >
            <Feather name="message-square" size={s(14)} color={colors.blue} />
            <Text style={styles.feedbackHistoryBtnText}>Feedbacks</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal: treino em dia diferente */}
      <Modal
        visible={showDayChangeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDayChangeModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              Esse treino é de {DAY_LABEL[dayOfWeek] || dayOfWeek}
            </Text>
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
            <TouchableOpacity
              style={styles.modalConfirm}
              onPress={confirmDayChange}
              disabled={starting}
            >
              <Text style={styles.modalConfirmText}>
                {starting ? 'Abrindo...' : 'Continuar e iniciar treino'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowDayChangeModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: skip do treino */}
      <Modal
        visible={showSkipModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSkipModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Não vai treinar hoje?</Text>
            <Text style={styles.modalSubtitle}>Tudo bem. Conta pra gente o motivo:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: estou doente, viagem, compromisso..."
              placeholderTextColor={colors.textDim2}
              value={skipReason}
              onChangeText={setSkipReason}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={styles.modalConfirm}
              onPress={confirmSkip}
              disabled={skipping}
            >
              <Text style={styles.modalConfirmText}>
                {skipping ? 'Enviando...' : 'Confirmar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowSkipModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: screenPaddingTop,
    paddingHorizontal: screenPaddingH,
    paddingBottom: vs(10),
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: s(10),
  },
  backBtn: {
    width: s(34),
    height: s(34),
    borderRadius: s(10),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  eyebrow: { color: colors.amber, fontSize: fs(10), fontWeight: '700', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: fs(15), fontWeight: '700' },
  metaLabel: { color: colors.textDim, fontSize: fs(10), marginTop: vs(1) },

  // Card de exercício
  card: {
    marginHorizontal: s(16),
    marginBottom: vs(8),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardExpanded: { borderColor: colors.accent },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(14),
    paddingVertical: vs(13),
    gap: s(10),
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: s(10) },
  dot: { width: s(8), height: s(8), borderRadius: s(4), flexShrink: 0 },
  exName: { color: colors.text, fontSize: fs(13), fontWeight: '600' },
  exMeta: { color: colors.textDim, fontSize: fs(11), marginTop: vs(2) },
  comboTag: { color: colors.amber, fontSize: fs(10), marginTop: vs(2) },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  subBadge: {
    backgroundColor: colors.blueGlow,
    borderRadius: radius.sm,
    paddingHorizontal: s(5),
    paddingVertical: vs(2),
  },
  subBadgeText: { color: colors.blue, fontSize: fs(8), fontWeight: '700' },
  setsIndicator: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: s(7),
    paddingVertical: vs(3),
  },
  setsIndicatorText: { color: colors.textDim, fontSize: fs(10), fontWeight: '600' },

  // Área expandida
  expandedContent: {
    paddingHorizontal: s(14),
    paddingBottom: vs(14),
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: vs(12),
  },

  // Navegação entre principal e substitutos (barra com setas — igual ao personal)
  pageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(12),
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
  pageNavCenter: { flex: 1, alignItems: 'center' },
  pagePillMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: colors.accentGlow,
    borderRadius: ms(8),
    paddingHorizontal: s(10),
    paddingVertical: vs(5),
  },
  pagePillMainText: { color: colors.accent, fontSize: fs(10), fontWeight: '700' },
  pagePillSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: colors.amberGlow,
    borderRadius: ms(8),
    paddingHorizontal: s(10),
    paddingVertical: vs(5),
    maxWidth: '100%',
  },
  pagePillSubLabel: { color: colors.amber, fontSize: fs(9), fontWeight: '700', flexShrink: 0 },
  pagePillSubName: { color: colors.text, fontSize: fs(10), fontWeight: '700', flexShrink: 1 },

  // Combo partner mini-card
  comboPartnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    borderWidth: 1,
    borderColor: `${colors.amber}55`,
    borderRadius: radius.sm,
    backgroundColor: colors.amberGlow,
    paddingHorizontal: s(12),
    paddingVertical: vs(10),
    marginBottom: vs(12),
  },
  comboPartnerLabel: {
    color: colors.amber,
    fontSize: fs(9),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  comboPartnerName: {
    color: colors.text,
    fontSize: fs(12),
    fontWeight: '800',
    marginTop: vs(1),
  },

  // Navegação entre exercícios
  exnav: { flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: vs(6) },
  navSide: {
    width: s(40),
    height: s(40),
    borderRadius: s(10),
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSideDisabled: { opacity: 0.4 },
  navMain: {
    flex: 1,
    height: s(40),
    borderRadius: s(10),
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
  },
  navMainText: { color: '#06251b', fontWeight: '700', fontSize: fs(11) },

  // Agrupamento muscular
  groupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: s(16),
    marginTop: vs(14),
    marginBottom: vs(8),
    gap: s(8),
  },
  groupDot: { width: s(8), height: s(8), borderRadius: s(4) },
  groupLabelText: {
    color: colors.textDim,
    fontSize: fs(10),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  groupLine: { flex: 1, height: 1, backgroundColor: colors.line },

  // Bottombar
  bottombar: {
    paddingHorizontal: s(20),
    paddingTop: vs(8),
    paddingBottom: vs(6),
  },
  warmupLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: colors.amberGlow,
    borderRadius: radius.sm,
    paddingHorizontal: s(12),
    paddingVertical: vs(8),
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: colors.amber,
  },
  warmupLockText: { color: colors.amber, fontSize: fs(11), fontWeight: '600', flex: 1 },
  startButton: {
    flexDirection: 'row',
    gap: s(8),
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    padding: s(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(4),
    shadowColor: colors.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  startButtonLocked: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.amber,
    shadowOpacity: 0,
  },
  startButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(14) },
  bottomRowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(4),
  },
  skipDayButton: { alignItems: 'center', paddingVertical: vs(14), flex: 1 },
  skipDayButtonText: {
    color: colors.textDim,
    fontSize: fs(11),
    textDecorationLine: 'underline',
  },
  feedbackHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: vs(10),
    paddingHorizontal: s(12),
    backgroundColor: colors.blueGlow,
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: `${colors.blue}44`,
  },
  feedbackHistoryBtnText: { color: colors.blue, fontSize: fs(10), fontWeight: '700' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: s(22),
    paddingBottom: vs(34),
  },
  modalTitle: { color: colors.text, fontSize: fs(16), fontWeight: '700', marginBottom: vs(8) },
  modalSubtitle: { color: colors.textDim, fontSize: fs(13), marginBottom: vs(14) },
  modalInput: {
    backgroundColor: colors.surface3,
    borderRadius: radius.sm,
    padding: s(12),
    color: colors.text,
    fontSize: fs(13),
    minHeight: vs(80),
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: vs(16),
  },
  modalConfirm: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    padding: s(15),
    alignItems: 'center',
    marginBottom: vs(10),
  },
  modalConfirmText: { color: '#04170F', fontWeight: '700', fontSize: fs(14) },
  modalClose: { alignItems: 'center', paddingVertical: vs(10) },
  modalCloseText: { color: colors.textDim, fontSize: fs(13) },
});
