/**
 * StudentWorkoutViewScreen.js
 * Tela de visualização de treino na visão do ALUNO — somente leitura.
 * O aluno vê exercícios, substitutos e pode iniciar o treino.
 * Sem opções de Editar / Adicionar / Remover exercícios.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { insertRow } from '../lib/dataClient';
import { generateUUID } from '../utils/uuid';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, screenPaddingTop } from '../utils/responsive';
import InlineDemoVideo from '../components/InlineDemoVideo';
import WarmupExerciseList from '../components/WarmupExerciseList';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAY_KEYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const todayKey = () => WEEKDAY_KEYS[new Date().getDay()];

export default function StudentWorkoutViewScreen({ route, navigation }) {
  const { workoutId, workoutIds: workoutIdsParam, workoutName, dayOfWeek } = route.params;
  const workoutIds = React.useMemo(() => workoutIdsParam || [workoutId], [workoutIdsParam, workoutId]);
  const primaryWorkoutId = workoutIds[0];

  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [warmupItems, setWarmupItems] = useState([]);
  const [warmupConfirmed, setWarmupConfirmed] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [substitutePage, setSubstitutePage] = useState({});
  const [starting, setStarting] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('workout_exercises')
      .select(
        'id, target_sets, target_reps, target_reps_detail, progression_note, drop_last, drop_note, rest_seconds, order_index, combo_group, is_warmup, exercises(id, name, muscle_group, video_id, exercise_type, instructions, tip), workout_exercise_substitutes(substitute_exercise_id, target_sets, target_reps, target_reps_detail, drop_last, drop_note, instructions, exercises:substitute_exercise_id(id, name, muscle_group, video_id, instructions, tip))'
      )
      .in('workout_id', workoutIds)
      .order('order_index');

    const allData = data || [];
    setWarmupItems(allData.filter((it) => it.is_warmup));
    setItems(allData.filter((it) => !it.is_warmup));
  }, [workoutIds]);

  useFocusEffect(
    useCallback(() => {
      load();
      setWarmupConfirmed(false);
    }, [load])
  );

  const toggleExpand = (item) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  };

  const startWorkout = async () => {
    if (warmupItems.length > 0 && !warmupConfirmed) {
      // avisa sobre aquecimento
      return;
    }

    setStarting(true);
    const id = generateUUID();
    const { offline, error } = await insertRow('workout_logs', {
      id,
      user_id: session.user.id,
      workout_id: primaryWorkoutId,
      started_at: new Date().toISOString(),
    });
    setStarting(false);

    if (error) {
      return;
    }

    navigation.navigate('ActiveWorkout', {
      logId: id,
      workoutId: primaryWorkoutId,
      workoutIds,
      workoutName,
      exercises: items,
      offline: !!offline,
    });
  };

  // Monta as "páginas" de um exercício: principal + substitutos
  const buildPages = (item) => {
    const hasSubstitutes = (item.workout_exercise_substitutes || []).length > 0;

    const mainPage = {
      key: 'main',
      isSubstitute: false,
      label: null,
      exercise: item.exercises,
      target_sets: item.target_sets,
      target_reps: item.target_reps,
      target_reps_detail: item.target_reps_detail,
      drop_last: item.drop_last,
      drop_note: item.drop_note,
      rest_seconds: item.rest_seconds,
      instructions: item.exercises?.instructions,
      tip: item.exercises?.tip,
    };

    const subPages = (item.workout_exercise_substitutes || []).map((sub) => ({
      key: sub.substitute_exercise_id,
      isSubstitute: true,
      label: 'Substituto',
      exercise: sub.exercises,
      target_sets: sub.target_sets || item.target_sets,
      target_reps: sub.target_reps || item.target_reps,
      target_reps_detail: sub.target_reps_detail,
      drop_last: sub.drop_last,
      drop_note: sub.drop_note,
      rest_seconds: item.rest_seconds,
      instructions: sub.instructions || sub.exercises?.instructions,
      tip: sub.exercises?.tip,
    }));

    return [mainPage, ...subPages];
  };

  const pageWidth = windowWidth - s(40);

  const renderPage = (page, item, allPages) => {
    const repsList = page.target_reps_detail
      ? page.target_reps_detail.split(',').map((r) => r.trim())
      : Array.from({ length: page.target_sets || 1 }, () => String(page.target_reps ?? '-'));
    const isDropSet = !!page.drop_last;

    return (
      <View style={{ width: '100%' }}>
        {/* Vídeo demonstrativo */}
        {page.exercise?.video_id ? (
          <View style={styles.videoWrapper}>
            {page.isSubstitute && (
              <View style={styles.videoBanner}>
                <Feather name="play-circle" size={s(12)} color={colors.accent} />
                <Text style={styles.videoBannerText}>Vídeo demonstrativo · {page.exercise?.name}</Text>
              </View>
            )}
            <InlineDemoVideo videoId={page.exercise.video_id} />
          </View>
        ) : (
          <View style={styles.noVideoBox}>
            <Feather name="video-off" size={s(18)} color={colors.textFaint} />
            <Text style={styles.noVideoText}>Sem vídeo demonstrativo</Text>
          </View>
        )}

        {/* Séries */}
        <View style={styles.setsBox}>
          <View style={styles.setsHead}>
            <Text style={styles.setsHeadLabel}>SÉRIES</Text>
            <View style={styles.setsBadge}>
              <Text style={styles.setsBadgeText}>{repsList.length} séries</Text>
            </View>
          </View>
          <View style={styles.setsRow}>
            {repsList.map((reps, i) => {
              const isLast = i === repsList.length - 1;
              const isDrop = isLast && isDropSet;
              return (
                <View key={i} style={[styles.setPill, isDrop && styles.setPillDrop]}>
                  <Text style={styles.setPillN}>{isDrop ? 'DROP' : `SÉRIE ${i + 1}`}</Text>
                  {!isDrop ? (
                    <>
                      <Text style={styles.setPillReps}>{reps}</Text>
                      <Text style={styles.setPillUnit}>reps</Text>
                    </>
                  ) : (
                    <Feather name="zap" size={14} color={colors.amber} style={{ marginTop: 2 }} />
                  )}
                </View>
              );
            })}
          </View>

          {isDropSet && (
            <View style={styles.dropBox}>
              <Feather name="zap" size={12} color={colors.amber} />
              <Text style={styles.dropText}>
                {page.drop_note || 'Drop set na última série — reduza a carga e continue sem parar.'}
              </Text>
            </View>
          )}
        </View>

        {/* Descanso */}
        {page.rest_seconds ? (
          <View style={styles.restRow}>
            <Feather name="clock" size={12} color={colors.textDim} />
            <Text style={styles.restText}>
              Descanso:{' '}
              <Text style={styles.restValue}>
                {page.rest_seconds >= 60
                  ? `${Math.floor(page.rest_seconds / 60)} min${page.rest_seconds % 60 > 0 ? ` ${page.rest_seconds % 60}s` : ''}`
                  : `${page.rest_seconds} segundos`}
              </Text>
            </Text>
          </View>
        ) : null}

        {/* Como executar */}
        {page.instructions ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Como executar</Text>
            <Text style={styles.sectionText}>{page.instructions}</Text>
          </View>
        ) : null}

        {/* Dica do professor */}
        {page.tip ? (
          <View style={styles.tipBox}>
            <Feather name="zap" size={14} color={colors.accent} />
            <Text style={styles.tipText}>
              <Text style={styles.tipBold}>Dica: </Text>
              {page.tip}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={s(20)} color={colors.text} />
        <Text style={styles.backText}>{workoutName}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: vs(120) }} showsVerticalScrollIndicator={false}>
        {/* Aquecimento */}
        {warmupItems.length > 0 && (
          <WarmupExerciseList
            items={warmupItems}
            isPersonal={false}
            workoutId={primaryWorkoutId}
            onReload={load}
            onConfirm={() => setWarmupConfirmed(true)}
            confirmed={warmupConfirmed}
          />
        )}

        {items.length === 0 && (
          <Text style={styles.empty}>Nenhum exercício nesse treino ainda.</Text>
        )}

        {/* Cards de exercícios */}
        {items.map((item, idx) => {
          const isExpanded = expandedId === item.id;
          const pages = buildPages(item);
          const hasSubstitutes = pages.length > 1;
          const activePage = substitutePage[item.id] || 0;
          const currentPage = pages[activePage] || pages[0];

          const repsList = item.target_reps_detail
            ? item.target_reps_detail.split(',').map((r) => r.trim())
            : Array.from({ length: item.target_sets || 1 }, () => String(item.target_reps));
          const summaryReps = item.drop_last
            ? [...repsList.slice(0, -1), 'drop'].join(', ')
            : repsList.join(', ');
          const comboPartners = item.combo_group
            ? items.filter((e) => e.combo_group === item.combo_group && e.id !== item.id)
            : [];

          return (
            <View key={item.id} style={[styles.card, isExpanded && styles.cardExpanded]}>

              {/* Card recolhido */}
              <TouchableOpacity
                style={styles.cardTop}
                activeOpacity={0.85}
                onPress={() => toggleExpand(item)}
              >
                <View style={styles.cardIcon}>
                  <Feather name="zap" size={s(16)} color={colors.accent} />
                </View>
                <View style={styles.cardCenter}>
                  <View style={styles.cardNameRow}>
                    <Text style={styles.exName} numberOfLines={1}>{item.exercises?.name}</Text>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={s(16)}
                      color={colors.textDim}
                    />
                  </View>
                  <Text style={styles.exMeta}>
                    {item.target_sets}×{summaryReps}
                    {item.rest_seconds ? `  ·  ${item.rest_seconds}s descanso` : ''}
                  </Text>
                  {!isExpanded && (
                    <View style={styles.tagsRow}>
                      {comboPartners.length > 0 && (
                        <View style={styles.tagCombo}>
                          <Feather name="repeat" size={s(9)} color={colors.amber} />
                          <Text style={styles.tagComboText}> com {comboPartners.map((p) => p.exercises?.name).join(', ')}</Text>
                        </View>
                      )}
                      {hasSubstitutes && (
                        <View style={styles.tagSub}>
                          <Feather name="refresh-cw" size={s(9)} color={colors.accent} />
                          <Text style={styles.tagSubText}> {pages.length - 1} substituto{pages.length - 1 > 1 ? 's' : ''}</Text>
                        </View>
                      )}
                      {item.exercises?.video_id && (
                        <View style={styles.tagVideo}>
                          <Feather name="play-circle" size={s(9)} color={colors.blue} />
                          <Text style={styles.tagVideoText}> Vídeo</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Área expandida */}
              {isExpanded && (
                <View style={styles.expandedArea}>

                  {/* ───── Indicador de substituto ───── */}
                  {hasSubstitutes && (
                    <View style={styles.pageNavRow}>
                      <TouchableOpacity
                        style={[styles.pageNavBtn, activePage === 0 && styles.pageNavBtnDisabled]}
                        disabled={activePage === 0}
                        onPress={() => setSubstitutePage((p) => ({ ...p, [item.id]: activePage - 1 }))}
                      >
                        <Feather name="chevron-left" size={s(18)} color={activePage === 0 ? colors.textFaint : colors.text} />
                      </TouchableOpacity>

                      <View style={styles.pageNavCenter}>
                        {activePage === 0 ? (
                          <View style={styles.pagePillMain}>
                            <Feather name="zap" size={s(10)} color={colors.accent} />
                            <Text style={styles.pagePillMainText}>Exercício principal</Text>
                          </View>
                        ) : (
                          <View style={styles.pagePillSub}>
                            <Feather name="refresh-cw" size={s(10)} color={colors.amber} />
                            <Text style={styles.pagePillSubLabel}>Substituto {activePage}/{pages.length - 1}</Text>
                            <Text style={styles.pagePillSubName} numberOfLines={1}>
                              {currentPage.exercise?.name}
                            </Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        style={[styles.pageNavBtn, activePage === pages.length - 1 && styles.pageNavBtnDisabled]}
                        disabled={activePage === pages.length - 1}
                        onPress={() => setSubstitutePage((p) => ({ ...p, [item.id]: activePage + 1 }))}
                      >
                        <Feather name="chevron-right" size={s(18)} color={activePage === pages.length - 1 ? colors.textFaint : colors.text} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Aviso de exercício SUBSTITUÍDO (quando o personal trocou o principal) */}
                  {activePage > 0 && (
                    <View style={styles.replacedBanner}>
                      <View style={styles.replacedMain}>
                        <Feather name="slash" size={s(11)} color={colors.textDim} />
                        <Text style={styles.replacedMainText} numberOfLines={1}>
                          {item.exercises?.name}
                        </Text>
                        <Text style={styles.replacedMainLabel}>(principal)</Text>
                      </View>
                      <Feather name="arrow-right" size={s(12)} color={colors.amber} />
                      <View style={styles.replacedSub}>
                        <Feather name="check-circle" size={s(11)} color={colors.amber} />
                        <Text style={styles.replacedSubText} numberOfLines={1}>
                          {currentPage.exercise?.name}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Conteúdo da página ativa */}
                  {renderPage(currentPage, item, pages)}

                  {/* Parceiro combinado */}
                  {item.combo_group && (() => {
                    const partner = items.find(
                      (e) => e.combo_group === item.combo_group && e.id !== item.id
                    );
                    if (!partner) return null;
                    return (
                      <View style={styles.comboCard}>
                        <View style={styles.comboCardHeader}>
                          <Feather name="repeat" size={s(11)} color={colors.amber} />
                          <Text style={styles.comboCardHeaderText}>Faça em sequência com:</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.comboRow}
                          activeOpacity={0.8}
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setExpandedId(partner.id);
                          }}
                        >
                          <View style={styles.comboIcon}>
                            <Feather name="zap" size={s(14)} color={colors.amber} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.comboName}>{partner.exercises?.name}</Text>
                            <Text style={styles.comboDetail}>
                              {partner.target_sets}×{partner.target_reps} reps · {partner.exercises?.muscle_group}
                            </Text>
                          </View>
                          <Feather name="chevron-right" size={s(14)} color={colors.amber} />
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                  {/* Nav: exercício anterior / recolher / próximo */}
                  <View style={styles.exNav}>
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
                      <Feather name="chevron-up" size={14} color="#04170F" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.navSide, idx === items.length - 1 && styles.navSideDisabled]}
                      disabled={idx === items.length - 1}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId(items[idx + 1].id);
                      }}
                    >
                      <Feather name="chevron-right" size={16} color={idx === items.length - 1 ? colors.textFaint : colors.textDim} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Botão fixo de iniciar */}
      <View style={styles.startBar}>
        <TouchableOpacity
          style={[styles.startButton, starting && styles.startButtonDisabled]}
          onPress={startWorkout}
          disabled={starting}
          activeOpacity={0.88}
        >
          <Feather name="play" size={s(16)} color="#04170F" />
          <Text style={styles.startButtonText}>{starting ? 'Iniciando...' : 'Iniciar Treino'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.skipText}>Não vou treinar hoje</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(18),
    paddingTop: screenPaddingTop,
    paddingBottom: vs(14),
    gap: s(6),
  },
  backText: { color: colors.text, fontSize: fs(14), fontWeight: '700', flex: 1 },

  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(40), fontSize: fs(12) },

  // ── Card ────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: ms(16),
    marginHorizontal: s(18),
    marginBottom: vs(10),
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: colors.accentDark,
    backgroundColor: colors.surface2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s(14),
    gap: s(12),
  },
  cardIcon: {
    width: s(38),
    height: s(38),
    borderRadius: ms(11),
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardCenter: { flex: 1, gap: vs(3) },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(6),
  },
  exName: { color: colors.text, fontSize: fs(12.5), fontWeight: '700', flex: 1 },
  exMeta: { color: colors.textDim, fontSize: fs(10.5) },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(4), marginTop: vs(4) },
  tagCombo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.amberGlow, borderRadius: ms(6),
    paddingHorizontal: s(7), paddingVertical: vs(3),
  },
  tagComboText: { color: colors.amber, fontSize: fs(9), fontWeight: '700', flexShrink: 1 },
  tagSub: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.accentGlow, borderRadius: ms(6),
    paddingHorizontal: s(7), paddingVertical: vs(3),
  },
  tagSubText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  tagVideo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.blueGlow, borderRadius: ms(6),
    paddingHorizontal: s(7), paddingVertical: vs(3),
  },
  tagVideoText: { color: colors.blue, fontSize: fs(9), fontWeight: '700' },

  // ── Área expandida ──────────────────────────────────────────────
  expandedArea: { paddingBottom: vs(14) },

  // Nav entre principal e substitutos
  pageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(10),
    marginBottom: vs(12),
    marginHorizontal: s(14),
    backgroundColor: colors.surface3,
    borderRadius: ms(10),
    paddingHorizontal: s(4),
    paddingVertical: vs(4),
  },
  pageNavBtn: {
    width: s(36), height: s(36),
    alignItems: 'center', justifyContent: 'center',
    borderRadius: ms(8), backgroundColor: colors.surface,
  },
  pageNavBtnDisabled: { opacity: 0.3 },
  pageNavCenter: { flex: 1, alignItems: 'center' },

  pagePillMain: {
    flexDirection: 'row', alignItems: 'center', gap: s(5),
    backgroundColor: colors.accentGlow, borderRadius: ms(8),
    paddingHorizontal: s(10), paddingVertical: vs(5),
  },
  pagePillMainText: { color: colors.accent, fontSize: fs(10), fontWeight: '700' },

  pagePillSub: {
    flexDirection: 'row', alignItems: 'center', gap: s(5),
    backgroundColor: colors.amberGlow, borderRadius: ms(8),
    paddingHorizontal: s(10), paddingVertical: vs(5), maxWidth: '100%',
  },
  pagePillSubLabel: { color: colors.amber, fontSize: fs(9), fontWeight: '700', flexShrink: 0 },
  pagePillSubName: { color: colors.text, fontSize: fs(11), fontWeight: '800', flexShrink: 1 },

  // Banner de substituição (principal riscado → substituto)
  replacedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginHorizontal: s(14),
    marginBottom: vs(10),
    backgroundColor: colors.amberGlow,
    borderRadius: ms(10),
    paddingHorizontal: s(12),
    paddingVertical: vs(8),
    borderWidth: 1,
    borderColor: colors.amber + '44',
  },
  replacedMain: { flexDirection: 'row', alignItems: 'center', gap: s(4), flex: 1 },
  replacedMainText: {
    color: colors.textDim,
    fontSize: fs(10),
    fontWeight: '600',
    textDecorationLine: 'line-through',
    flexShrink: 1,
  },
  replacedMainLabel: { color: colors.textFaint, fontSize: fs(9) },
  replacedSub: { flexDirection: 'row', alignItems: 'center', gap: s(4), flex: 1 },
  replacedSubText: { color: colors.amber, fontSize: fs(10), fontWeight: '800', flexShrink: 1 },

  // Vídeo
  videoWrapper: { marginBottom: vs(0), width: '100%', overflow: 'hidden' },
  videoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: s(6),
    backgroundColor: colors.accentGlow, borderRadius: ms(8),
    paddingHorizontal: s(12), paddingVertical: vs(6),
    marginHorizontal: s(14), marginBottom: vs(8),
  },
  videoBannerText: { color: colors.accent, fontSize: fs(9.5), fontWeight: '700', flex: 1 },
  noVideoBox: {
    flexDirection: 'row', alignItems: 'center', gap: s(8),
    marginHorizontal: s(14), marginBottom: vs(12),
    backgroundColor: colors.surface3, borderRadius: ms(10),
    paddingHorizontal: s(14), paddingVertical: vs(10),
  },
  noVideoText: { color: colors.textFaint, fontSize: fs(10.5) },

  // Séries
  setsBox: {
    marginHorizontal: s(14), marginTop: vs(14), marginBottom: vs(10),
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: s(14),
  },
  setsHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: vs(10),
  },
  setsHeadLabel: {
    color: colors.textFaint, fontSize: fs(9), fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  setsBadge: {
    backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingVertical: vs(3), paddingHorizontal: s(9),
  },
  setsBadgeText: { color: colors.text, fontSize: fs(9), fontWeight: '700' },
  setsRow: { flexDirection: 'row', gap: s(8) },
  setPill: {
    flex: 1, aspectRatio: 1 / 1.05, borderRadius: ms(12),
    backgroundColor: colors.surface2, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 1,
  },
  setPillDrop: { backgroundColor: colors.amberGlow, borderColor: 'rgba(255,182,72,0.4)' },
  setPillN: { fontSize: fs(8), fontWeight: '700', color: colors.textFaint, letterSpacing: 0.4 },
  setPillReps: { fontSize: fs(15), fontWeight: '700', color: colors.text },
  setPillUnit: { fontSize: fs(8.5), color: colors.textFaint, fontWeight: '600' },
  dropBox: {
    flexDirection: 'row', gap: s(7), alignItems: 'flex-start',
    marginTop: vs(12), paddingTop: vs(12),
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  dropText: { color: colors.amber, fontSize: fs(9.5), lineHeight: 16, flex: 1 },

  // Descanso
  restRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(7),
    marginHorizontal: s(14), marginBottom: vs(10),
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: vs(8), paddingHorizontal: s(12),
  },
  restText: { color: colors.textDim, fontSize: fs(10.5) },
  restValue: { color: colors.text, fontWeight: '700' },

  // Instruções
  section: { marginHorizontal: s(14), marginTop: vs(14) },
  sectionLabel: { color: colors.text, fontSize: fs(12), fontWeight: '700', marginBottom: vs(6) },
  sectionText: { color: '#c7c9d1', fontSize: fs(11), lineHeight: 19 },

  // Dica
  tipBox: {
    flexDirection: 'row', gap: s(9), alignItems: 'flex-start',
    marginHorizontal: s(14), marginTop: vs(12), marginBottom: vs(4),
    backgroundColor: colors.accentGlow, borderWidth: 1,
    borderColor: 'rgba(47,230,160,0.25)', borderRadius: radius.md, padding: s(12),
  },
  tipText: { color: '#d6d8de', fontSize: fs(10), lineHeight: 17, flex: 1 },
  tipBold: { color: colors.accent, fontWeight: '700' },

  // Combo
  comboCard: {
    marginHorizontal: s(14), marginTop: vs(14), marginBottom: vs(4),
    borderWidth: 1, borderColor: colors.amber + '55',
    borderRadius: ms(12), backgroundColor: colors.amberGlow, overflow: 'hidden',
  },
  comboCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: s(6),
    paddingHorizontal: s(12), paddingTop: vs(8), paddingBottom: vs(4),
  },
  comboCardHeaderText: { color: colors.amber, fontSize: fs(9), fontWeight: '700', letterSpacing: 0.2 },
  comboRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: s(12), paddingBottom: vs(10), gap: s(10),
  },
  comboIcon: {
    width: s(32), height: s(32), borderRadius: ms(9),
    backgroundColor: colors.amber + '22',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  comboName: { color: colors.text, fontSize: fs(12), fontWeight: '800' },
  comboDetail: { color: colors.textDim, fontSize: fs(10), marginTop: vs(2) },

  // Nav exercício
  exNav: {
    flexDirection: 'row', alignItems: 'center', gap: s(8),
    marginTop: vs(16), marginHorizontal: s(14),
  },
  navSide: {
    width: s(40), height: s(40), borderRadius: ms(10),
    backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  navSideDisabled: { opacity: 0.4 },
  navMain: {
    flex: 1, height: s(40), borderRadius: ms(10),
    backgroundColor: colors.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6),
  },
  navMainText: { color: '#04170F', fontWeight: '700', fontSize: fs(11) },

  // Botão iniciar (fixo)
  startBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: vs(12), paddingBottom: vs(24), paddingHorizontal: s(20),
    gap: vs(8),
  },
  startButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: s(10), backgroundColor: colors.accent,
    borderRadius: ms(14), paddingVertical: vs(15),
  },
  startButtonDisabled: { opacity: 0.6 },
  startButtonText: { color: '#04170F', fontWeight: '800', fontSize: fs(14) },
  skipButton: { alignItems: 'center', paddingVertical: vs(4) },
  skipText: { color: colors.textDim, fontSize: fs(11) },
});
