import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  InputAccessoryView,
  Keyboard,
  Modal,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

const DAYS = [
  { key: 'segunda', label: 'S' },
  { key: 'terca', label: 'T' },
  { key: 'quarta', label: 'Q' },
  { key: 'quinta', label: 'Q' },
  { key: 'sexta', label: 'S' },
  { key: 'sabado', label: 'S' },
  { key: 'domingo', label: 'D' },
];
const DAY_FULL_LABEL = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

const GOALS = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Força'];

const LEVELS = [
  { key: 'iniciante', label: 'Iniciante', dots: 1 },
  { key: 'intermediario', label: 'Intermed.', dots: 2 },
  { key: 'avancado', label: 'Avançado', dots: 3 },
];

const INTENSITIES = [
  { key: 'leve', label: 'Leve' },
  { key: 'moderada', label: 'Moderada' },
  { key: 'intensa', label: 'Intensa' },
];

const STEPS = ['Info', 'Aquec.', 'Exercícios', 'Aeróbico', 'Revisão'];

// Paleta usada para colorir grupos musculares dinamicamente (a base não tem
// uma lista fixa de grupos, então geramos uma cor estável por nome).
const GROUP_COLORS = [
  colors.accent,
  colors.blue,
  '#B388FF',
  colors.amber,
  '#FF6BAE',
  '#54E6B0',
  '#4FD8E8',
  colors.red,
];
const CARDIO_COLOR = '#FF5A7A';

