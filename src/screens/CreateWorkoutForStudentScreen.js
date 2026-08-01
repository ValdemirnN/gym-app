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

const DAYS = [
  { key: 'segunda', label: 'Seg' },
  { key: 'terca', label: 'Ter' },
  { key: 'quarta', label: 'Qua' },
  { key: 'quinta', label: 'Qui' },
  { key: 'sexta', label: 'Sex' },
  { key: 'sabado', label: 'Sáb' },
  { key: 'domingo', label: 'Dom' },
];

const DONE_ACCESSORY_ID = 'doneAccessoryCreateWorkoutForStudent';

export default function CreateWorkoutForStudentScreen({ route, navigation }) {
  const { studentId, studentName, workoutId, workoutName: initialWorkoutName } = route.params;
  const isEditing = !!workoutId;
  const { session } = useAuth();
  const [name, setName] = useState(initialWorkoutName || '');
  const [dayOfWeek, setDayOfWeek] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingWorkout, setLoadingWorkout] = useState(isEditing);
  const [search, setSearch] = useState('');

  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseGroup, setNewExerciseGroup] = useState('');
  const [addingExercise, setAddingExercise] = useState(false);

  const [videos, setVideos] = useState([]);
  const [videoSearch, setVideoSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null); // { id, name } - pro exercício novo

  const [attachTarget, setAttachTarget] = useState(null); // { exerciseId, name } - pro exercício já selecionado
  const [attachSearch, setAttachSearch] = useState('');

  // substitutos que o personal permite trocar por cada exercício (máx. 2)
  const [substitutesByExercise, setSubstitutesByExercise] = useState({}); // { [exerciseId]: [{id, name}] }
  const [subsTarget, setSubsTarget] = useState(null); // { exerciseId, name }
  const [subsSearch, setSubsSearch] = useState('');

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('id, name, muscle_group, video_id').order('muscle_group');
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

  // Modo edição: carrega o treino existente e pré-seleciona os exercícios
  useEffect(() => {
    if (!isEditing) return;
    const loadWorkout = async () => {
      const { data: workout } = await supabase.from('workouts').select('name, day_of_week').eq('id', workoutId).single();
      if (workout) {
        setName(workout.name);
        setDayOfWeek(workout.day_of_week);
      }
      const { data: items } = await supabase
        .from('workout_exercises')
        .select(
          'target_sets, target_reps, order_index, exercises(id, name), workout_exercise_substitutes(substitute_exercise_id, exercises:substitute_exercise_id(id, name))'
        )
        .eq('workout_id', workoutId)
        .order('order_index');
      if (items) {
        setSelected(
          items.map((it) => ({
            exercise_id: it.exercises.id,
            name: it.exercises.name,
            target_sets: it.target_sets,
            target_reps: it.target_reps,
          }))
        );
        const subsMap = {};
        items.forEach((it) => {
          subsMap[it.exercises.id] = (it.workout_exercise_substitutes || [])
            .map((s) => s.exercises)
            .filter(Boolean);
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
    setSubstitutesByExercise((prev) => ({
      ...prev,
      [subsTarget.exerciseId]: [...(prev[subsTarget.exerciseId] || []), { id: data.id, name: data.name }],
    }));
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
    setVideoSearch('');
    setSelectedVideo(null);
  };

  const toggleExercise = (exercise) => {
    setSelected((prev) => {
      const exists = prev.find((e) => e.exercise_id === exercise.id);
      if (exists) return prev.filter((e) => e.exercise_id !== exercise.id);
      return [...prev, { exercise_id: exercise.id, name: exercise.name, target_sets: 3, target_reps: 12 }];
    });
  };

  const updateTarget = (exerciseId, field, value) => {
    setSelected((prev) =>
      prev.map((e) => (e.exercise_id === exerciseId ? { ...e, [field]: parseInt(value) || 0 } : e))
    );
  };

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

    let workout;
    if (isEditing) {
      const { data, error } = await supabase
        .from('workouts')
        .update({ name, day_of_week: dayOfWeek })
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
        .insert({ user_id: studentId, created_by: session.user.id, name, day_of_week: dayOfWeek })
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
      target_sets: e.target_sets,
      target_reps: e.target_reps,
      order_index: index,
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
        subRows.push({ workout_exercise_id: row.id, substitute_exercise_id: s.id });
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
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>{isEditing ? 'Editar Treino' : 'Novo Treino'}</Text>
        <Text style={styles.subtitle}>para {studentName}</Text>

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

        <Text style={styles.sectionLabel}>Selecione os exercícios:</Text>

        <TextInput
          style={styles.input}
          placeholder="Buscar por nome ou grupo (ex: Peito)"
          placeholderTextColor={colors.textDim2}
          value={search}
          onChangeText={setSearch}
        />

        <View style={styles.customBox}>
          <Text style={styles.sectionLabel}>Não achou? Adicione um exercício novo:</Text>
          <View style={{ flexDirection: 'row' }}>
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

        {filteredExercises.map((item) => {
          const selectedItem = selected.find((e) => e.exercise_id === item.id);
          const subs = substitutesByExercise[item.id] || [];
          return (
            <View key={item.id} style={styles.exerciseRow}>
              <View style={styles.exerciseTopRow}>
                <TouchableOpacity style={styles.exerciseInfo} onPress={() => toggleExercise(item)}>
                  <View style={[styles.checkbox, isSelected(item.id) && styles.checkboxChecked]}>
                    {isSelected(item.id) && <Feather name="check" size={13} color="#04170F" />}
                  </View>
                  <View>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <Text style={styles.exerciseGroup}>{item.muscle_group}</Text>
                  </View>
                </TouchableOpacity>

                {selectedItem && (
                  <View style={styles.targetInputs}>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="number-pad"
                      inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                      value={String(selectedItem.target_sets)}
                      onChangeText={(v) => updateTarget(item.id, 'target_sets', v)}
                    />
                    <Text style={styles.x}>x</Text>
                    <TextInput
                      style={styles.smallInput}
                      keyboardType="number-pad"
                      inputAccessoryViewID={Platform.OS === 'ios' ? DONE_ACCESSORY_ID : undefined}
                      value={String(selectedItem.target_reps)}
                      onChangeText={(v) => updateTarget(item.id, 'target_reps', v)}
                    />
                  </View>
                )}
              </View>

              {selectedItem && (
                <TouchableOpacity
                  style={styles.subsButton}
                  onPress={() => {
                    setSubsSearch('');
                    setSubsTarget({ exerciseId: item.id, name: item.name });
                  }}
                >
                  <Feather name="repeat" size={12} color={subs.length > 0 ? colors.accent : colors.textDim} />
                  <Text style={styles.subsButtonText}>
                    {' '}
                    {subs.length > 0
                      ? 'Substituto' + (subs.length > 1 ? 's' : '') + ': ' + subs.map((s) => s.name).join(', ')
                      : 'Cadastrar substituto (opcional)'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar Treino'}</Text>
        </TouchableOpacity>
      </ScrollView>

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

      <Modal visible={!!subsTarget} transparent animationType="slide" onRequestClose={() => setSubsTarget(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Substitutos permitidos para "{subsTarget?.name}"</Text>
            <Text style={styles.modalHint}>
              O aluno só vai poder trocar esse exercício por um dos que você escolher aqui. Não precisa ser 2 — pode
              cadastrar só 1, ou deixar sem nenhum.
            </Text>

            {(substitutesByExercise[subsTarget?.exerciseId] || []).length > 0 && (
              <View style={{ marginBottom: 10 }}>
                {(substitutesByExercise[subsTarget?.exerciseId] || []).map((s) => (
                  <View key={s.id} style={styles.chosenRow}>
                    <Text style={styles.chosenText}>✓ {s.name}</Text>
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

            {(substitutesByExercise[subsTarget?.exerciseId] || []).length < 2 && (
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
                        setSubstitutesByExercise((prev) => ({
                          ...prev,
                          [subsTarget.exerciseId]: [...(prev[subsTarget.exerciseId] || []), { id: ex.id, name: ex.name }],
                        }))
                      }
                    >
                      <Text style={styles.catalogRowText}>{ex.name}</Text>
                      {ex.muscle_group ? <Text style={styles.catalogRowGroup}>{ex.muscle_group}</Text> : null}
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            <TouchableOpacity style={styles.modalClose} onPress={() => setSubsTarget(null)}>
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
  exerciseRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
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
  targetInputs: { flexDirection: 'row', alignItems: 'center' },
  smallInput: {
    backgroundColor: colors.surface2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    width: 40,
    textAlign: 'center',
    paddingVertical: 6,
  },
  x: { color: colors.textDim, marginHorizontal: 6 },
  customBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
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
    borderRadius: radius.sm - 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
