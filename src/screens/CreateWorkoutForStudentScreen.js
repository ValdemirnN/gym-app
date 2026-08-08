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
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';

const DAYS = [
  { key: 'segunda', label: 'Seg' },
  { key: 'terca', label: 'Ter' },
  { key: 'quarta', label: 'Qua' },
  { key: 'quinta', label: 'Qui' },
  { key: 'sexta', label: 'Sex' },
  { key: 'sabado', label: 'Sáb' },
  { key: 'domingo', label: 'Dom' },
];

const GOALS = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Força'];

const DONE_ACCESSORY_ID = 'doneAccessoryCreateWorkoutForStudent';

// 'YYYY-MM-DD' -> 'DD/MM/AAAA' (pra exibir); undefined/vazio -> null
function isoToDisplay(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

// 'YYYY-MM-DD' -> Date local (evita bug de fuso horário do `new Date('YYYY-MM-DD')`)
function isoToDate(iso) {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

// Date -> 'YYYY-MM-DD' (usando componentes locais, não UTC)
function dateToIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CreateWorkoutForStudentScreen({ route, navigation }) {
  const { studentId, studentName, workoutId, workoutName: initialWorkoutName, initialStep, presetDayOfWeek } = route.params;
  const isEditing = !!workoutId;
  const { session } = useAuth();
  const [name, setName] = useState(initialWorkoutName || '');
  const [dayOfWeek, setDayOfWeek] = useState(presetDayOfWeek || null);
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState(null); // 'iniciante' | 'intermediario' | 'avancado'
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [datePickerFor, setDatePickerFor] = useState(null); // null | 'start' | 'end'
  const [tempPickerDate, setTempPickerDate] = useState(new Date());
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(isEditing);
  const [search, setSearch] = useState('');
  const [step, setStep] = useState(initialStep === 1 ? 1 : 0); // 0 = Info, 1 = Exercícios, 2 = Revisão

  const [newExerciseName, setNewExerciseName] = useState('');
  const [showNewExerciseForm, setShowNewExerciseForm] = useState(false);
  const [newExerciseGroup, setNewExerciseGroup] = useState('');
  const [newExerciseType, setNewExerciseType] = useState('forca'); // 'forca' | 'cardio'
  const [newExerciseInstructions, setNewExerciseInstructions] = useState('');
  const [addingExercise, setAddingExercise] = useState(false);

  const [videos, setVideos] = useState([]);
  const [videoSearch, setVideoSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null); // { id, name } - pro exercício novo

  const [attachTarget, setAttachTarget] = useState(null); // { exerciseId, name } - pro exercício já selecionado
  const [attachSearch, setAttachSearch] = useState('');

  // Picker de vídeo INLINE pro substituto (sem abrir um 2º Modal por cima do
  // modal de substituto — dois <Modal> nativos empilhados travam no RN/iOS,
  // que era o motivo do botão "anexar vídeo" parecer não fazer nada ali).
  const [subVideoPickerOpen, setSubVideoPickerOpen] = useState(false);
  const [subVideoSearch, setSubVideoSearch] = useState('');

  // substitutos que o personal permite trocar por cada exercício (máx. 2)
  const [substitutesByExercise, setSubstitutesByExercise] = useState({}); // { [exerciseId]: [{id, name}] }
  const [subsTarget, setSubsTarget] = useState(null); // { exerciseId, name, target_sets, target_reps }
  const [subsSearch, setSubsSearch] = useState('');
  const [pendingSubCandidate, setPendingSubCandidate] = useState(null); // exercício escolhido, aguardando confirmar séries/reps
  const [comboTarget, setComboTarget] = useState(null); // exercise_id do item que está escolhendo com quem combinar

  const loadExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, muscle_group, video_id, exercise_type, instructions')
      .order('muscle_group');
    setExercises(data || []);
  };

  const loadVideos = async () => {
    const { data } = await supabase.from('exercise_videos').select('id, name').order('name');
    setVideos(data || []);
  };

  useFocusEffect(
    useCallback(() => {
      loadExercises();
      loadVideos();
    }, [])
  );

  // Corrige o card do substituto não "refletir" o vídeo recém-anexado:
  // ao voltar da tela de upload, a lista de exercícios é recarregada, mas o
  // pendingSubCandidate é uma cópia local — sem isso, o vídeo salva no banco
  // mas o botão continua mostrando "Sem vídeo".
  useEffect(() => {
    if (!pendingSubCandidate) return;
    const fresh = exercises.find((e) => e.id === pendingSubCandidate.id);
    if (fresh && fresh.video_id !== pendingSubCandidate.video_id) {
      setPendingSubCandidate((prev) => (prev ? { ...prev, video_id: fresh.video_id } : prev));
    }
  }, [exercises]);

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
        setGoal(workout.goal || '');
        setLevel(workout.level || null);
        setPeriodStart(workout.period_start || '');
        setPeriodEnd(workout.period_end || '');
      }
      const { data: items } = await supabase
        .from('workout_exercises')
        .select(
          'target_sets, target_reps, target_reps_detail, target_duration_minutes, target_distance_km, target_intensity, progression_note, drop_last, drop_note, rest_seconds, order_index, combo_group, exercises(id, name, exercise_type, instructions), workout_exercise_substitutes(substitute_exercise_id, target_sets, target_reps, target_reps_detail, drop_last, drop_note, instructions, exercises:substitute_exercise_id(id, name, video_id, instructions))'
        )
        .eq('workout_id', workoutId)
        .order('order_index');
      if (items) {
        setSelected(
          items.map((it) => ({
            exercise_id: it.exercises.id,
            name: it.exercises.name,
            exercise_type: it.exercises.exercise_type,
            instructions: it.exercises.instructions,
            combo_group: it.combo_group,
            target_sets: it.target_sets,
            target_reps: it.target_reps,
            reps_detail: it.target_reps_detail
              ? it.target_reps_detail.split(',').map((n) => parseInt(n) || 0)
              : null,
            drop_last: it.drop_last || false,
            drop_note: it.drop_note || '',
            target_duration_minutes: it.target_duration_minutes,
            target_distance_km: it.target_distance_km,
            target_intensity: it.target_intensity,
            progression_note: it.progression_note || '',
            rest_seconds: it.rest_seconds || null,
          }))
        );
        const subsMap = {};
        items.forEach((it) => {
          subsMap[it.exercises.id] = (it.workout_exercise_substitutes || [])
            .filter((s) => s.exercises)
            .map((s) => ({
              id: s.exercises.id,
              name: s.exercises.name,
              instructions: s.instructions || s.exercises.instructions,
              video_id: s.exercises.video_id,
              target_sets: s.target_sets || it.target_sets,
              target_reps: s.target_reps || it.target_reps,
              reps_detail: s.target_reps_detail
                ? s.target_reps_detail.split(',').map((n) => parseInt(n) || 0)
                : null,
              drop_last: s.drop_last || false,
              drop_note: s.drop_note || '',
            }));
        });
        setSubstitutesByExercise(subsMap);
      }
      setLoadingWorkout(false);
    };
    loadWorkout();
  }, [isEditing, workoutId]);

  const getVideoId = (exerciseId) => exercises.find((e) => e.id === exerciseId)?.video_id || null;

  const searchLower = search.trim().toLowerCase();
  const filteredExercises = exercises.filter((item) => {
    if (!searchLower) return true;
    const nameMatch = (item.name || '').toLowerCase().includes(searchLower);
    const groupMatch = (item.muscle_group || '').toLowerCase().includes(searchLower);
    return nameMatch || groupMatch;
  });

  const videoSearchLower = videoSearch.trim().toLowerCase();
  const filteredVideos = videoSearchLower
    ? videos.filter((v) => (v.name || '').toLowerCase().includes(videoSearchLower))
    : [];

  const [creatingSubExercise, setCreatingSubExercise] = useState(false);
  const handleQuickCreateSubExercise = async () => {
    const name = subsSearch.trim();
    if (!name) return;
    setCreatingSubExercise(true);
    const { data, error } = await supabase
      .from('exercises')
      .insert({ name, owner_id: session.user.id })
      .select()
      .single();
    setCreatingSubExercise(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setExercises((prev) => [...prev, data]);
    setPendingSubCandidate({
      ...data,
      target_sets: subsTarget?.target_sets || 3,
      target_reps: subsTarget?.target_reps || 12,
    });
    setSubsSearch('');
  };

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
        video_id: selectedVideo?.id || null,
        owner_id: session.user.id,
        exercise_type: newExerciseType,
        instructions: newExerciseInstructions.trim() || null,
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
    setNewExerciseInstructions('');
    setVideoSearch('');
    setSelectedVideo(null);
  };

  const toggleExercise = (exercise) => {
    setSelected((prev) => {
      const exists = prev.find((e) => e.exercise_id === exercise.id);
      if (exists) return prev.filter((e) => e.exercise_id !== exercise.id);
      if (exercise.exercise_type === 'cardio') {
        return [
          ...prev,
          {
            exercise_id: exercise.id,
            name: exercise.name,
            exercise_type: 'cardio',
            combo_group: null,
            target_duration_minutes: 20,
            target_distance_km: null,
            target_intensity: 'moderada',
          },
        ];
      }
      return [
        ...prev,
        {
          exercise_id: exercise.id,
          name: exercise.name,
          exercise_type: 'forca',
          combo_group: null,
          target_sets: 3,
          target_reps: 12,
          progression_note: '',
          rest_seconds: 60,
        },
      ];
    });
  };

  const updateTarget = (exerciseId, field, value) => {
    const isNumericField = field === 'target_sets' || field === 'target_reps';
    const isDecimalField = field === 'target_duration_minutes' || field === 'target_distance_km';
    setSelected((prev) =>
      prev.map((e) => {
        if (e.exercise_id !== exerciseId) return e;
        if (isNumericField) return { ...e, [field]: parseInt(value) || 0 };
        if (isDecimalField) return { ...e, [field]: value === '' ? null : parseFloat(value.replace(',', '.')) || 0 };
        return { ...e, [field]: value };
      })
    );
  };

  // Stepper compacto (igual ao HTML): "−" tira série, "+" soma repetição (valor único p/ todas as séries)
  const stepSets = (exerciseId, delta) => {
    setSelected((prev) =>
      prev.map((e) => {
        if (e.exercise_id !== exerciseId) return e;
        const newSets = Math.max(1, (e.target_sets || 1) + delta);
        const reps_detail = e.reps_detail ? resizeRepsDetail(e.reps_detail, newSets, e.target_reps) : null;
        return { ...e, target_sets: newSets, reps_detail };
      })
    );
  };

  const stepReps = (exerciseId, delta) => {
    setSelected((prev) =>
      prev.map((e) => {
        if (e.exercise_id !== exerciseId) return e;
        return { ...e, target_reps: Math.max(1, (e.target_reps || 0) + delta) };
      })
    );
  };

  function resizeRepsDetail(arr, newLength, fallbackValue) {
    const next = arr.slice(0, newLength);
    while (next.length < newLength) next.push(next[next.length - 1] ?? fallbackValue ?? 12);
    return next;
  }

  // Ativa/desativa a personalização de reps por série
  const toggleCustomReps = (exerciseId) => {
    setSelected((prev) =>
      prev.map((e) => {
        if (e.exercise_id !== exerciseId) return e;
        if (e.reps_detail) return { ...e, reps_detail: null }; // volta ao valor uniforme
        return { ...e, reps_detail: Array(e.target_sets || 1).fill(e.target_reps || 12) };
      })
    );
  };

  const setRepAtIndex = (exerciseId, index, delta) => {
    setSelected((prev) =>
      prev.map((e) => {
        if (e.exercise_id !== exerciseId || !e.reps_detail) return e;
        const next = [...e.reps_detail];
        next[index] = Math.max(1, (next[index] || 0) + delta);
        return { ...e, reps_detail: next };
      })
    );
  };

  // Marca/desmarca a última série como "drop set". Não mexe no número de reps —
  // o personal explica como funciona o drop no campo de texto (drop_note).
  const toggleDropLast = (exerciseId) => {
    setSelected((prev) =>
      prev.map((e) => (e.exercise_id === exerciseId ? { ...e, drop_last: !e.drop_last } : e))
    );
  };

  const stepPendingSubSets = (delta) => {
    setPendingSubCandidate((prev) => {
      if (!prev) return prev;
      const newSets = Math.max(1, (prev.target_sets || 1) + delta);
      const reps_detail = prev.reps_detail ? resizeRepsDetail(prev.reps_detail, newSets, prev.target_reps) : null;
      return { ...prev, target_sets: newSets, reps_detail };
    });
  };
  const stepPendingSubReps = (delta) => {
    setPendingSubCandidate((prev) => (prev ? { ...prev, target_reps: Math.max(1, (prev.target_reps || 0) + delta) } : prev));
  };

  // Personalizar reps por série no substituto (mesma lógica do exercício principal)
  const toggleSubCustomReps = () => {
    setPendingSubCandidate((prev) => {
      if (!prev) return prev;
      if (prev.reps_detail) return { ...prev, reps_detail: null, drop_last: false };
      return { ...prev, reps_detail: Array(prev.target_sets || 1).fill(prev.target_reps || 12) };
    });
  };

  const setSubRepAtIndex = (index, delta) => {
    setPendingSubCandidate((prev) => {
      if (!prev || !prev.reps_detail) return prev;
      const next = [...prev.reps_detail];
      next[index] = Math.max(1, (next[index] || 0) + delta);
      return { ...prev, reps_detail: next };
    });
  };

  const toggleSubDropLast = () => {
    setPendingSubCandidate((prev) => (prev ? { ...prev, drop_last: !prev.drop_last } : prev));
  };

  const confirmPendingSubCandidate = () => {
    if (!pendingSubCandidate || !subsTarget) return;
    setSubstitutesByExercise((prev) => ({
      ...prev,
      [subsTarget.exerciseId]: [
        ...(prev[subsTarget.exerciseId] || []),
        {
          id: pendingSubCandidate.id,
          name: pendingSubCandidate.name,
          instructions: pendingSubCandidate.instructions,
          video_id: pendingSubCandidate.video_id,
          target_sets: pendingSubCandidate.target_sets,
          target_reps: pendingSubCandidate.target_reps,
          reps_detail: pendingSubCandidate.reps_detail || null,
          drop_last: pendingSubCandidate.drop_last || false,
          drop_note: pendingSubCandidate.drop_note || '',
        },
      ],
    }));
    setPendingSubCandidate(null);
    setSubVideoPickerOpen(false);
    setSubVideoSearch('');
  };

  const unlinkCombo = (exerciseId) => {
    setSelected((prev) => prev.map((e) => (e.exercise_id === exerciseId ? { ...e, combo_group: null } : e)));
  };

  const linkCombo = (candidateId) => {
    setSelected((prev) => {
      const current = prev.find((e) => e.exercise_id === comboTarget);
      const candidate = prev.find((e) => e.exercise_id === candidateId);
      if (!current || !candidate) return prev;
      const usedLetters = new Set(prev.map((e) => e.combo_group).filter(Boolean));
      const letterPool = ['A', 'B', 'C', 'D', 'E', 'F'];
      const group = candidate.combo_group || current.combo_group || letterPool.find((l) => !usedLetters.has(l)) || 'A';
      return prev.map((e) =>
        e.exercise_id === comboTarget || e.exercise_id === candidateId ? { ...e, combo_group: group } : e
      );
    });
    setComboTarget(null);
  };

  // Grava o vídeo escolhido num exercício (usado tanto pelo picker de topo
  // quanto pelo inline do substituto — sem depender de qual modal está aberto)
  const attachVideoToExercise = async (exerciseId, video) => {
    const { error } = await supabase.from('exercises').update({ video_id: video.id }).eq('id', exerciseId);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setExercises((prev) => prev.map((e) => (e.id === exerciseId ? { ...e, video_id: video.id } : e)));
    setPendingSubCandidate((prev) => (prev && prev.id === exerciseId ? { ...prev, video_id: video.id } : prev));
  };

  const attachVideoToSelected = async (video) => {
    if (!attachTarget) return;
    await attachVideoToExercise(attachTarget.exerciseId, video);
    setAttachTarget(null);
    setAttachSearch('');
  };

  const selectSubVideo = async (video) => {
    if (!pendingSubCandidate) return;
    await attachVideoToExercise(pendingSubCandidate.id, video);
    setSubVideoPickerOpen(false);
    setSubVideoSearch('');
  };

  const subVideoSearchLower = subVideoSearch.trim().toLowerCase();
  const filteredSubVideos = subVideoSearchLower
    ? videos.filter((v) => (v.name || '').toLowerCase().includes(subVideoSearchLower))
    : videos;

  const attachSearchLower = attachSearch.trim().toLowerCase();
  const filteredAttachVideos = attachSearchLower
    ? videos.filter((v) => (v.name || '').toLowerCase().includes(attachSearchLower))
    : videos;

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Atenção', 'Dê um nome ao treino (ex: Treino A).');
      return;
    }
    if (selected.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um exercício.');
      return;
    }
    setSaving(true);

    const workoutFields = {
      name,
      day_of_week: dayOfWeek,
      goal: goal.trim() || null,
      level,
      period_start: periodStart.trim() || null,
      period_end: periodEnd.trim() || null,
    };

    let workout;
    if (isEditing) {
      const { data, error } = await supabase
        .from('workouts')
        .update(workoutFields)
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
        .insert({ user_id: studentId, created_by: session.user.id, ...workoutFields })
        .select()
        .single();
      if (error) {
        setSaving(false);
        Alert.alert('Erro', error.message);
        return;
      }
      workout = data;
    }

    const rows = selected.map((e, index) => ({
      workout_id: workout.id,
      exercise_id: e.exercise_id,
      order_index: index,
      combo_group: e.combo_group || null,
      target_sets: e.exercise_type === 'cardio' ? null : e.target_sets,
      target_reps: e.exercise_type === 'cardio' ? null : e.target_reps,
      target_reps_detail: e.exercise_type === 'cardio' || !e.reps_detail ? null : e.reps_detail.join(','),
      target_duration_minutes: e.exercise_type === 'cardio' ? e.target_duration_minutes : null,
      target_distance_km: e.exercise_type === 'cardio' ? e.target_distance_km : null,
      target_intensity: e.exercise_type === 'cardio' ? e.target_intensity : null,
      progression_note: e.exercise_type === 'cardio' ? null : (e.progression_note || '').trim() || null,
      drop_last: e.exercise_type === 'cardio' ? false : !!e.drop_last,
      drop_note: e.exercise_type === 'cardio' ? null : (e.drop_note || '').trim() || null,
      rest_seconds: e.exercise_type === 'cardio' ? null : (e.rest_seconds || null),
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from('workout_exercises')
      .insert(rows)
      .select('id, exercise_id');

    if (insertError) {
      setSaving(false);
      Alert.alert('Erro', insertError.message);
      return;
    }

    const subRows = [];
    (insertedRows || []).forEach((row) => {
      const subs = substitutesByExercise[row.exercise_id] || [];
      subs.forEach((s) => {
        subRows.push({
          workout_exercise_id: row.id,
          substitute_exercise_id: s.id,
          target_sets: s.target_sets || null,
          target_reps: s.target_reps || null,
          target_reps_detail: s.reps_detail ? s.reps_detail.join(',') : null,
          drop_last: s.drop_last || false,
          drop_note: (s.drop_note || '').trim() || null,
          instructions: (s.instructions || '').trim() || null,
        });
      });
    });

    if (subRows.length > 0) {
      const { error: subsError } = await supabase.from('workout_exercise_substitutes').insert(subRows);
      if (subsError) {
        setSaving(false);
        Alert.alert('Erro', subsError.message);
        return;
      }
    }

    setSaving(false);
    navigation.goBack();
  };

  const isSelected = (id) => selected.some((e) => e.exercise_id === id);

  if (loadingWorkout) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textDim }}>Carregando treino...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity
        style={styles.backRow}
        onPress={() => (step > 0 ? setStep(step - 1) : navigation.goBack())}
      >
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{step > 0 ? 'Etapa anterior' : 'Voltar'}</Text>
      </TouchableOpacity>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>{isEditing ? 'Editar Treino' : 'Novo Treino'}</Text>
        <Text style={styles.subtitle}>para {studentName}</Text>

        <View style={styles.stepTabsRow}>
          {['Info', 'Exercícios', 'Revisão'].map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.stepTab, step === i && styles.stepTabActive]}
              onPress={() => setStep(i)}
              activeOpacity={0.85}
            >
              <View style={[styles.stepNum, step === i && styles.stepNumActive]}>
                <Text style={[styles.stepNumText, step === i && styles.stepNumTextActive]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepTabText, step === i && styles.stepTabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {step === 0 && (
        <View style={styles.blockCard}>
          <View style={styles.blockCardHeader}>
            <View style={styles.blockCardIcon}>
              <Feather name="layers" size={16} color="#fff" />
            </View>
            <Text style={styles.blockCardTitle}>Informações do treino</Text>
          </View>

          <TextInput
          style={styles.input}
          placeholder="Nome do treino (ex: Treino A - Peito)"
          placeholderTextColor={colors.textDim2}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.sectionLabel}>Dia da semana (opcional):</Text>
        <View style={styles.dayRow}>
          {DAYS.map((d) => (
            <TouchableOpacity
              key={d.key}
              style={[styles.dayChip, dayOfWeek === d.key && styles.dayChipSelected]}
              onPress={() => setDayOfWeek(dayOfWeek === d.key ? null : d.key)}
            >
              <Text style={[styles.dayChipText, dayOfWeek === d.key && styles.dayChipTextSelected]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Objetivo (opcional):</Text>
        <View style={styles.dayRow}>
          {GOALS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.dayChip, goal === g && styles.dayChipSelected]}
              onPress={() => setGoal(goal === g ? '' : g)}
            >
              <Text style={[styles.dayChipText, goal === g && styles.dayChipTextSelected]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Nível (opcional):</Text>
        <View style={styles.dayRow}>
          {[
            { key: 'iniciante', label: 'Iniciante', dots: '•' },
            { key: 'intermediario', label: 'Intermediário', dots: '••' },
            { key: 'avancado', label: 'Avançado', dots: '•••' },
          ].map((l) => (
            <TouchableOpacity
              key={l.key}
              style={[styles.dayChip, level === l.key && styles.dayChipSelected]}
              onPress={() => setLevel(level === l.key ? null : l.key)}
            >
              <Text style={[styles.dayChipText, level === l.key && styles.dayChipTextSelected]}>
                {l.dots} {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Período do bloco (opcional):</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.dateInput, { flex: 1 }]}
            onPress={() => {
              setTempPickerDate(isoToDate(periodStart));
              setDatePickerFor('start');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.dateInputLabel}>Início</Text>
            <View style={styles.dateInputRow}>
              <Text style={[styles.dateInputValue, !periodStart && styles.dateInputPlaceholder]}>
                {isoToDisplay(periodStart) || 'dd/mm/aaaa'}
              </Text>
              <Feather name="calendar" size={15} color={colors.textDim2} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateInput, { flex: 1 }]}
            onPress={() => {
              setTempPickerDate(isoToDate(periodEnd));
              setDatePickerFor('end');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.dateInputLabel}>Fim</Text>
            <View style={styles.dateInputRow}>
              <Text style={[styles.dateInputValue, !periodEnd && styles.dateInputPlaceholder]}>
                {isoToDisplay(periodEnd) || 'dd/mm/aaaa'}
              </Text>
              <Feather name="calendar" size={15} color={colors.textDim2} />
            </View>
          </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Calendário único, reaproveitado tanto pra "Início" quanto "Fim" */}
        <Modal visible={!!datePickerFor} transparent animationType="fade" onRequestClose={() => setDatePickerFor(null)}>
          <TouchableOpacity
            style={styles.datePickerOverlay}
            activeOpacity={1}
            onPress={() => setDatePickerFor(null)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.datePickerCard}>
              <Text style={styles.datePickerCardTitle}>
                {datePickerFor === 'start' ? 'Data de início' : 'Data de fim'}
              </Text>
              {datePickerFor && (
                <DateTimePicker
                  value={tempPickerDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant="dark"
                  locale="pt-BR"
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      // No Android o picker já fecha sozinho (é um diálogo nativo)
                      if (event.type === 'dismissed') {
                        setDatePickerFor(null);
                        return;
                      }
                      if (selectedDate) {
                        if (datePickerFor === 'start') setPeriodStart(dateToIso(selectedDate));
                        else setPeriodEnd(dateToIso(selectedDate));
                      }
                      setDatePickerFor(null);
                      return;
                    }
                    // No iOS o picker "inline" só dispara onChange quando a data
                    // MUDA — se você toca no dia que já está selecionado, nada
                    // acontece e parecia travado. Por isso só guardamos o valor
                    // aqui, e a confirmação é feita no botão abaixo.
                    if (selectedDate) setTempPickerDate(selectedDate);
                  }}
                />
              )}
              {Platform.OS === 'ios' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[styles.addButton, { flex: 1, backgroundColor: colors.surface2 }]}
                    onPress={() => setDatePickerFor(null)}
                  >
                    <Text style={[styles.addButtonText, { color: colors.textDim }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addButton, { flex: 1 }]}
                    onPress={() => {
                      if (datePickerFor === 'start') setPeriodStart(dateToIso(tempPickerDate));
                      else setPeriodEnd(dateToIso(tempPickerDate));
                      setDatePickerFor(null);
                    }}
                  >
                    <Text style={styles.addButtonText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {step === 1 && (
        <>
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

        <View style={styles.blockCardHeader}>
          <View style={[styles.blockCardIcon, { backgroundColor: colors.blue }]}>
            <Feather name="search" size={16} color="#fff" />
          </View>
          <Text style={styles.blockCardTitle}>Selecione os exercícios</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Buscar por nome ou grupo (ex: Peito)"
          placeholderTextColor={colors.textDim2}
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.customBox}>
          <TouchableOpacity
            style={styles.customBoxToggle}
            onPress={() => setShowNewExerciseForm((v) => !v)}
          >
            <Feather name={showNewExerciseForm ? 'chevron-up' : 'plus-circle'} size={15} color={colors.accent} />
            <Text style={styles.customBoxToggleText}>
              {showNewExerciseForm ? 'Cancelar novo exercício' : 'Não achou? Adicione um exercício novo'}
            </Text>
          </TouchableOpacity>

          {showNewExerciseForm && (
            <>
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <TextInput
              style={[styles.smallFlexInput, { marginRight: 8 }]}
              placeholder="Nome do exercício"
              placeholderTextColor={colors.textDim2}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
            />
            <TextInput
              style={styles.smallFlexInput}
              placeholder="Grupo (opcional)"
              placeholderTextColor={colors.textDim2}
              value={newExerciseGroup}
              onChangeText={setNewExerciseGroup}
            />
          </View>

          <View style={styles.typeToggleRow}>
            <TouchableOpacity
              style={[styles.typeToggle, newExerciseType === 'forca' && styles.typeToggleActive]}
              onPress={() => setNewExerciseType('forca')}
            >
              <Feather name="zap" size={13} color={newExerciseType === 'forca' ? '#04170F' : colors.textDim} />
              <Text style={[styles.typeToggleText, newExerciseType === 'forca' && styles.typeToggleTextActive]}> Força</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeToggle, newExerciseType === 'cardio' && styles.typeToggleActive]}
              onPress={() => setNewExerciseType('cardio')}
            >
              <Feather name="heart" size={13} color={newExerciseType === 'cardio' ? '#04170F' : colors.textDim} />
              <Text style={[styles.typeToggleText, newExerciseType === 'cardio' && styles.typeToggleTextActive]}> Cardio</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Instruções de execução (opcional):</Text>
          <TextInput
            style={[styles.input, { height: 60 }]}
            placeholder="Ex: Mantenha a coluna neutra, desça controlado..."
            placeholderTextColor={colors.textDim2}
            value={newExerciseInstructions}
            onChangeText={setNewExerciseInstructions}
            multiline
          />

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
            onPress={async () => {
              await handleAddCustomExercise();
              setShowNewExerciseForm(false);
            }}
            disabled={addingExercise}
          >
            <Text style={styles.addButtonText}>{addingExercise ? '...' : 'Adicionar exercício'}</Text>
          </TouchableOpacity>
            </>
          )}
        </View>

        {filteredExercises.map((item) => {
          const selectedItem = selected.find((e) => e.exercise_id === item.id);
          const subs = substitutesByExercise[item.id] || [];
          return (
            <View
              key={item.id}
              style={[
                styles.exerciseRow,
                isSelected(item.id) && styles.exerciseRowActive,
                item.exercise_type === 'cardio' && { borderLeftWidth: 3, borderLeftColor: colors.amber },
              ]}
            >
              <View style={styles.exerciseTopRow}>
                <TouchableOpacity style={styles.exerciseInfo} onPress={() => toggleExercise(item)}>
                  <View style={[styles.checkbox, isSelected(item.id) && styles.checkboxChecked]}>
                    {isSelected(item.id) && <Feather name="check" size={13} color="#04170F" />}
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      {item.exercise_type === 'cardio' && (
                        <View style={styles.cardioBadge}>
                          <Feather name="heart" size={10} color={colors.amber} />
                          <Text style={styles.cardioBadgeText}> Cardio</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.exerciseGroup}>{item.muscle_group}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rowVideoBtn}
                  onPress={() => setAttachTarget({ exerciseId: item.id, name: item.name })}
                >
                  <Feather name={item.video_id ? 'check-circle' : 'video'} size={15} color={item.video_id ? colors.accent : colors.textDim} />
                </TouchableOpacity>

                {selectedItem && selectedItem.exercise_type === 'cardio' && (
                  <View style={styles.cardioInputs}>
                    <TextInput
                      style={styles.cardioInput}
                      keyboardType="number-pad"
                      placeholder="min"
                      placeholderTextColor={colors.textDim2}
                      value={selectedItem.target_duration_minutes ? String(selectedItem.target_duration_minutes) : ''}
                      onChangeText={(v) => updateTarget(item.id, 'target_duration_minutes', v)}
                    />
                    <TextInput
                      style={styles.cardioInput}
                      keyboardType="decimal-pad"
                      placeholder="km"
                      placeholderTextColor={colors.textDim2}
                      value={selectedItem.target_distance_km ? String(selectedItem.target_distance_km) : ''}
                      onChangeText={(v) => updateTarget(item.id, 'target_distance_km', v)}
                    />
                  </View>
                )}
              </View>

              {/* Quadro de séries × reps + atalho pra personalizar por série */}
              {selectedItem && selectedItem.exercise_type !== 'cardio' && (
                <View style={styles.quickRow}>
                  <View style={styles.quickField}>
                    <Text style={styles.quickFieldLabel}>Séries</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepSets(item.id, -1)}>
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{selectedItem.target_sets}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepSets(item.id, 1)}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.stepperX}>×</Text>
                  <View style={styles.quickField}>
                    <Text style={styles.quickFieldLabel}>Reps</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepReps(item.id, -1)}>
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{selectedItem.target_reps}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepReps(item.id, 1)}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.customRepsToggle}
                    onPress={() => toggleCustomReps(item.id)}
                  >
                    <Feather name={selectedItem.reps_detail ? 'x' : 'sliders'} size={11} color={colors.accent} />
                    <Text style={styles.customRepsToggleText}>
                      {selectedItem.reps_detail ? 'Usar repetição única' : 'Personalizar por série'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedItem && selectedItem.reps_detail && (
                <View style={styles.repsDetailBox}>
                  {selectedItem.reps_detail.map((reps, idx) => {
                    const arr = selectedItem.reps_detail;
                    const isLast = idx === arr.length - 1;
                    const isDrop = isLast && selectedItem.drop_last;
                    const maxReps = Math.max(...arr, 1);
                    const barHeight = Math.max(6, Math.round((reps / maxReps) * 26));
                    return (
                      <View key={idx} style={[styles.repsDetailRow, isDrop && styles.repsDetailRowDrop]}>
                        <View style={styles.repsBarWrap}>
                          <View style={[styles.repsBar, { height: barHeight }, isDrop && styles.repsBarDrop]} />
                        </View>
                        <Text style={[styles.repsDetailLabel, isDrop && styles.repsDetailLabelDrop]}>
                          {isDrop ? 'Drop set' : `${idx + 1}ª série`}
                        </Text>
                        {isLast && arr.length > 1 && (
                          <TouchableOpacity
                            style={[styles.dropChip, isDrop && { marginLeft: 'auto' }]}
                            onPress={() => toggleDropLast(item.id)}
                          >
                            <Feather name="zap" size={10} color={isDrop ? colors.amber : colors.textFaint} />
                            <Text style={[styles.dropChipText, isDrop && styles.dropChipTextActive]}>Drop</Text>
                          </TouchableOpacity>
                        )}
                        {!isDrop && (
                          <View style={styles.repsDetailStepper}>
                            <TouchableOpacity style={styles.stepperBtnSm} onPress={() => setRepAtIndex(item.id, idx, -1)}>
                              <Text style={styles.stepperBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.repsDetailVal}>{reps} reps</Text>
                            <TouchableOpacity style={styles.stepperBtnSm} onPress={() => setRepAtIndex(item.id, idx, 1)}>
                              <Text style={styles.stepperBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {selectedItem.drop_last && (
                    <View style={styles.dropNoteBox}>
                      <View style={styles.fieldLabelRow}>
                        <Feather name="zap" size={11} color={colors.amber} />
                        <Text style={[styles.fieldLabel, { color: colors.amber }]}>Como funciona o drop</Text>
                      </View>
                      <TextInput
                        style={styles.dropNoteInput}
                        placeholder="Ex: 1 drop com 12 repetições, depois 10, depois 8"
                        placeholderTextColor={colors.textDim2}
                        value={selectedItem.drop_note || ''}
                        onChangeText={(v) => updateTarget(item.id, 'drop_note', v)}
                        inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                        multiline
                        numberOfLines={2}
                        textAlignVertical="top"
                      />
                    </View>
                  )}
                </View>
              )}

              {selectedItem && selectedItem.exercise_type === 'cardio' && (
                <View style={styles.intensityRow}>
                  {['leve', 'moderada', 'intensa'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.intensityChip, selectedItem.target_intensity === level && styles.intensityChipActive]}
                      onPress={() => updateTarget(item.id, 'target_intensity', level)}
                    >
                      <Text
                        style={[
                          styles.intensityChipText,
                          selectedItem.target_intensity === level && styles.intensityChipTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedItem && selectedItem.exercise_type !== 'cardio' && (
                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}>
                    <Feather name="edit-3" size={12} color={colors.textFaint} />
                    <Text style={styles.fieldLabel}>Observação de progressão</Text>
                  </View>
                  <TextInput
                    style={styles.progressionInput}
                    placeholder="Ex: aumenta a carga na última série e faz drop set fazendo o máximo de repetições possíveis"
                    placeholderTextColor={colors.textDim2}
                    value={selectedItem.progression_note || ''}
                    onChangeText={(v) => updateTarget(item.id, 'progression_note', v)}
                    inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {selectedItem && selectedItem.exercise_type !== 'cardio' && (
                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}>
                    <Feather name="clock" size={12} color={colors.textFaint} />
                    <Text style={styles.fieldLabel}>Descanso entre séries</Text>
                  </View>
                  <View style={styles.restStepper}>
                    {[30, 45, 60, 90, 120].map((sec) => (
                      <TouchableOpacity
                        key={sec}
                        style={[
                          styles.restChip,
                          (selectedItem.rest_seconds || 60) === sec && styles.restChipActive,
                        ]}
                        onPress={() => updateTarget(item.id, 'rest_seconds', sec)}
                      >
                        <Text
                          style={[
                            styles.restChipText,
                            (selectedItem.rest_seconds || 60) === sec && styles.restChipTextActive,
                          ]}
                        >
                          {sec >= 60 ? `${sec / 60}min` : `${sec}s`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[
                        styles.restChip,
                        ![30, 45, 60, 90, 120].includes(selectedItem.rest_seconds || 60) && styles.restChipActive,
                      ]}
                      onPress={() => {
                        Alert.prompt
                          ? Alert.prompt(
                              'Descanso personalizado',
                              'Informe o tempo em segundos:',
                              (v) => {
                                const n = parseInt(v);
                                if (n > 0) updateTarget(item.id, 'rest_seconds', n);
                              },
                              'plain-text',
                              String(selectedItem.rest_seconds || 60),
                              'numeric'
                            )
                          : Alert.alert('Descanso personalizado', 'Edite o campo manualmente abaixo.');
                      }}
                    >
                      <Text
                        style={[
                          styles.restChipText,
                          ![30, 45, 60, 90, 120].includes(selectedItem.rest_seconds || 60) && styles.restChipTextActive,
                        ]}
                      >
                        outro
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {![30, 45, 60, 90, 120].includes(selectedItem.rest_seconds || 60) && (
                    <TextInput
                      style={[styles.dropNoteInput, { marginTop: 6 }]}
                      placeholder="Segundos de descanso (ex: 75)"
                      placeholderTextColor={colors.textDim2}
                      keyboardType="numeric"
                      value={selectedItem.rest_seconds ? String(selectedItem.rest_seconds) : ''}
                      onChangeText={(v) => updateTarget(item.id, 'rest_seconds', parseInt(v) || null)}
                      inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                    />
                  )}
                </View>
              )}

              {selectedItem && (
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => {
                      setSubsSearch('');
                      setPendingSubCandidate(null);
                      setSubsTarget({
                        exerciseId: item.id,
                        name: item.name,
                        target_sets: selectedItem.target_sets,
                        target_reps: selectedItem.target_reps,
                      });
                    }}
                  >
                    <Feather name="repeat" size={12} color={subs.length > 0 ? colors.accent : colors.textDim} />
                    <Text style={[styles.chipText, subs.length > 0 && styles.chipTextActive]}>
                      {subs.length > 0
                        ? 'Substituto' + (subs.length > 1 ? 's' : '') + ': ' + subs.map((s) => s.name).join(', ')
                        : 'Cadastrar substituto (opcional)'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.chip, selectedItem.combo_group && styles.chipComboActive]}
                    onPress={() => (selectedItem.combo_group ? unlinkCombo(item.id) : setComboTarget(item.id))}
                  >
                    <Feather name="link" size={12} color={selectedItem.combo_group ? colors.amber : colors.textDim2} />
                    <Text style={[styles.chipText, selectedItem.combo_group && styles.chipTextCombo]}>
                      {selectedItem.combo_group
                        ? `Combinado com: ${selected
                            .filter((e) => e.combo_group === selectedItem.combo_group && e.exercise_id !== item.id)
                            .map((e) => e.name)
                            .join(', ')} · toca pra desfazer`
                        : 'Marcar como combinado (opcional)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        </>
        )}

        {step === 2 && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>{name || 'Treino sem nome'}</Text>
            <Text style={styles.reviewSub}>
              {[goal, level ? level[0].toUpperCase() + level.slice(1) : null].filter(Boolean).join(' · ') || 'Sem objetivo/nível definido'}
            </Text>

            <View style={styles.reviewMetaGrid}>
              <View style={styles.reviewMetaBox}>
                <Text style={styles.reviewMetaKey}>Dia da semana</Text>
                <Text style={styles.reviewMetaVal}>
                  {dayOfWeek ? DAYS.find((d) => d.key === dayOfWeek)?.label : 'Não definido'}
                </Text>
              </View>
              <View style={styles.reviewMetaBox}>
                <Text style={styles.reviewMetaKey}>Período</Text>
                <Text style={styles.reviewMetaVal}>
                  {periodStart || periodEnd ? `${periodStart || '—'} a ${periodEnd || '—'}` : 'Não definido'}
                </Text>
              </View>
            </View>

            <Text style={styles.reviewListLabel}>
              {selected.length} exercício{selected.length !== 1 ? 's' : ''} selecionado{selected.length !== 1 ? 's' : ''}
            </Text>

            {selected.length === 0 ? (
              <View style={styles.reviewEmpty}>
                <Feather name="alert-circle" size={22} color={colors.textDim2} />
                <Text style={styles.reviewEmptyText}>
                  Nenhum exercício selecionado ainda. Volte para a etapa "Exercícios" e escolha alguns.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {selected.map((s, i) => (
                  <View key={s.exercise_id} style={styles.reviewItem}>
                    <Text style={styles.reviewItemNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewItemName}>
                        {s.name} {s.combo_group ? `🔗 ${s.combo_group}` : ''}
                      </Text>
                      <Text style={styles.reviewItemGroup}>
                        {exercises.find((e) => e.id === s.exercise_id)?.muscle_group || (s.exercise_type === 'cardio' ? 'Cardio' : '')}
                      </Text>
                    </View>
                    <Text style={styles.reviewItemSx}>
                      {s.exercise_type === 'cardio'
                        ? `${s.target_duration_minutes || 0} min`
                        : s.reps_detail
                        ? s.reps_detail.join('-')
                        : `${s.target_sets}×${s.target_reps}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.wizardBar}>
        <View style={styles.wizardStat}>
          <Text style={styles.wizardStatBig}>{selected.length}</Text>
          <Text style={styles.wizardStatLbl}>exercício{selected.length !== 1 ? 's' : ''}</Text>
        </View>
        {step < 2 ? (
          <TouchableOpacity style={styles.wizardNextBtn} onPress={() => setStep(step + 1)} activeOpacity={0.85}>
            <Text style={styles.wizardNextBtnText}>Avançar</Text>
            <Feather name="chevron-right" size={16} color="#08110A" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.wizardNextBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.wizardNextBtnText}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar treino'}
            </Text>
          </TouchableOpacity>
        )}
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

      <Modal visible={!!attachTarget} transparent animationType="slide" onRequestClose={() => setAttachTarget(null)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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

      <Modal
        visible={!!subsTarget}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSubsTarget(null);
          setPendingSubCandidate(null);
          setSubVideoPickerOpen(false);
          setSubVideoSearch('');
        }}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Substitutos permitidos para "{subsTarget?.name}"</Text>

            {!pendingSubCandidate && (
              <Text style={styles.modalHint}>
                O aluno só vai poder trocar esse exercício por um dos que você escolher aqui. Não precisa ser 2 —
                pode cadastrar só 1, ou deixar sem nenhum.
              </Text>
            )}

            {!pendingSubCandidate && (substitutesByExercise[subsTarget?.exerciseId] || []).length > 0 && (
              <View style={{ marginBottom: 10 }}>
                {(substitutesByExercise[subsTarget?.exerciseId] || []).map((s) => (
                  <View key={s.id} style={styles.chosenRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chosenText}>✓ {s.name}</Text>
                      <Text style={styles.chosenSub}>
                        {s.reps_detail ? s.reps_detail.join('-') + ' reps' : `${s.target_sets}×${s.target_reps}`}
                        {s.drop_last ? ' · drop na última' : ''}
                        {' '}{s.video_id ? '· com vídeo' : '· sem vídeo'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setSubstitutesByExercise((prev) => ({
                          ...prev,
                          [subsTarget.exerciseId]: (prev[subsTarget.exerciseId] || []).filter((x) => x.id !== s.id),
                        }))
                      }
                    >
                      <Text style={styles.chosenRemove}>remover</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Passo 2: configurar séries/reps/vídeo do substituto escolhido, antes de confirmar.
                Isso precisa ser rolável (ScrollView) — como o modalBox tem altura máxima fixa,
                sem rolagem o teclado cobria os campos de texto e os botões ficavam inalcançáveis,
                dando a impressão de estar travado. */}
            {pendingSubCandidate ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.pendingSubName}>{pendingSubCandidate.name}</Text>
                {pendingSubCandidate.muscle_group ? (
                  <Text style={styles.pendingSubGroup}>{pendingSubCandidate.muscle_group}</Text>
                ) : null}

                <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Séries x repetições</Text>
                <View style={styles.quickRow}>
                  <View style={styles.quickField}>
                    <Text style={styles.quickFieldLabel}>Séries</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepPendingSubSets(-1)}>
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{pendingSubCandidate.target_sets}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepPendingSubSets(1)}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.stepperX}>×</Text>
                  <View style={styles.quickField}>
                    <Text style={styles.quickFieldLabel}>Reps</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepPendingSubReps(-1)}>
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperVal}>{pendingSubCandidate.target_reps}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => stepPendingSubReps(1)}>
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.customRepsToggle} onPress={toggleSubCustomReps}>
                    <Feather name={pendingSubCandidate.reps_detail ? 'x' : 'sliders'} size={11} color={colors.accent} />
                    <Text style={styles.customRepsToggleText}>
                      {pendingSubCandidate.reps_detail ? 'Usar repetição única' : 'Personalizar por série'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {pendingSubCandidate.reps_detail && (
                  <View style={styles.repsDetailBox}>
                    {pendingSubCandidate.reps_detail.map((reps, idx) => {
                      const arr = pendingSubCandidate.reps_detail;
                      const isLast = idx === arr.length - 1;
                      const isDrop = isLast && pendingSubCandidate.drop_last;
                      const maxReps = Math.max(...arr, 1);
                      const barHeight = Math.max(6, Math.round((reps / maxReps) * 26));
                      return (
                        <View key={idx} style={[styles.repsDetailRow, isDrop && styles.repsDetailRowDrop]}>
                          <View style={styles.repsBarWrap}>
                            <View style={[styles.repsBar, { height: barHeight }, isDrop && styles.repsBarDrop]} />
                          </View>
                          <Text style={[styles.repsDetailLabel, isDrop && styles.repsDetailLabelDrop]}>
                            {isDrop ? 'Drop set' : `${idx + 1}ª série`}
                          </Text>
                          {isLast && arr.length > 1 && (
                            <TouchableOpacity
                              style={[styles.dropChip, isDrop && { marginLeft: 'auto' }]}
                              onPress={toggleSubDropLast}
                            >
                              <Feather name="zap" size={10} color={isDrop ? colors.amber : colors.textFaint} />
                              <Text style={[styles.dropChipText, isDrop && styles.dropChipTextActive]}>Drop</Text>
                            </TouchableOpacity>
                          )}
                          {!isDrop && (
                            <View style={styles.repsDetailStepper}>
                              <TouchableOpacity style={styles.stepperBtnSm} onPress={() => setSubRepAtIndex(idx, -1)}>
                                <Text style={styles.stepperBtnText}>−</Text>
                              </TouchableOpacity>
                              <Text style={styles.repsDetailVal}>{reps} reps</Text>
                              <TouchableOpacity style={styles.stepperBtnSm} onPress={() => setSubRepAtIndex(idx, 1)}>
                                <Text style={styles.stepperBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {pendingSubCandidate.drop_last && (
                      <View style={styles.dropNoteBox}>
                        <View style={styles.fieldLabelRow}>
                          <Feather name="zap" size={11} color={colors.amber} />
                          <Text style={[styles.fieldLabel, { color: colors.amber }]}>Como funciona o drop</Text>
                        </View>
                        <TextInput
                          style={styles.dropNoteInput}
                          placeholder="Ex: 1 drop com 12 repetições, depois 10, depois 8"
                          placeholderTextColor={colors.textDim2}
                          value={pendingSubCandidate.drop_note || ''}
                          onChangeText={(v) => setPendingSubCandidate((prev) => (prev ? { ...prev, drop_note: v } : prev))}
                          inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                          multiline
                          numberOfLines={2}
                          textAlignVertical="top"
                        />
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}>
                    <Feather name="edit-3" size={12} color={colors.textFaint} />
                    <Text style={styles.fieldLabel}>Instruções de execução</Text>
                  </View>
                  <TextInput
                    style={styles.progressionInput}
                    placeholder="Digite como o aluno deve executar esse substituto..."
                    placeholderTextColor={colors.textDim2}
                    value={pendingSubCandidate.instructions || ''}
                    onChangeText={(v) => setPendingSubCandidate((prev) => (prev ? { ...prev, instructions: v } : prev))}
                    inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.field}>
                  <View style={styles.fieldLabelRow}>
                    <Feather name="video" size={12} color={colors.textFaint} />
                    <Text style={styles.fieldLabel}>Vídeo de demonstração</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.videoChip}
                    onPress={() => setSubVideoPickerOpen((v) => !v)}
                  >
                    <Feather name={pendingSubCandidate.video_id ? 'check-circle' : 'video'} size={13} color={colors.accent} />
                    <Text style={styles.videoChipText}>
                      {' '}
                      {pendingSubCandidate.video_id ? 'Tem vídeo · tocar pra trocar' : 'Sem vídeo · tocar pra anexar'}
                    </Text>
                  </TouchableOpacity>

                  {subVideoPickerOpen && (
                    <View style={styles.subVideoBox}>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="Buscar vídeo pelo nome"
                        placeholderTextColor={colors.textDim2}
                        value={subVideoSearch}
                        onChangeText={setSubVideoSearch}
                      />
                      {/* Sem ScrollView aninhado aqui dentro — o form inteiro já rola
                          (ScrollView acima). ScrollView dentro de ScrollView trava toques no RN. */}
                      {filteredSubVideos.length === 0 ? (
                        <Text style={styles.modalEmpty}>Nenhum vídeo encontrado.</Text>
                      ) : (
                        filteredSubVideos.slice(0, 8).map((v) => (
                          <TouchableOpacity key={v.id} style={styles.modalVideoRow} onPress={() => selectSubVideo(v)}>
                            <Feather name="film" size={14} color={colors.accent} />
                            <Text style={styles.modalVideoText}> {v.name}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          const exerciseId = pendingSubCandidate.id;
                          const exerciseName = pendingSubCandidate.name;
                          setSubVideoPickerOpen(false);
                          navigation.navigate('UploadVideo', { exerciseId, exerciseName });
                        }}
                      >
                        <Text style={styles.uploadLink}>+ Enviar vídeo novo</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                  <TouchableOpacity
                    style={[styles.addButton, { flex: 1, backgroundColor: colors.surface2 }]}
                    onPress={() => {
                      setPendingSubCandidate(null);
                      setSubVideoPickerOpen(false);
                      setSubVideoSearch('');
                    }}
                  >
                    <Text style={[styles.addButtonText, { color: colors.textDim }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.addButton, { flex: 1 }]} onPress={confirmPendingSubCandidate}>
                    <Text style={styles.addButtonText}>Adicionar substituto</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              (substitutesByExercise[subsTarget?.exerciseId] || []).length < 2 && (
                <>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Buscar exercício pelo nome"
                    placeholderTextColor={colors.textDim2}
                    value={subsSearch}
                    onChangeText={setSubsSearch}
                    autoFocus
                  />
                  <FlatList
                    style={{ maxHeight: 220 }}
                    data={exercises.filter((e) => {
                      if (e.id === subsTarget?.exerciseId) return false;
                      if ((substitutesByExercise[subsTarget?.exerciseId] || []).some((s) => s.id === e.id)) return false;
                      const q = subsSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (e.name || '').toLowerCase().includes(q) || (e.muscle_group || '').toLowerCase().includes(q);
                    })}
                    keyExtractor={(e) => e.id}
                    ListEmptyComponent={
                      <View>
                        <Text style={styles.modalEmpty}>Nenhum exercício encontrado.</Text>
                        {subsSearch.trim().length > 0 && (
                          <TouchableOpacity
                            style={styles.quickCreateRow}
                            onPress={handleQuickCreateSubExercise}
                            disabled={creatingSubExercise}
                          >
                            <Feather name="plus-circle" size={14} color={colors.accent} />
                            <Text style={styles.quickCreateText}>
                              {' '}
                              {creatingSubExercise ? 'Cadastrando...' : `Cadastrar "${subsSearch.trim()}" como exercício novo`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    }
                    renderItem={({ item: ex }) => (
                      <TouchableOpacity
                        style={styles.catalogRow}
                        onPress={() =>
                          setPendingSubCandidate({
                            ...ex,
                            target_sets: subsTarget?.target_sets || 3,
                            target_reps: subsTarget?.target_reps || 12,
                          })
                        }
                      >
                        <Text style={styles.catalogRowText}>{ex.name}</Text>
                        {ex.muscle_group ? <Text style={styles.catalogRowGroup}>{ex.muscle_group}</Text> : null}
                      </TouchableOpacity>
                    )}
                  />
                </>
              )
            )}

            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setSubsTarget(null);
                setPendingSubCandidate(null);
                setSubVideoPickerOpen(false);
                setSubVideoSearch('');
              }}
            >
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: escolher com qual exercício já adicionado este vai ser combinado (bi-set/superset) */}
      <Modal visible={!!comboTarget} transparent animationType="slide" onRequestClose={() => setComboTarget(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Combinar com qual exercício?</Text>
            <Text style={styles.modalHint}>
              Escolha outro exercício já adicionado ao treino pra fazer em sequência (bi-set/combinado).
            </Text>
            <FlatList
              style={{ maxHeight: 300 }}
              data={selected.filter((e) => e.exercise_id !== comboTarget)}
              keyExtractor={(e) => e.exercise_id}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>Adicione outro exercício ao treino primeiro pra poder combinar.</Text>
              }
              renderItem={({ item: ex }) => (
                <TouchableOpacity style={styles.catalogRow} onPress={() => linkCombo(ex.exercise_id)}>
                  <Text style={styles.catalogRowText}>{ex.name}</Text>
                  {ex.combo_group ? (
                    <Text style={styles.catalogRowGroup}>já combinado {ex.combo_group}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setComboTarget(null)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  stepTabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  stepTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 11,
  },
  stepTabActive: { backgroundColor: colors.accent },
  stepNum: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: { backgroundColor: '#08110A' },
  stepNumText: { color: colors.textDim, fontSize: 8.5, fontWeight: '700' },
  stepNumTextActive: { color: colors.accent },
  stepTabText: { color: colors.textDim2, fontSize: 11, fontWeight: '700' },
  stepTabTextActive: { color: '#08110A' },
  wizardBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    marginHorizontal: -20,
    marginBottom: -20,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  wizardStat: { flex: 1 },
  wizardStatBig: { color: colors.accent, fontSize: 19, fontWeight: '800', fontFamily: undefined },
  wizardStatLbl: { color: colors.textDim2, fontSize: 10.5, marginTop: 2 },
  wizardNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 15,
    paddingHorizontal: 26,
    borderRadius: 14,
  },
  wizardNextBtnText: { color: '#08110A', fontWeight: '700', fontSize: 14 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
  },
  reviewTitle: { color: colors.text, fontSize: 19, fontWeight: '700' },
  reviewSub: { color: colors.textDim2, fontSize: 12.5, marginTop: 2, marginBottom: 16 },
  reviewMetaGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  reviewMetaBox: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewMetaKey: { color: colors.textDim2, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  reviewMetaVal: { color: colors.text, fontSize: 13.5, fontWeight: '700', marginTop: 3 },
  reviewListLabel: { color: colors.textDim, fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  reviewEmpty: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  reviewEmptyText: { color: colors.textDim2, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  reviewItemNum: { color: colors.textDim2, fontSize: 11, width: 18 },
  reviewItemName: { color: colors.text, fontSize: 13.5, fontWeight: '600' },
  reviewItemGroup: { color: colors.textDim2, fontSize: 10.5, marginTop: 1 },
  reviewItemSx: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.accentGlow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textDim, marginBottom: 16, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  sectionLabel: { color: colors.textDim, marginBottom: 8, fontSize: 13 },
  dateInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    padding: 10,
  },
  dateInputLabel: { color: colors.textDim2, fontSize: 10, marginBottom: 4 },
  dateInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateInputValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dateInputPlaceholder: { color: colors.textDim2, fontWeight: '400' },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4,5,8,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  datePickerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    width: '100%',
    maxWidth: 400,
  },
  datePickerCardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  blockCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
  },
  blockCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  blockCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCardTitle: { color: colors.text, fontSize: 14.5, fontWeight: '800' },
  cardioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberGlow,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  cardioBadgeText: { color: colors.amber, fontSize: 10, fontWeight: '700' },
  exerciseRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  exerciseRowActive: {
    borderColor: colors.accentDark,
    backgroundColor: colors.surface2,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 12,
    gap: 10,
  },
  quickField: { alignItems: 'center', gap: 4 },
  quickFieldLabel: {
    color: colors.textFaint,
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  repsBarWrap: {
    width: 5,
    height: 26,
    borderRadius: 99,
    backgroundColor: colors.bg,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginRight: 2,
  },
  repsBar: {
    width: '100%',
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
  repsBarDrop: { backgroundColor: colors.amber },
  field: { marginTop: 12 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fieldLabel: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    paddingVertical: 8,
    paddingHorizontal: 11,
    flexShrink: 1,
  },
  chipComboActive: { backgroundColor: colors.amberGlow, borderColor: 'rgba(255,182,72,0.4)' },
  chipText: { color: colors.textDim, fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
  chipTextActive: { color: colors.accent },
  chipTextCombo: { color: colors.amber, fontWeight: '700' },
  exerciseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  exerciseName: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  exerciseGroup: { color: colors.textDim, fontSize: 12 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepperBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  stepperBtnSm: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  stepperVal: { color: colors.text, fontSize: 13.5, fontWeight: '700', minWidth: 18, textAlign: 'center' },
  stepperX: { color: colors.textFaint, fontSize: 11, paddingHorizontal: 1 },
  customRepsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    backgroundColor: colors.surface3,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  customRepsToggleText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  repsDetailBox: { marginTop: 10, gap: 6 },
  repsDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  repsDetailRowDrop: {
    backgroundColor: colors.amberGlow,
    borderWidth: 1,
    borderColor: 'rgba(255,182,72,0.35)',
  },
  repsDetailLabelDrop: { color: colors.amber, fontWeight: '700' },
  dropChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dropChipText: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  dropChipTextActive: { color: colors.amber },
  dropHint: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  dropNoteBox: {
    marginTop: 8,
    backgroundColor: colors.amberGlow,
    borderWidth: 1,
    borderColor: 'rgba(255,182,72,0.35)',
    borderRadius: radius.sm - 2,
    padding: 10,
  },
  dropNoteInput: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 12.5,
    lineHeight: 17,
    minHeight: 52,
  },
  subVideoBox: {
    marginTop: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    padding: 10,
    gap: 8,
  },
  repsDetailLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  repsDetailStepper: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  repsDetailVal: { color: colors.text, fontSize: 12.5, fontWeight: '700', minWidth: 52, textAlign: 'center' },
  customBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  customBoxToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customBoxToggleText: {
    color: colors.accent,
    fontSize: 13.5,
    fontWeight: '600',
  },
  rowVideoBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  smallFlexInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    padding: 10,
    fontSize: 14,
  },
  addButton: { backgroundColor: colors.accent, borderRadius: radius.sm - 2, paddingVertical: 10, alignItems: 'center' },
  addButtonText: { color: '#04170F', fontWeight: '700', fontSize: 13 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  dayChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  dayChipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  dayChipTextSelected: { color: colors.accent },
  videoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoChipDone: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  videoChipText: { color: colors.textDim, fontSize: 13 },
  videoChipTextDone: { color: colors.accent, fontWeight: '600' },
  videoSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.sm - 2,
    padding: 10,
  },
  videoSelectedText: { color: colors.accent, fontSize: 13, fontWeight: '600', flex: 1 },
  videoRemove: { color: colors.textDim, fontSize: 12, textDecorationLine: 'underline' },
  videoResultsBox: { backgroundColor: colors.surface2, borderRadius: radius.sm - 2, marginTop: -8, marginBottom: 12 },
  videoResultRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  videoResultText: { color: colors.text, fontSize: 13 },
  uploadLink: { color: colors.accent, fontSize: 13, marginBottom: 4, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { color: '#04170F', fontWeight: '700', fontSize: 16 },
  accessoryBar: {
    backgroundColor: colors.surface,
    padding: 8,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accessoryDone: { color: colors.accent, fontWeight: '700', fontSize: 15, paddingHorizontal: 12, paddingVertical: 4 },
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
  modalHint: { color: colors.textDim, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  subsButton: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingLeft: 2 },
  subsButtonText: { color: colors.textDim, fontSize: 11.5, flexShrink: 1, flex: 1 },
  progressionInput: {
    backgroundColor: colors.surface2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 88,
  },
  restStepper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  restChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  restChipActive: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accentDark,
  },
  restChipText: { color: colors.textDim, fontSize: 12.5, fontWeight: '600' },
  restChipTextActive: { color: colors.accent, fontWeight: '700' },
  comboToggle: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, paddingLeft: 2 },
  comboToggleText: { color: colors.textDim2, fontSize: 11.5, flexShrink: 1, flex: 1 },
  comboToggleTextActive: { color: colors.amber, fontWeight: '600' },
  typeToggleRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  typeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  typeToggleActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeToggleText: { color: colors.textDim, fontSize: 12.5, fontWeight: '600' },
  typeToggleTextActive: { color: '#04170F' },
  cardioInputs: { flexDirection: 'row', gap: 6 },
  cardioInput: {
    width: 54,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    padding: 8,
    color: colors.text,
    textAlign: 'center',
    fontSize: 13,
  },
  intensityRow: { flexDirection: 'row', gap: 6, marginTop: 10, paddingLeft: 30 },
  intensityChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensityChipActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  intensityChipText: { color: colors.textDim, fontSize: 11, textTransform: 'capitalize' },
  intensityChipTextActive: { color: colors.accent, fontWeight: '700' },
  catalogRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catalogRowText: { color: colors.text, fontSize: 14 },
  catalogRowGroup: { color: colors.textDim, fontSize: 12 },
  chosenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: 6,
  },
  chosenText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  chosenSub: { color: colors.textDim2, fontSize: 11, marginTop: 2 },
  pendingSubName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pendingSubGroup: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  pendingSubInstructions: { color: colors.textDim2, fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },
  chosenRemove: { color: colors.textDim, fontSize: 12, textDecorationLine: 'underline' },
  quickCreateRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  quickCreateText: { color: colors.accent, fontSize: 13, fontWeight: '600', flexShrink: 1 },
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
  modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  modalCloseText: { color: colors.textDim, fontSize: 14 },
});