function colorForGroup(group) {
  const key = (group || 'Outros').trim();
  if (!key) return colors.textDim2;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

const isForce = (item) => (item.exercise_type || 'forca') !== 'cardio';

const DONE_ACCESSORY_ID = 'doneAccessoryCreateWorkout';

// ---------- Pequenos componentes reutilizáveis ----------

function DayPill({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.dayPill, active && styles.dayPillActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive, style]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stepper({ value, suffix, onDecrease, onIncrease, tint }) {
  return (
    <View style={[styles.stepper, tint && { backgroundColor: 'rgba(255,90,122,0.12)' }]}>
      <TouchableOpacity style={styles.stepperBtn} onPress={onDecrease} activeOpacity={0.7}>
        <Text style={[styles.stepperBtnText, tint && { color: CARDIO_COLOR }]}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepperVal}>
        {value}
        {suffix || ''}
      </Text>
      <TouchableOpacity style={styles.stepperBtn} onPress={onIncrease} activeOpacity={0.7}>
        <Text style={[styles.stepperBtnText, tint && { color: CARDIO_COLOR }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CreateWorkoutScreen({ route, navigation }) {
  const { session } = useAuth();
  const params = route?.params || {};
  const { workoutId, workoutName: initialWorkoutName } = params;
  const isEditing = !!workoutId;

  const [step, setStep] = useState(0);

  const [name, setName] = useState(initialWorkoutName || '');
  const [dayOfWeek, setDayOfWeek] = useState(null);
  const [goal, setGoal] = useState(null);
  const [level, setLevel] = useState(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(isEditing);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState({});

  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseGroup, setNewExerciseGroup] = useState('');
  const [newExerciseType, setNewExerciseType] = useState('forca');
  const [addingExercise, setAddingExercise] = useState(false);

  const [videos, setVideos] = useState([]);
  const [videoSearch, setVideoSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);

  const [attachTarget, setAttachTarget] = useState(null); // vídeo pro exercício já selecionado
  const [attachSearch, setAttachSearch] = useState('');

  const [comboTarget, setComboTarget] = useState(null); // exercício sendo vinculado a um combinado

  // ── Estado de aquecimento ────────────────────────────────────────────────────
  const [warmupSelected, setWarmupSelected] = useState([]); // exercícios marcados como aquecimento
  const [warmupSearch, setWarmupSearch]     = useState('');
  const [warmupOpenGroups, setWarmupOpenGroups] = useState({});
  const [warmupNewName, setWarmupNewName]       = useState('');
  const [warmupNewGroup, setWarmupNewGroup]     = useState('');
  const [warmupNewType, setWarmupNewType]       = useState('forca');
  const [warmupAddingEx, setWarmupAddingEx]     = useState(false);
  const [warmupVideoSearch, setWarmupVideoSearch]     = useState('');
  const [warmupSelectedVideo, setWarmupSelectedVideo] = useState(null);
  const [warmupAttachTarget, setWarmupAttachTarget]   = useState(null);
  const [warmupAttachSearch, setWarmupAttachSearch]   = useState('');
  // ─────────────────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const loadExercises = async () => {
        const { data } = await supabase
          .from('exercises')
          .select('id, name, muscle_group, video_id, exercise_type')
          .order('muscle_group');
        setExercises(data || []);
      };
      const loadVideos = async () => {
        const { data } = await supabase.from('exercise_videos').select('id, name').order('name');
        setVideos(data || []);
      };
      loadExercises();
      loadVideos();
    }, [])
  );

  // Modo edição: carrega o treino existente e pré-seleciona os exercícios
  useEffect(() => {
    if (!isEditing) return;
    const loadWorkout = async () => {
      const { data: workout } = await supabase
        .from('workouts')
        .select('name, day_of_week, goal, level, period_start, period_end')
        .eq('id', workoutId)
        .single();
      if (workout) {
        setName(workout.name);
        setDayOfWeek(workout.day_of_week);
        setGoal(workout.goal || null);
        setLevel(workout.level || null);
        setPeriodStart(workout.period_start || '');
        setPeriodEnd(workout.period_end || '');
      }
      const { data: items } = await supabase
        .from('workout_exercises')
        .select(
          'target_sets, target_reps, order_index, combo_group, target_duration_minutes, target_distance_km, target_intensity, is_warmup, exercises(id, name, muscle_group, exercise_type)'
        )
        .eq('workout_id', workoutId)
        .order('order_index');
      if (items) {
        const normalItems = items.filter((it) => !it.is_warmup);
        const warmupItems = items.filter((it) => it.is_warmup);
        setSelected(
          normalItems.map((it) => ({
            exercise_id: it.exercises.id,
            name: it.exercises.name,
            muscle_group: it.exercises.muscle_group,
            exercise_type: it.exercises.exercise_type,
            target_sets: it.target_sets,
            target_reps: it.target_reps,
            combo_group: it.combo_group,
            target_duration_minutes: it.target_duration_minutes,
            target_distance_km: it.target_distance_km,
            target_intensity: it.target_intensity,
          }))
        );
        setWarmupSelected(
          warmupItems.map((it) => ({
            exercise_id: it.exercises.id,
            name: it.exercises.name,
            muscle_group: it.exercises.muscle_group,
            exercise_type: it.exercises.exercise_type,
            target_sets: it.target_sets ?? 1,
            target_reps: it.target_reps ?? 10,
            combo_group: null,
            target_duration_minutes: it.target_duration_minutes,
            target_distance_km: null,
            target_intensity: null,
          }))
        );
      }
      setLoadingWorkout(false);
    };
    loadWorkout();
  }, [isEditing, workoutId]);

  const getVideoId = (exerciseId) => exercises.find((e) => e.id === exerciseId)?.video_id || null;
  const isSelected = (id) => selected.some((e) => e.exercise_id === id);
  const selectedOf = (id) => selected.find((e) => e.exercise_id === id);

  const searchLower = search.trim().toLowerCase();
  const forceExercises = exercises.filter((e) => isForce(e));
  const cardioExercises = exercises.filter((e) => !isForce(e));

  const filteredForceExercises = forceExercises.filter((item) => {
    if (!searchLower) return true;
    const nameMatch = (item.name || '').toLowerCase().includes(searchLower);
    const groupMatch = (item.muscle_group || '').toLowerCase().includes(searchLower);
    return nameMatch || groupMatch;
  });

  const groupedExercises = filteredForceExercises.reduce((acc, item) => {
    const g = item.muscle_group || 'Outros';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});
  const groupNames = Object.keys(groupedExercises).sort((a, b) => a.localeCompare(b));

  const videoSearchLower = videoSearch.trim().toLowerCase();
  const filteredVideos = videoSearchLower
    ? videos.filter((v) => (v.name || '').toLowerCase().includes(videoSearchLower))
    : [];

  const handleAddCustomExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert('Atenção', 'Digite o nome do exercício.');
      return;
    }
    setAddingExercise(true);
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: newExerciseName.trim(),
        muscle_group: newExerciseGroup.trim() || null,
        exercise_type: newExerciseType,
        video_id: selectedVideo?.id || null,
        owner_id: session.user.id,
      })
      .select()
      .single();
    setAddingExercise(false);

    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }

    setExercises((prev) => [...prev, data]);
    toggleExercise(data);
    setNewExerciseName('');
    setNewExerciseGroup('');
    setNewExerciseType('forca');
    setVideoSearch('');
    setSelectedVideo(null);
  };

  const toggleExercise = (exercise) => {
    setSelected((prev) => {
      const exists = prev.find((e) => e.exercise_id === exercise.id);
      if (exists) {
        return prev.filter((e) => e.exercise_id !== exercise.id);
      }
      if (!isForce(exercise)) {
        return [
          ...prev,
          {
            exercise_id: exercise.id,
            name: exercise.name,
            muscle_group: exercise.muscle_group,
            exercise_type: 'cardio',
            target_duration_minutes: 15,
            target_distance_km: null,
            target_intensity: 'moderada',
            target_sets: null,
            target_reps: null,
            combo_group: null,
          },
        ];
      }
      return [
        ...prev,
        {
          exercise_id: exercise.id,
          name: exercise.name,
          muscle_group: exercise.muscle_group,
          exercise_type: 'forca',
          target_sets: 3,
          target_reps: 12,
          combo_group: null,
          target_duration_minutes: null,
          target_distance_km: null,
          target_intensity: null,
        },
      ];
    });
  };

  const patchSelected = (exerciseId, patch) => {
    setSelected((prev) => prev.map((e) => (e.exercise_id === exerciseId ? { ...e, ...patch } : e)));
  };

  const bumpSets = (exerciseId, delta) => {
    setSelected((prev) =>
      prev.map((e) =>
        e.exercise_id === exerciseId ? { ...e, target_sets: Math.max(1, (e.target_sets || 1) + delta) } : e
      )
    );
  };
  const bumpReps = (exerciseId, delta) => {
    setSelected((prev) =>
      prev.map((e) =>
        e.exercise_id === exerciseId ? { ...e, target_reps: Math.max(1, (e.target_reps || 1) + delta) } : e
      )
    );
  };
  const bumpDuration = (exerciseId, delta) => {
    setSelected((prev) =>
      prev.map((e) =>
        e.exercise_id === exerciseId
          ? { ...e, target_duration_minutes: Math.max(1, (e.target_duration_minutes || 1) + delta) }
          : e
      )
    );
  };

  // ---------- Combinado / bi-set ----------
  const linkCombo = (target, partner) => {
    setSelected((prev) => {
      let letter = target.combo_group || partner.combo_group;
      if (!letter) {
        const used = new Set(prev.map((s) => s.combo_group).filter(Boolean));
        let candidate = 'A';
        while (used.has(candidate)) candidate = String.fromCharCode(candidate.charCodeAt(0) + 1);
        letter = candidate;
      }
      return prev.map((s) =>
        s.exercise_id === target.exercise_id || s.exercise_id === partner.exercise_id
          ? { ...s, combo_group: letter }
          : s
      );
    });
    setComboTarget(null);
  };

  const unlinkCombo = (target) => {
    setSelected((prev) => {
      const letter = target.combo_group;
      let updated = prev.map((s) => (s.exercise_id === target.exercise_id ? { ...s, combo_group: null } : s));
      if (letter) {
        const remaining = updated.filter((s) => s.combo_group === letter);
        if (remaining.length === 1) {
          updated = updated.map((s) => (s.combo_group === letter ? { ...s, combo_group: null } : s));
        }
      }
      return updated;
    });
    setComboTarget(null);
  };

  const comboPartnerName = (item) => {
    if (!item.combo_group) return null;
    const partner = selected.find((s) => s.combo_group === item.combo_group && s.exercise_id !== item.exercise_id);
    return partner?.name || null;
  };

  // ─── Funções auxiliares de aquecimento ───────────────────────────────────────

  const isWarmupSelected = (id) => warmupSelected.some((e) => e.exercise_id === id);

  const toggleWarmupExercise = (exercise) => {
    setWarmupSelected((prev) => {
      const exists = prev.find((e) => e.exercise_id === exercise.id);
      if (exists) return prev.filter((e) => e.exercise_id !== exercise.id);
      return [
        ...prev,
        {
          exercise_id: exercise.id,
          name: exercise.name,
          muscle_group: exercise.muscle_group,
          exercise_type: isForce(exercise) ? 'forca' : 'cardio',
          target_sets: isForce(exercise) ? 1 : null,
          target_reps: isForce(exercise) ? 10 : null,
          target_duration_minutes: !isForce(exercise) ? 10 : null,
          combo_group: null,
        },
      ];
    });
  };

  const bumpWarmupSets = (exerciseId, delta) =>
    setWarmupSelected((prev) =>
      prev.map((e) =>
        e.exercise_id === exerciseId ? { ...e, target_sets: Math.max(1, (e.target_sets || 1) + delta) } : e
      )
    );

  const bumpWarmupReps = (exerciseId, delta) =>
    setWarmupSelected((prev) =>
      prev.map((e) =>
        e.exercise_id === exerciseId ? { ...e, target_reps: Math.max(1, (e.target_reps || 1) + delta) } : e
      )
    );

  const bumpWarmupDuration = (exerciseId, delta) =>
    setWarmupSelected((prev) =>
      prev.map((e) =>
        e.exercise_id === exerciseId
          ? { ...e, target_duration_minutes: Math.max(1, (e.target_duration_minutes || 1) + delta) }
          : e
      )
    );

  const handleAddWarmupExercise = async () => {
    if (!warmupNewName.trim()) {
      Alert.alert('Atenção', 'Digite o nome do exercício de aquecimento.');
      return;
    }
    setWarmupAddingEx(true);
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name: warmupNewName.trim(),
        muscle_group: warmupNewGroup.trim() || null,
        exercise_type: warmupNewType,
        video_id: warmupSelectedVideo?.id || null,
        owner_id: session.user.id,
      })
      .select()
      .single();
    setWarmupAddingEx(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setExercises((prev) => [...prev, data]);
    toggleWarmupExercise(data);
    setWarmupNewName('');
    setWarmupNewGroup('');
    setWarmupNewType('forca');
    setWarmupVideoSearch('');
    setWarmupSelectedVideo(null);
  };

  const attachWarmupVideo = async (video) => {
    const { error } = await supabase
      .from('exercises')
      .update({ video_id: video.id })
      .eq('id', warmupAttachTarget.exerciseId);
    if (error) { Alert.alert('Erro', error.message); return; }
    setExercises((prev) =>
      prev.map((e) => (e.id === warmupAttachTarget.exerciseId ? { ...e, video_id: video.id } : e))
    );
    setWarmupAttachTarget(null);
    setWarmupAttachSearch('');
  };

  const warmupSearchLower    = warmupSearch.trim().toLowerCase();
  const filteredWarmupVideos = warmupVideoSearch.trim()
    ? videos.filter((v) => v.name.toLowerCase().includes(warmupVideoSearch.trim().toLowerCase()))
    : [];
  const filteredWarmupAttachVideos = warmupAttachSearch.trim()
    ? videos.filter((v) => v.name.toLowerCase().includes(warmupAttachSearch.trim().toLowerCase()))
    : videos;

  const warmupGrouped = exercises.reduce((acc, item) => {
    if (warmupSearchLower && !(item.name || '').toLowerCase().includes(warmupSearchLower) &&
        !(item.muscle_group || '').toLowerCase().includes(warmupSearchLower)) return acc;
    const g = item.muscle_group || 'Outros';
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});
  const warmupGroupNames = Object.keys(warmupGrouped).sort((a, b) => a.localeCompare(b));

  // ─────────────────────────────────────────────────────────────────────────────

  // ---------- Vídeo de demonstração ----------
  const attachVideoToSelected = async (video) => {
    const { error } = await supabase.from('exercises').update({ video_id: video.id }).eq('id', attachTarget.exerciseId);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setExercises((prev) => prev.map((e) => (e.id === attachTarget.exerciseId ? { ...e, video_id: video.id } : e)));
    setAttachTarget(null);
    setAttachSearch('');
  };

  const attachSearchLower = attachSearch.trim().toLowerCase();
  const filteredAttachVideos = attachSearchLower
    ? videos.filter((v) => (v.name || '').toLowerCase().includes(attachSearchLower))
    : videos;

  // ---------- Estatísticas (usadas no header e na revisão) ----------
  const forceSelected = selected.filter(isForce);
  const cardioSelected = selected.filter((s) => !isForce(s));
  const totalCount = selected.length;
  const groupsUsed = [...new Set(forceSelected.map((e) => e.muscle_group || 'Outros'))];
  const totalGroupsAvailable = [...new Set(forceExercises.map((e) => e.muscle_group || 'Outros'))].length || 1;
  const estimatedMinutes = Math.round(
    forceSelected.reduce((acc, e) => acc + (e.target_sets || 0) * 1.4, forceSelected.length ? 6 : 0) +
      cardioSelected.reduce((acc, e) => acc + (e.target_duration_minutes || 0), 0)
  );

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Atenção', 'Dê um nome ao seu treino (ex: Treino A).');
      setStep(0);
      return;
    }
    if (selected.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um exercício.');
      setStep(1);
      return;
    }
    setSaving(true);

    const workoutPayload = {
      name,
      day_of_week: dayOfWeek,
      goal,
      level,
      period_start: periodStart || null,
      period_end: periodEnd || null,
    };

    let workout;
    if (isEditing) {
      const { data, error } = await supabase
        .from('workouts')
        .update(workoutPayload)
        .eq('id', workoutId)
        .select()
        .single();
      if (error) {
        setSaving(false);
        Alert.alert('Erro', error.message);
        return;
      }
      workout = data;
      await supabase.from('workout_exercises').delete().eq('workout_id', workoutId);
    } else {
      const { data, error } = await supabase
        .from('workouts')
        .insert({ user_id: session.user.id, ...workoutPayload })
        .select()
        .single();
      if (error) {
        setSaving(false);
        Alert.alert('Erro', error.message);
        return;
      }
      workout = data;
    }

    const warmupRows = warmupSelected.map((e, index) => ({
      workout_id: workout.id,
      exercise_id: e.exercise_id,
      order_index: -(warmupSelected.length - index), // índices negativos = ficam antes
      is_warmup: true,
      combo_group: null,
      target_sets: isForce(e) ? e.target_sets : null,
      target_reps: isForce(e) ? e.target_reps : null,
      target_duration_minutes: !isForce(e) ? e.target_duration_minutes : null,
      target_distance_km: null,
      target_intensity: null,
    }));

    const rows = selected.map((e, index) => ({
      workout_id: workout.id,
      exercise_id: e.exercise_id,
      order_index: index,
      is_warmup: false,
      combo_group: isForce(e) ? e.combo_group : null,
      target_sets: isForce(e) ? e.target_sets : null,
      target_reps: isForce(e) ? e.target_reps : null,
      target_duration_minutes: !isForce(e) ? e.target_duration_minutes : null,
      target_distance_km: !isForce(e) ? e.target_distance_km : null,
      target_intensity: !isForce(e) ? e.target_intensity : null,
    }));

    const { error: insertError } = await supabase.from('workout_exercises').insert([...warmupRows, ...rows]);
    setSaving(false);

    if (insertError) {
      Alert.alert('Erro', insertError.message);
      return;
    }

    navigation.goBack();
  };

  if (loadingWorkout) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textDim }}>Carregando treino...</Text>
      </View>
    );
  }

  const subtitleParts = [];
  if (dayOfWeek) subtitleParts.push(DAY_FULL_LABEL[dayOfWeek]);
  if (goal) subtitleParts.push(goal);
  if (level) subtitleParts.push(LEVELS.find((l) => l.key === level)?.label);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Feather name="chevron-left" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{isEditing ? 'Editando treino' : 'Novo treino'}</Text>
          <Text style={styles.topTitle} numberOfLines={1}>
            {name || 'Sem nome'}
          </Text>
        </View>
        <View style={styles.ringBadge}>
          <Text style={styles.ringBadgeNum}>{groupsUsed.length}</Text>
          <Text style={styles.ringBadgeLabel}>/{totalGroupsAvailable} grupos</Text>
        </View>
      </View>

      {/* Abas de etapa */}
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <TouchableOpacity
            key={s}
            style={[styles.stepBtn, step === i && styles.stepBtnActive]}
            onPress={() => setStep(i)}
            activeOpacity={0.85}
          >
            <View style={[styles.stepNum, step === i && styles.stepNumActive]}>
              <Text style={[styles.stepNumText, step === i && styles.stepNumTextActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepBtnText, step === i && styles.stepBtnTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
        {/* PASSO 1: INFO */}
        {step === 0 && (
          <View>
            <Text style={styles.fieldLabel}>Nome do treino</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Treino A - Peito e Tríceps"
              placeholderTextColor={colors.textDim2}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.fieldLabel}>
              Dia da semana <Text style={styles.hint}>opcional</Text>
            </Text>
            <View style={styles.pillRow}>
              {DAYS.map((d) => (
                <DayPill
                  key={d.key}
                  label={d.label}
                  active={dayOfWeek === d.key}
                  onPress={() => setDayOfWeek(dayOfWeek === d.key ? null : d.key)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              Objetivo <Text style={styles.hint}>opcional</Text>
            </Text>
            <View style={styles.pillRow}>
              {GOALS.map((g) => (
                <Chip key={g} label={g} active={goal === g} onPress={() => setGoal(goal === g ? null : g)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              Nível <Text style={styles.hint}>opcional</Text>
            </Text>
            <View style={styles.levelTrack}>
              {LEVELS.map((l) => (
                <Chip
                  key={l.key}
                  label={l.label}
                  active={level === l.key}
                  onPress={() => setLevel(level === l.key ? null : l.key)}
                  style={{ flex: 1 }}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              Período do bloco <Text style={styles.hint}>opcional</Text>
            </Text>
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>Início</Text>
                <TextInput
                  style={styles.input}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textDim2}
                  value={periodStart}
                  onChangeText={setPeriodStart}
                  inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>Fim</Text>
                <TextInput
                  style={styles.input}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textDim2}
                  value={periodEnd}
                  onChangeText={setPeriodEnd}
                  inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(1)} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Escolher exercícios</Text>
              <Feather name="chevron-right" size={16} color="#04170F" />
            </TouchableOpacity>
          </View>
        )}

        {/* PASSO 2: AQUECIMENTO */}
        {step === 1 && (
          <View>
            {/* Banner de info */}
            <View style={styles.warmupBanner}>
              <Feather name="activity" size={14} color={colors.amber} />
              <Text style={styles.warmupBannerText}>
                Selecione os exercícios de aquecimento. Eles aparecerão no topo do treino e o aluno precisará confirmá-los antes de iniciar.
              </Text>
            </View>

            {/* Chips dos selecionados com vídeo */}
            {warmupSelected.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.sectionLabel}>Vídeos dos aquecimentos selecionados:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {warmupSelected.map((ws) => {
                    const hasVideo = !!getVideoId(ws.exercise_id);
                    return (
                      <TouchableOpacity
                        key={ws.exercise_id}
                        style={[styles.videoChip, { borderColor: colors.amberGlow }, hasVideo && { borderColor: colors.amber, backgroundColor: colors.amberGlow }]}
                        onPress={() => setWarmupAttachTarget({ exerciseId: ws.exercise_id, name: ws.name })}
                      >
                        <Feather name={hasVideo ? 'film' : 'plus'} size={12} color={hasVideo ? colors.amber : colors.textDim} />
                        <Text style={[styles.videoChipText, hasVideo && { color: colors.amber, fontWeight: '600' }]}> {ws.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Busca */}
            <View style={styles.searchBox}>
              <Feather name="search" size={15} color={colors.textDim2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar exercício de aquecimento"
                placeholderTextColor={colors.textDim2}
                value={warmupSearch}
                onChangeText={setWarmupSearch}
              />
            </View>

            {/* Lista agrupada por músculo */}
            {warmupGroupNames.map((groupName) => {
              const gItems = warmupGrouped[groupName];
              const groupColor = colorForGroup(groupName);
              const selCount = gItems.filter((it) => isWarmupSelected(it.id)).length;
              const isOpen = warmupOpenGroups[groupName] !== false;
              return (
                <View key={groupName}>
                  <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => setWarmupOpenGroups((p) => ({ ...p, [groupName]: !isOpen }))}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.groupDot, { backgroundColor: groupColor }]} />
                    <Text style={styles.groupTitle}>{groupName}</Text>
                    <View style={styles.groupCount}>
                      <Text style={styles.groupCountText}>{selCount}/{gItems.length}</Text>
                    </View>
                    <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textDim2} />
                  </TouchableOpacity>

                  {isOpen && gItems.map((item) => {
                    const wsel = warmupSelected.find((e) => e.exercise_id === item.id);
                    return (
                      <View
                        key={item.id}
                        style={[styles.exCard, wsel && { borderColor: 'rgba(255,182,72,0.4)', backgroundColor: colors.surface2 }]}
                      >
                        <TouchableOpacity style={styles.exRow} onPress={() => toggleWarmupExercise(item)} activeOpacity={0.8}>
                          <View style={[styles.checkbox, wsel && { backgroundColor: colors.amber, borderColor: colors.amber }]}>
                            {wsel && <Feather name="check" size={12} color="#04170F" />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.exName}>{item.name}</Text>
                            <Text style={styles.exGroup}>{groupName}</Text>
                          </View>
                        </TouchableOpacity>

                        {wsel && (
                          <View style={styles.exDetail}>
                            {isForce(item) ? (
                              <>
                                <Stepper
                                  value={wsel.target_sets}
                                  onDecrease={() => bumpWarmupSets(item.id, -1)}
                                  onIncrease={() => bumpWarmupSets(item.id, 1)}
                                />
                                <Text style={styles.x}>×</Text>
                                <Stepper
                                  value={wsel.target_reps}
                                  onDecrease={() => bumpWarmupReps(item.id, -1)}
                                  onIncrease={() => bumpWarmupReps(item.id, 1)}
                                />
                              </>
                            ) : (
                              <Stepper
                                value={wsel.target_duration_minutes}
                                suffix="min"
                                tint
                                onDecrease={() => bumpWarmupDuration(item.id, -1)}
                                onIncrease={() => bumpWarmupDuration(item.id, 1)}
                              />
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Criar exercício de aquecimento novo */}
            <View style={[styles.customBox, { borderColor: colors.amberGlow }]}>
              <Text style={styles.sectionLabel}>Não achou? Crie um exercício de aquecimento:</Text>

              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <TouchableOpacity
                  style={[styles.fcBtn, warmupNewType === 'forca' && styles.fcBtnActive, { marginRight: 8 }]}
                  onPress={() => setWarmupNewType('forca')}
                >
                  <Text style={[styles.fcBtnText, warmupNewType === 'forca' && styles.fcBtnTextActive]}>⚡ Força</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fcBtn, warmupNewType === 'cardio' && { backgroundColor: colors.amberGlow, borderColor: colors.amber }]}
                  onPress={() => setWarmupNewType('cardio')}
                >
                  <Text style={[styles.fcBtnText, warmupNewType === 'cardio' && { color: colors.amber }]}>🔥 Cardio/Leve</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row' }}>
                <TextInput
                  style={[styles.smallFlexInput, { marginRight: 8 }]}
                  placeholder="Nome do exercício"
                  placeholderTextColor={colors.textDim2}
                  value={warmupNewName}
                  onChangeText={setWarmupNewName}
                />
                {warmupNewType === 'forca' && (
                  <TextInput
                    style={styles.smallFlexInput}
                    placeholder="Grupo (opcional)"
                    placeholderTextColor={colors.textDim2}
                    value={warmupNewGroup}
                    onChangeText={setWarmupNewGroup}
                  />
                )}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Vídeo de demonstração (opcional):</Text>
              {warmupSelectedVideo ? (
                <View style={styles.videoSelectedRow}>
                  <Feather name="film" size={13} color={colors.amber} />
                  <Text style={[styles.videoSelectedText, { color: colors.amber }]}> {warmupSelectedVideo.name}</Text>
                  <TouchableOpacity onPress={() => setWarmupSelectedVideo(null)}>
                    <Text style={styles.videoRemove}>trocar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Buscar vídeo já enviado, pelo nome"
                    placeholderTextColor={colors.textDim2}
                    value={warmupVideoSearch}
                    onChangeText={setWarmupVideoSearch}
                  />
                  {filteredWarmupVideos.length > 0 && (
                    <View style={styles.videoResultsBox}>
                      {filteredWarmupVideos.map((v) => (
                        <TouchableOpacity
                          key={v.id}
                          style={styles.videoResultRow}
                          onPress={() => { setWarmupSelectedVideo(v); setWarmupVideoSearch(''); }}
                        >
                          <Feather name="film" size={13} color={colors.amber} />
                          <Text style={styles.videoResultText}> {v.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity onPress={() => navigation.navigate('UploadVideo', { exerciseName: warmupNewName.trim() || undefined })}>
                    <Text style={[styles.uploadLink, { color: colors.amber }]}>+ Enviar vídeo novo</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.addButton, { marginTop: 12, backgroundColor: colors.amber }]}
                onPress={handleAddWarmupExercise}
                disabled={warmupAddingEx}
              >
                <Text style={styles.addButtonText}>{warmupAddingEx ? '...' : 'Adicionar ao aquecimento'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Ir para exercícios</Text>
              <Feather name="chevron-right" size={16} color="#04170F" />
            </TouchableOpacity>
          </View>
        )}

        {/* PASSO 3: EXERCÍCIOS */}
        {step === 2 && (
          <View>
            {selected.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.sectionLabel}>Vídeos dos exercícios selecionados:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {selected.map((s) => {
                    const hasVideo = !!getVideoId(s.exercise_id);
                    return (
                      <TouchableOpacity
                        key={s.exercise_id}
                        style={[styles.videoChip, hasVideo && styles.videoChipDone]}
                        onPress={() => setAttachTarget({ exerciseId: s.exercise_id, name: s.name })}
                      >
                        <Feather name={hasVideo ? 'film' : 'plus'} size={12} color={hasVideo ? colors.accent : colors.textDim} />
                        <Text style={[styles.videoChipText, hasVideo && styles.videoChipTextDone]}> {s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.searchBox}>
              <Feather name="search" size={15} color={colors.textDim2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome ou grupo (ex: Peito)"
                placeholderTextColor={colors.textDim2}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {groupNames.map((groupName) => {
              const items = groupedExercises[groupName];
              const groupColor = colorForGroup(groupName);
              const selCount = items.filter((it) => isSelected(it.id)).length;
              const isOpen = openGroups[groupName] !== false;
              return (
                <View key={groupName}>
                  <TouchableOpacity
                    style={styles.groupHeader}
                    onPress={() => setOpenGroups((p) => ({ ...p, [groupName]: !isOpen }))}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.groupDot, { backgroundColor: groupColor }]} />
                    <Text style={styles.groupTitle}>{groupName}</Text>
                    <View style={styles.groupCount}>
                      <Text style={styles.groupCountText}>
                        {selCount}/{items.length}
                      </Text>
                    </View>
                    <Feather
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.textDim2}
                    />
                  </TouchableOpacity>

                  {isOpen &&
                    items.map((item) => {
                      const sel = selectedOf(item.id);
                      const partnerName = sel ? comboPartnerName(sel) : null;
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.exCard,
                            sel && { borderColor: 'rgba(51,226,139,0.35)', backgroundColor: colors.surface2 },
                          ]}
                        >
                          <TouchableOpacity style={styles.exRow} onPress={() => toggleExercise(item)} activeOpacity={0.8}>
                            <View style={[styles.checkbox, sel && styles.checkboxChecked]}>
                              {sel && <Feather name="check" size={12} color="#04170F" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.exName}>{item.name}</Text>
                              <Text style={styles.exGroup}>{groupName}</Text>
                            </View>
                          </TouchableOpacity>

                          {sel && (
                            <View style={styles.exDetail}>
                              <Stepper
                                value={sel.target_sets}
                                onDecrease={() => bumpSets(item.id, -1)}
                                onIncrease={() => bumpSets(item.id, 1)}
                              />
                              <Text style={styles.x}>×</Text>
                              <Stepper
                                value={sel.target_reps}
                                onDecrease={() => bumpReps(item.id, -1)}
                                onIncrease={() => bumpReps(item.id, 1)}
                              />
                              <TouchableOpacity
                                style={[styles.comboTag, sel.combo_group && styles.comboTagOn]}
                                onPress={() => setComboTarget(sel)}
                                activeOpacity={0.8}
                              >
                                <Feather name="link" size={11} color={sel.combo_group ? colors.amber : colors.textDim} />
                                <Text style={[styles.comboTagText, sel.combo_group && styles.comboTagTextOn]}>
                                  {' '}
                                  {sel.combo_group ? `Com ${partnerName || '...'}` : 'Combinado'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                </View>
              );
            })}

            <View style={styles.customBox}>
              <Text style={styles.sectionLabel}>Não achou? Adicione um exercício novo:</Text>
              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                <TouchableOpacity
                  style={[styles.fcBtn, newExerciseType === 'forca' && styles.fcBtnActive, { marginRight: 8 }]}
                  onPress={() => setNewExerciseType('forca')}
                >
                  <Text style={[styles.fcBtnText, newExerciseType === 'forca' && styles.fcBtnTextActive]}>⚡ Força</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fcBtn, newExerciseType === 'cardio' && styles.fcBtnActive]}
                  onPress={() => setNewExerciseType('cardio')}
                >
                  <Text style={[styles.fcBtnText, newExerciseType === 'cardio' && styles.fcBtnTextActive]}>♡ Cardio</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row' }}>
                <TextInput
                  style={[styles.smallFlexInput, { marginRight: 8 }]}
                  placeholder="Nome do exercício"
                  placeholderTextColor={colors.textDim2}
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                />
                {newExerciseType === 'forca' && (
                  <TextInput
                    style={styles.smallFlexInput}
                    placeholder="Grupo (opcional)"
                    placeholderTextColor={colors.textDim2}
                    value={newExerciseGroup}
                    onChangeText={setNewExerciseGroup}
                  />
                )}
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Vídeo de demonstração (opcional):</Text>
              {selectedVideo ? (
                <View style={styles.videoSelectedRow}>
                  <Feather name="film" size={13} color={colors.accent} />
                  <Text style={styles.videoSelectedText}> {selectedVideo.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedVideo(null)}>
                    <Text style={styles.videoRemove}>trocar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Buscar vídeo já enviado, pelo nome"
                    placeholderTextColor={colors.textDim2}
                    value={videoSearch}
                    onChangeText={setVideoSearch}
                  />
                  {filteredVideos.length > 0 && (
                    <View style={styles.videoResultsBox}>
                      {filteredVideos.map((v) => (
                        <TouchableOpacity
                          key={v.id}
                          style={styles.videoResultRow}
                          onPress={() => {
                            setSelectedVideo(v);
                            setVideoSearch('');
                          }}
                        >
                          <Feather name="film" size={13} color={colors.accent} />
                          <Text style={styles.videoResultText}> {v.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('UploadVideo', {
                        exerciseName: newExerciseName.trim() || undefined,
                      })
                    }
                  >
                    <Text style={styles.uploadLink}>+ Enviar vídeo novo</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.addButton, { marginTop: 12 }]}
                onPress={handleAddCustomExercise}
                disabled={addingExercise}
              >
                <Text style={styles.addButtonText}>{addingExercise ? '...' : 'Adicionar exercício'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Ir para aeróbico</Text>
              <Feather name="chevron-right" size={16} color="#04170F" />
            </TouchableOpacity>
          </View>
        )}

        {/* PASSO 4: AERÓBICO */}
        {step === 3 && (
          <View>
            <Text style={styles.fieldLabel}>
              Selecione os exercícios aeróbicos <Text style={styles.hint}>opcional</Text>
            </Text>

            {cardioExercises.length === 0 && (
              <Text style={styles.emptyHint}>
                Nenhum exercício aeróbico cadastrado ainda. Volte para "Exercícios" e adicione um marcando o tipo{' '}
                <Text style={{ color: colors.accent, fontWeight: '700' }}>Cardio</Text>.
              </Text>
            )}

            {cardioExercises.map((item) => {
              const sel = selectedOf(item.id);
              return (
                <View
                  key={item.id}
                  style={[
                    styles.exCard,
                    sel && { borderColor: 'rgba(255,90,122,0.4)', backgroundColor: colors.surface2 },
                  ]}
                >
                  <TouchableOpacity style={styles.exRow} onPress={() => toggleExercise(item)} activeOpacity={0.8}>
                    <View style={styles.cardioIcon}>
                      <Feather name="activity" size={16} color={CARDIO_COLOR} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName}>{item.name}</Text>
                      <Text style={styles.exGroup}>Aeróbico</Text>
                    </View>
                    <View style={[styles.checkbox, sel && { backgroundColor: CARDIO_COLOR, borderColor: CARDIO_COLOR }]}>
                      {sel && <Feather name="check" size={12} color="#04170F" />}
                    </View>
                  </TouchableOpacity>

                  {sel && (
                    <View style={[styles.exDetail, { flexWrap: 'wrap' }]}>
                      <Stepper
                        value={sel.target_duration_minutes}
                        suffix="min"
                        tint
                        onDecrease={() => bumpDuration(item.id, -1)}
                        onIncrease={() => bumpDuration(item.id, 1)}
                      />
                      <TextInput
                        style={styles.distanceInput}
                        placeholder="km"
                        placeholderTextColor={colors.textDim2}
                        keyboardType="decimal-pad"
                        inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                        value={sel.target_distance_km != null ? String(sel.target_distance_km) : ''}
                        onChangeText={(v) => patchSelected(item.id, { target_distance_km: v ? parseFloat(v.replace(',', '.')) : null })}
                      />
                      <View style={styles.intensityRow}>
                        {INTENSITIES.map((iv) => (
                          <TouchableOpacity
                            key={iv.key}
                            style={[styles.intensityChip, sel.target_intensity === iv.key && styles.intensityChipOn]}
                            onPress={() => patchSelected(item.id, { target_intensity: iv.key })}
                          >
                            <Text
                              style={[
                                styles.intensityChipText,
                                sel.target_intensity === iv.key && styles.intensityChipTextOn,
                              ]}
                            >
                              {iv.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(4)} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>Ir para revisão</Text>
              <Feather name="chevron-right" size={16} color="#04170F" />
            </TouchableOpacity>
          </View>
        )}

        {/* PASSO 5: REVISÃO */}
        {step === 4 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{name || 'Treino sem nome'}</Text>
            {subtitleParts.length > 0 && <Text style={styles.summarySub}>{subtitleParts.join(' · ')}</Text>}

            <View style={styles.metaGrid}>
              <View style={styles.metaBox}>
                <Text style={styles.metaK}>Exercícios</Text>
                <Text style={styles.metaV}>{totalCount} selecionados</Text>
              </View>
              <View style={styles.metaBox}>
                <Text style={styles.metaK}>Duração est.</Text>
                <Text style={styles.metaV}>{totalCount > 0 ? `${estimatedMinutes} min` : '—'}</Text>
              </View>
            </View>

            {(groupsUsed.length > 0 || cardioSelected.length > 0) && (
              <View style={styles.legendRow}>
                {groupsUsed.map((g) => (
                  <View key={g} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colorForGroup(g) }]} />
                    <Text style={styles.legendText}>{g}</Text>
                    <Text style={styles.legendCount}>{forceSelected.filter((e) => (e.muscle_group || 'Outros') === g).length}</Text>
                  </View>
                ))}
                {cardioSelected.length > 0 && (
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CARDIO_COLOR }]} />
                    <Text style={styles.legendText}>Aeróbico</Text>
                    <Text style={styles.legendCount}>{cardioSelected.length}</Text>
                  </View>
                )}
              </View>
            )}

            {totalCount === 0 && warmupSelected.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={30} color={colors.textDim2} />
                <Text style={styles.emptyStateText}>
                  Nenhum exercício selecionado ainda.{'\n'}Volte para as etapas 2 e 3 e escolha alguns.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {warmupSelected.length > 0 && (
                  <View style={styles.reviewWarmupSection}>
                    <View style={styles.reviewWarmupHeader}>
                      <Feather name="activity" size={12} color={colors.amber} />
                      <Text style={styles.reviewWarmupLabel}>AQUECIMENTO ({warmupSelected.length})</Text>
                    </View>
                    {warmupSelected.map((e, idx) => (
                      <View key={e.exercise_id} style={[styles.reviewItem, { borderLeftColor: colors.amber }]}>
                        <Text style={styles.reviewN}>{String(idx + 1).padStart(2, '0')}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewName}>{e.name}</Text>
                          <Text style={styles.reviewGroup}>{e.muscle_group || 'Aquecimento'}</Text>
                        </View>
                        <Text style={[styles.reviewStat, { backgroundColor: colors.amberGlow, color: colors.amber }]}>
                          {isForce(e) ? `${e.target_sets}×${e.target_reps}` : `${e.target_duration_minutes} min`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {selected.map((e, idx) => {
                  const color = isForce(e) ? colorForGroup(e.muscle_group) : CARDIO_COLOR;
                  return (
                    <View key={e.exercise_id} style={[styles.reviewItem, { borderLeftColor: color }]}>
                      <Text style={styles.reviewN}>{String(idx + 1).padStart(2, '0')}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewName}>
                          {e.name}
                          {e.combo_group ? ' 🔗' : ''}
                        </Text>
                        <Text style={styles.reviewGroup}>
                          {isForce(e)
                            ? e.muscle_group || 'Outros'
                            : `${e.target_intensity || 'moderada'}${e.target_distance_km ? ` · ${e.target_distance_km}km` : ''}`}
                        </Text>
                      </View>
                      <Text style={styles.reviewStat}>
                        {isForce(e) ? `${e.target_sets}×${e.target_reps}` : `${e.target_duration_minutes} min`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Barra inferior fixa */}
      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bottomBig}>
            {totalCount} exercício{totalCount !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.bottomLbl}>
            {groupsUsed.length > 0 ? `${groupsUsed.length} grupo${groupsUsed.length !== 1 ? 's' : ''} coberto${groupsUsed.length !== 1 ? 's' : ''}` : 'nenhum grupo coberto ainda'}
            {cardioSelected.length > 0 ? ` · ${cardioSelected.length} aeróbico${cardioSelected.length !== 1 ? 's' : ''}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar treino'}</Text>
          <Feather name="check" size={14} color="#04170F" />
        </TouchableOpacity>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
          <View style={styles.accessoryBar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()}>
              <Text style={styles.accessoryDone}>Pronto</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      {/* Modal: vincular combinado */}
      <Modal visible={!!comboTarget} transparent animationType="slide" onRequestClose={() => setComboTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Vincular combinado</Text>
            <Text style={styles.modalSub}>Toque em outro exercício para formar um combinado (bi-set) com "{comboTarget?.name}"</Text>
            <FlatList
              style={{ maxHeight: 320, marginTop: 12 }}
              data={selected.filter((s) => isForce(s) && s.exercise_id !== comboTarget?.exercise_id)}
              keyExtractor={(s) => s.exercise_id}
              ListEmptyComponent={<Text style={styles.modalEmpty}>Selecione outro exercício de força no treino para poder vincular.</Text>}
              renderItem={({ item }) => {
                const picked = comboTarget?.combo_group && item.combo_group === comboTarget.combo_group;
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, picked && styles.modalOptionPicked]}
                    onPress={() => linkCombo(comboTarget, item)}
                  >
                    <View style={[styles.legendDot, { backgroundColor: colorForGroup(item.muscle_group) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalOptionName}>{item.name}</Text>
                      <Text style={styles.modalOptionGroup}>{item.muscle_group || 'Outros'}</Text>
                    </View>
                    {picked && <Feather name="check" size={16} color={colors.accent} />}
                  </TouchableOpacity>
                );
              }}
            />
            {comboTarget?.combo_group && (
              <TouchableOpacity style={styles.modalClose} onPress={() => unlinkCombo(comboTarget)}>
                <Text style={[styles.modalCloseText, { color: colors.red }]}>Remover vínculo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalClose} onPress={() => setComboTarget(null)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: anexar vídeo ao exercício de aquecimento */}
      <Modal visible={!!warmupAttachTarget} transparent animationType="slide" onRequestClose={() => setWarmupAttachTarget(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Vídeo para "{warmupAttachTarget?.name}"</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Buscar vídeo pelo nome"
              placeholderTextColor={colors.textDim2}
              value={warmupAttachSearch}
              onChangeText={setWarmupAttachSearch}
              autoFocus
            />
            <FlatList
              style={{ maxHeight: 260 }}
              data={filteredWarmupAttachVideos}
              keyExtractor={(v) => v.id}
              ListEmptyComponent={<Text style={styles.modalEmpty}>Nenhum vídeo encontrado.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalVideoRow} onPress={() => attachWarmupVideo(item)}>
                  <Feather name="film" size={14} color={colors.amber} />
                  <Text style={styles.modalVideoText}> {item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => {
                const target = warmupAttachTarget;
                setWarmupAttachTarget(null);
                navigation.navigate('UploadVideo', { exerciseId: target?.exerciseId, exerciseName: target?.name });
              }}
            >
              <Text style={[styles.uploadLink, { color: colors.amber }]}>+ Enviar vídeo novo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setWarmupAttachTarget(null)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: anexar vídeo */}
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
            <FlatList
              style={{ maxHeight: 260 }}
              data={filteredAttachVideos}
              keyExtractor={(v) => v.id}
              ListEmptyComponent={<Text style={styles.modalEmpty}>Nenhum vídeo encontrado.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalVideoRow} onPress={() => attachVideoToSelected(item)}>
                  <Feather name="film" size={14} color={colors.accent} />
                  <Text style={styles.modalVideoText}> {item.name}</Text>
                </TouchableOpacity>
              )}
            />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: screenPaddingTop },

  // Header
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: s(18), marginBottom: vs(4) },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: colors.textDim2, fontSize: fs(9), letterSpacing: 0.6, textTransform: 'uppercase' },
  topTitle: { color: colors.text, fontSize: fs(17), fontWeight: '800', marginTop: vs(2) },
  ringBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingHorizontal: s(10),
    paddingVertical: vs(6),
  },
  ringBadgeNum: { color: colors.accent, fontWeight: '800', fontSize: fs(12) },
  ringBadgeLabel: { color: colors.textDim2, fontSize: fs(9), marginLeft: 2 },

  // Step tabs
  steps: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginTop: vs(14),
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: vs(9),
    borderRadius: 11,
  },
  stepBtnActive: { backgroundColor: colors.accent },
  stepNum: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: { backgroundColor: '#08110A' },
  stepNumText: { color: colors.textDim, fontSize: fs(9), fontWeight: '700' },
  stepNumTextActive: { color: colors.accent },
  stepBtnText: { color: colors.textDim2, fontSize: fs(9), fontWeight: '700' },
  stepBtnTextActive: { color: '#08110A' },

  fieldLabel: {
    fontSize: fs(9.5),
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: vs(18),
    marginBottom: vs(9),
  },
  hint: { fontWeight: '400', textTransform: 'none', color: colors.textDim2, fontSize: fs(9) },
  sectionLabel: { color: colors.textDim, marginBottom: vs(8), fontSize: fs(11) },
  emptyHint: { color: colors.textDim2, fontSize: fs(11), lineHeight: 19, marginTop: vs(4) },

  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: fs(13),
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayPillText: { color: colors.textDim, fontWeight: '700', fontSize: fs(10) },
  dayPillTextActive: { color: '#08110A' },

  chip: {
    paddingVertical: vs(9),
    paddingHorizontal: s(14),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: fs(10.5), fontWeight: '600' },
  chipTextActive: { color: colors.accent },

  levelTrack: { flexDirection: 'row', gap: 8 },

  dateRow: { flexDirection: 'row', gap: 10 },
  dateLabel: { color: colors.textDim2, fontSize: fs(9), marginBottom: vs(5) },

  nextBtn: {
    marginTop: vs(24),
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: vs(15),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextBtnText: { color: '#04170F', fontWeight: '700', fontSize: fs(12.5) },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: s(14),
    paddingVertical: vs(12),
    marginBottom: vs(14),
  },
  searchInput: { flex: 1, color: colors.text, fontSize: fs(12) },

  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: vs(10),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: vs(2),
  },
  groupDot: { width: 9, height: 9, borderRadius: 5 },
  groupTitle: { color: colors.text, fontSize: fs(12.5), fontWeight: '700', flex: 1, textTransform: 'capitalize' },
  groupCount: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: s(8),
    paddingVertical: vs(2),
  },
  groupCountText: { color: colors.textDim2, fontSize: fs(9), fontWeight: '600' },

  exCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 13,
    marginTop: vs(8),
  },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  exName: { color: colors.text, fontSize: fs(12.5), fontWeight: '600' },
  exGroup: { color: colors.textDim2, fontSize: fs(9.5), marginTop: vs(1), textTransform: 'capitalize' },
  exDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: vs(12),
    paddingTop: vs(12),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  x: { color: colors.textDim2, fontSize: fs(10) },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepperBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: colors.accent, fontSize: fs(14), fontWeight: '700' },
  stepperVal: { color: colors.text, fontWeight: '700', fontSize: fs(10.5), minWidth: 30, textAlign: 'center' },

  comboTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface3,
    borderRadius: 8,
    paddingHorizontal: s(9),
    paddingVertical: vs(6),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  comboTagOn: { backgroundColor: 'rgba(253,180,78,0.14)', borderColor: 'rgba(253,180,78,0.4)' },
  comboTagText: { color: colors.textDim, fontSize: fs(9), fontWeight: '700' },
  comboTagTextOn: { color: colors.amber },

  cardioIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,90,122,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceInput: {
    backgroundColor: colors.surface3,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: s(10),
    paddingVertical: vs(7),
    fontSize: fs(10.5),
    width: 64,
  },
  intensityRow: { flexDirection: 'row', gap: 6, marginTop: vs(8), width: '100%' },
  intensityChip: {
    backgroundColor: colors.surface3,
    borderRadius: 8,
    paddingHorizontal: s(9),
    paddingVertical: vs(6),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  intensityChipOn: { backgroundColor: 'rgba(255,90,122,0.14)', borderColor: 'rgba(255,90,122,0.4)' },
  intensityChipText: { color: colors.textDim, fontSize: fs(9), fontWeight: '700' },
  intensityChipTextOn: { color: CARDIO_COLOR },

  customBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: 14,
    marginTop: vs(16),
  },
  fcBtn: {
    flex: 1,
    paddingVertical: vs(9),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
  },
  fcBtnActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  fcBtnText: { color: colors.textDim, fontSize: fs(10.5), fontWeight: '600' },
  fcBtnTextActive: { color: colors.accent },
  smallFlexInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    padding: 10,
    fontSize: fs(12),
  },
  addButton: { backgroundColor: colors.accent, borderRadius: radius.sm - 2, paddingVertical: vs(10), alignItems: 'center' },
  addButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(11) },

  videoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: vs(8),
    paddingHorizontal: s(14),
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoChipDone: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  videoChipText: { color: colors.textDim, fontSize: fs(11) },
  videoChipTextDone: { color: colors.accent, fontWeight: '600' },
  videoSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.sm - 2,
    padding: 10,
  },
  videoSelectedText: { color: colors.accent, fontSize: fs(11), fontWeight: '600', flex: 1 },
  videoRemove: { color: colors.textDim, fontSize: fs(10), textDecorationLine: 'underline' },
  videoResultsBox: { backgroundColor: colors.surface2, borderRadius: radius.sm - 2, marginTop: vs(8), marginBottom: vs(4) },
  videoResultRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  videoResultText: { color: colors.text, fontSize: fs(11) },
  uploadLink: { color: colors.accent, fontSize: fs(11), marginTop: vs(8), marginBottom: vs(4), fontWeight: '600' },

  // Revisão
  summaryCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18 },
  summaryTitle: { color: colors.text, fontSize: fs(17), fontWeight: '800' },
  summarySub: { color: colors.textDim2, fontSize: fs(10.5), marginTop: vs(2), marginBottom: vs(16) },
  metaGrid: { flexDirection: 'row', gap: 10, marginBottom: vs(16) },
  metaBox: { flex: 1, backgroundColor: colors.surface2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  metaK: { color: colors.textDim2, fontSize: fs(9), textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  metaV: { color: colors.text, fontSize: fs(11.5), fontWeight: '700', marginTop: vs(3) },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: vs(16) },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: s(10),
    paddingVertical: vs(5),
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textDim, fontSize: fs(9), fontWeight: '600', textTransform: 'capitalize' },
  legendCount: { color: colors.text, fontSize: fs(9), fontWeight: '700' },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  reviewN: { color: colors.textDim2, fontSize: fs(9), width: 16 },
  reviewName: { color: colors.text, fontSize: fs(11.5), fontWeight: '600' },
  reviewGroup: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(1), textTransform: 'capitalize' },
  reviewStat: {
    color: colors.accent,
    fontSize: fs(10),
    fontWeight: '700',
    backgroundColor: colors.accentGlow,
    paddingHorizontal: s(8),
    paddingVertical: vs(4),
    borderRadius: 8,
  },
  emptyState: { alignItems: 'center', paddingVertical: vs(30), gap: 10 },
  emptyStateText: { color: colors.textDim2, fontSize: fs(11), textAlign: 'center', lineHeight: 19 },

  // Aquecimento
  warmupBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.amberGlow,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,182,72,0.3)',
    padding: 12,
    marginBottom: vs(16),
  },
  warmupBannerText: {
    color: colors.amber,
    fontSize: fs(11),
    lineHeight: 17,
    flex: 1,
  },
  reviewWarmupSection: {
    backgroundColor: colors.amberGlow,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,182,72,0.3)',
    marginBottom: 4,
  },
  reviewWarmupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reviewWarmupLabel: {
    color: colors.amber,
    fontSize: fs(9),
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Barra inferior
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: s(18),
    paddingTop: vs(14),
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomBig: { color: colors.accent, fontWeight: '800', fontSize: fs(15) },
  bottomLbl: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(2) },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: vs(14),
    paddingHorizontal: s(22),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#04170F', fontWeight: '700', fontSize: fs(12) },

  accessoryBar: {
    backgroundColor: colors.surface,
    padding: 8,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accessoryDone: { color: colors.accent, fontWeight: '700', fontSize: fs(13), paddingHorizontal: s(12), paddingVertical: vs(4) },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxHeight: '78%',
  },
  modalTitle: { color: colors.text, fontSize: fs(14), fontWeight: '700' },
  modalSub: { color: colors.textDim2, fontSize: fs(10), marginTop: vs(4) },
  modalInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginTop: vs(12),
    marginBottom: vs(12),
    fontSize: fs(12),
  },
  modalEmpty: { color: colors.textDim, fontSize: fs(11), paddingVertical: vs(12) },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: vs(8),
  },
  modalOptionPicked: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  modalOptionName: { color: colors.text, fontSize: fs(11.5), fontWeight: '600' },
  modalOptionGroup: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(1), textTransform: 'capitalize' },
  modalVideoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: vs(12), borderBottomWidth: 1, borderBottomColor: colors.border },
  modalVideoText: { color: colors.text, fontSize: fs(12) },
  modalClose: { marginTop: vs(12), alignItems: 'center', paddingVertical: vs(10) },
  modalCloseText: { color: colors.textDim, fontSize: fs(12) },
});
