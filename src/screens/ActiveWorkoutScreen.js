import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { insertRow, updateRow } from '../lib/dataClient';
import { colors, radius } from '../theme/theme';

export default function ActiveWorkoutScreen({ route, navigation }) {
  const { logId, workoutName, exercises } = route.params;

  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const formatElapsed = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Estrutura: { [exerciseId]: [{reps, weight, done}, ...] }
  const initialState = {};
  const initialCardioState = {};
  exercises.forEach((item) => {
    if (item.exercises.exercise_type === 'cardio') {
      initialCardioState[item.exercises.id] = {
        duration: item.target_duration_minutes ? String(item.target_duration_minutes) : '',
        distance: item.target_distance_km ? String(item.target_distance_km) : '',
        intensity: item.target_intensity || 'moderada',
        done: false,
      };
      return;
    }
    initialState[item.exercises.id] = Array.from({ length: item.target_sets }, () => ({
      reps: String(item.target_reps),
      weight: '',
      done: false,
    }));
  });
  const [sets, setSets] = useState(initialState);
  const [cardio, setCardio] = useState(initialCardioState);
  const [finishing, setFinishing] = useState(false);

  // status por exercício: { [exerciseId]: { status: 'pulado'|'substituido', reason, substituteId, substituteName } }
  const [exerciseStatus, setExerciseStatus] = useState({});

  // mapa exerciseId -> lista de substitutos cadastrados pelo personal pra esse item do treino
  const allowedSubstitutesByExercise = {};
  exercises.forEach((item) => {
    allowedSubstitutesByExercise[item.exercises.id] = (item.workout_exercise_substitutes || [])
      .map((s) => s.exercises)
      .filter(Boolean);
  });

  // modal: pular exercício
  const [skipTarget, setSkipTarget] = useState(null); // { exerciseId, name }
  const [skipReasonText, setSkipReasonText] = useState('');

  // modal: substituir exercício (só entre as opções que o personal cadastrou)
  const [subTarget, setSubTarget] = useState(null); // { exerciseId, name, options }
  const [subChosen, setSubChosen] = useState(null); // { id, name }
  const [subReasonText, setSubReasonText] = useState('');

  const updateSet = (exerciseId, index, field, value) => {
    setSets((prev) => {
      const copy = { ...prev };
      copy[exerciseId] = [...copy[exerciseId]];
      copy[exerciseId][index] = { ...copy[exerciseId][index], [field]: value };
      return copy;
    });
  };

  const toggleDone = (exerciseId, index) => {
    updateSet(exerciseId, index, 'done', !sets[exerciseId][index].done);
  };

  const openActionsMenu = (item) => {
    const exerciseId = item.exercises.id;
    const status = exerciseStatus[exerciseId];
    const buttons = [];

    if (status) {
      buttons.push({
        text: 'Desfazer e voltar ao normal',
        onPress: () =>
          setExerciseStatus((prev) => {
            const copy = { ...prev };
            delete copy[exerciseId];
            return copy;
          }),
      });
    } else {
      buttons.push({
        text: 'Não vou fazer esse exercício',
        onPress: () => {
          setSkipReasonText('');
          setSkipTarget({ exerciseId, name: item.exercises.name });
        },
      });
      const options = allowedSubstitutesByExercise[exerciseId] || [];
      buttons.push({
        text: options.length > 0 ? 'Fazer outro exercício no lugar' : 'Fazer outro exercício no lugar (nenhum cadastrado)',
        onPress: () => {
          if (options.length === 0) {
            Alert.alert(
              'Nenhum substituto cadastrado',
              'Seu personal ainda não cadastrou um exercício substituto pra esse. Fale com ele pelo chat.'
            );
            return;
          }
          setSubChosen(null);
          setSubReasonText('');
          setSubTarget({ exerciseId, name: item.exercises.name, options });
        },
      });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert(item.exercises.name, 'O que você quer fazer com esse exercício?', buttons);
  };

  const confirmSkip = () => {
    if (!skipReasonText.trim()) {
      Alert.alert('Conta pra gente', 'Escreva rapidamente o motivo de não fazer esse exercício.');
      return;
    }
    setExerciseStatus((prev) => ({
      ...prev,
      [skipTarget.exerciseId]: { status: 'pulado', reason: skipReasonText.trim() },
    }));
    setSkipTarget(null);
    setSkipReasonText('');
  };

  const confirmSubstitute = () => {
    if (!subChosen) {
      Alert.alert('Escolha um exercício', 'Toque em um exercício da lista para substituir.');
      return;
    }
    setExerciseStatus((prev) => ({
      ...prev,
      [subTarget.exerciseId]: {
        status: 'substituido',
        substituteId: subChosen.id,
        substituteName: subChosen.name,
        reason: subReasonText.trim() || null,
      },
    }));
    setSubTarget(null);
    setSubChosen(null);
    setSubReasonText('');
  };

  const openVideo = (item) => {
    const videoId = item.exercises.video_id;
    if (!videoId) {
      Alert.alert('Sem vídeo', 'Seu personal ainda não adicionou um vídeo de demonstração para esse exercício.');
      return;
    }
    navigation.navigate('VideoPlayer', { videoId, title: item.exercises.name });
  };

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishedAt, setFinishedAt] = useState(null);
  const [moodChoice, setMoodChoice] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState('');

  const finishWorkout = async () => {
    setFinishing(true);

    const rows = [];
    Object.entries(sets).forEach(([exerciseId, setList]) => {
      const status = exerciseStatus[exerciseId];
      if (status?.status === 'pulado') return; // exercício pulado não gera séries

      const effectiveExerciseId = status?.status === 'substituido' ? status.substituteId : exerciseId;

      setList.forEach((s, index) => {
        if (s.done) {
          rows.push({
            workout_log_id: logId,
            exercise_id: effectiveExerciseId,
            set_number: index + 1,
            reps_done: parseInt(s.reps) || 0,
            weight_kg: parseFloat(s.weight) || 0,
          });
        }
      });
    });

    // Cardio: só entra no registro o que o aluno marcou como concluído
    const cardioRows = [];
    Object.entries(cardio).forEach(([exerciseId, c]) => {
      const status = exerciseStatus[exerciseId];
      if (status?.status === 'pulado' || !c.done) return;
      const effectiveExerciseId = status?.status === 'substituido' ? status.substituteId : exerciseId;
      cardioRows.push({
        workout_log_id: logId,
        exercise_id: effectiveExerciseId,
        duration_minutes: c.duration ? parseFloat(c.duration.replace(',', '.')) : null,
        distance_km: c.distance ? parseFloat(c.distance.replace(',', '.')) : null,
        intensity: c.intensity || null,
      });
    });

    let wentOffline = false;

    if (rows.length > 0) {
      const { offline, error } = await insertRow('workout_log_sets', rows);
      if (error) {
        setFinishing(false);
        Alert.alert('Erro', error.message);
        return;
      }
      wentOffline = wentOffline || offline;
    }

    if (cardioRows.length > 0) {
      const { offline, error } = await insertRow('workout_log_cardio', cardioRows);
      if (error) {
        setFinishing(false);
        Alert.alert('Erro', error.message);
        return;
      }
      wentOffline = wentOffline || offline;
    }

    // Registra os exercícios pulados/substituídos (só os que tiveram alteração)
    const statusRows = Object.entries(exerciseStatus).map(([exerciseId, s]) => ({
      workout_log_id: logId,
      exercise_id: exerciseId,
      status: s.status,
      substitute_exercise_id: s.status === 'substituido' ? s.substituteId : null,
      reason: s.reason || null,
    }));

    if (statusRows.length > 0) {
      const { offline, error: statusError } = await insertRow('workout_log_exercise_status', statusRows);
      if (statusError) {
        setFinishing(false);
        Alert.alert('Erro', statusError.message);
        return;
      }
      wentOffline = wentOffline || offline;
    }

    const { offline: finishOffline } = await updateRow(
      'workout_logs',
      {
        finished_at: new Date().toISOString(),
        duration_seconds: elapsedSeconds,
        feedback_mood: moodChoice,
        feedback_comment: feedbackComment.trim() || null,
      },
      { id: logId }
    );
    wentOffline = wentOffline || finishOffline;

    setFinishing(false);
    setShowFinishModal(false);
    if (wentOffline) {
      Alert.alert(
        'Sem internet',
        'Bom trabalho 💪 Você tava sem internet — assim que conectar, o treino sobe automaticamente pro seu personal.'
      );
    }
    navigation.popToTop();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{workoutName}</Text>
        <View style={styles.timerBadge}>
          <Feather name="clock" size={13} color={colors.accent} />
          <Text style={styles.timerText}> {formatElapsed(elapsedSeconds)}</Text>
        </View>
      </View>

      {exercises.map((item) => {
        const exerciseId = item.exercises.id;
        const status = exerciseStatus[exerciseId];
        const comboPartners = item.combo_group
          ? exercises.filter((e) => e.combo_group === item.combo_group && e.exercises.id !== exerciseId).map((e) => e.exercises.name)
          : [];

        return (
          <View key={exerciseId} style={styles.exerciseBlock}>
            {item.combo_group && (
              <View style={styles.comboBadge}>
                <Feather name="repeat" size={11} color={colors.amber} />
                <Text style={styles.comboBadgeText}>
                  {' '}Combinado {item.combo_group}
                  {comboPartners.length > 0 ? ` · alterne com ${comboPartners.join(', ')}` : ''}
                </Text>
              </View>
            )}
            <View style={styles.exerciseHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>
                  {status?.status === 'substituido' ? status.substituteName : item.exercises.name}
                </Text>
                {status?.status === 'substituido' && (
                  <Text style={styles.substitutedLabel}>no lugar de {item.exercises.name}</Text>
                )}
                {item.exercises.instructions ? (
                  <Text style={styles.instructionsText}>{item.exercises.instructions}</Text>
                ) : null}
                {item.exercises.video_id ? (
                  <TouchableOpacity style={styles.videoButton} onPress={() => openVideo(item)}>
                    <View style={styles.videoThumb}>
                      <Feather name="play" size={13} color="#fff" />
                    </View>
                    <Text style={styles.videoButtonText}>Ver vídeo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity style={styles.menuButton} onPress={() => openActionsMenu(item)}>
                <Feather name="more-vertical" size={18} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            {status?.status === 'pulado' ? (
              <View style={styles.skippedBox}>
                <Feather name="x-circle" size={14} color={colors.red} />
                <Text style={styles.skippedText}>Exercício pulado — {status.reason}</Text>
              </View>
            ) : item.exercises.exercise_type === 'cardio' ? (
              <View style={styles.cardioBlock}>
                {(item.target_duration_minutes || item.target_distance_km || item.target_intensity) && (
                  <Text style={styles.cardioTarget}>
                    Meta:{' '}
                    {[
                      item.target_duration_minutes ? `${item.target_duration_minutes} min` : null,
                      item.target_distance_km ? `${item.target_distance_km} km` : null,
                      item.target_intensity ? `intensidade ${item.target_intensity}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
                <View style={styles.cardioRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardioLabel}>Minutos</Text>
                    <TextInput
                      style={styles.setInput}
                      placeholder="min"
                      placeholderTextColor={colors.textDim2}
                      keyboardType="number-pad"
                      value={cardio[exerciseId]?.duration || ''}
                      onChangeText={(v) => setCardio((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId], duration: v } }))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardioLabel}>Distância (km)</Text>
                    <TextInput
                      style={styles.setInput}
                      placeholder="km"
                      placeholderTextColor={colors.textDim2}
                      keyboardType="decimal-pad"
                      value={cardio[exerciseId]?.distance || ''}
                      onChangeText={(v) => setCardio((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId], distance: v } }))}
                    />
                  </View>
                </View>
                <View style={styles.intensityRow}>
                  {['leve', 'moderada', 'intensa'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[styles.intensityChip, cardio[exerciseId]?.intensity === level && styles.intensityChipActive]}
                      onPress={() => setCardio((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId], intensity: level } }))}
                    >
                      <Text
                        style={[
                          styles.intensityChipText,
                          cardio[exerciseId]?.intensity === level && styles.intensityChipTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.cardioDoneButton, cardio[exerciseId]?.done && styles.cardioDoneButtonActive]}
                  onPress={() => setCardio((prev) => ({ ...prev, [exerciseId]: { ...prev[exerciseId], done: !prev[exerciseId]?.done } }))}
                >
                  <Feather name={cardio[exerciseId]?.done ? 'check-circle' : 'circle'} size={16} color={cardio[exerciseId]?.done ? '#04170F' : colors.textDim} />
                  <Text style={[styles.cardioDoneText, cardio[exerciseId]?.done && styles.cardioDoneTextActive]}>
                    {' '}{cardio[exerciseId]?.done ? 'Concluído' : 'Marcar como concluído'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              sets[exerciseId].map((s, index) => (
                <View key={index} style={styles.setRow}>
                  <Text style={styles.setLabel}>Série {index + 1}</Text>

                  <TextInput
                    style={styles.setInput}
                    placeholder="Kg"
                    placeholderTextColor={colors.textDim2}
                    keyboardType="numeric"
                    value={s.weight}
                    onChangeText={(v) => updateSet(exerciseId, index, 'weight', v)}
                  />
                  <TextInput
                    style={styles.setInput}
                    placeholder="Reps"
                    placeholderTextColor={colors.textDim2}
                    keyboardType="numeric"
                    value={s.reps}
                    onChangeText={(v) => updateSet(exerciseId, index, 'reps', v)}
                  />

                  <TouchableOpacity
                    style={[styles.doneButton, s.done && styles.doneButtonActive]}
                    onPress={() => toggleDone(exerciseId, index)}
                  >
                    {s.done ? <Feather name="check" size={16} color="#04170F" /> : null}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.finishButton}
        onPress={() => {
          setFinishedAt(Date.now());
          setShowFinishModal(true);
        }}
        disabled={finishing}
        activeOpacity={0.85}
      >
        <Text style={styles.finishButtonText}>Finalizar Treino</Text>
      </TouchableOpacity>

      {/* Modal: motivo de pular o exercício */}
      <Modal visible={!!skipTarget} transparent animationType="slide" onRequestClose={() => setSkipTarget(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Por que não vai fazer "{skipTarget?.name}"?</Text>
            <TextInput
              style={styles.modalTextArea}
              placeholder="Ex: dor no ombro, sem equipamento disponível..."
              placeholderTextColor={colors.textDim2}
              value={skipReasonText}
              onChangeText={setSkipReasonText}
              multiline
              autoFocus
            />
            <TouchableOpacity style={styles.modalConfirm} onPress={confirmSkip}>
              <Text style={styles.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSkipTarget(null)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: escolher exercício substituto */}
      <Modal visible={!!subTarget} transparent animationType="slide" onRequestClose={() => setSubTarget(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Trocar "{subTarget?.name}" por qual exercício?</Text>

            {subChosen ? (
              <View style={styles.chosenRow}>
                <Text style={styles.chosenText}>✓ {subChosen.name}</Text>
                <TouchableOpacity onPress={() => setSubChosen(null)}>
                  <Text style={styles.chosenRemove}>trocar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.modalHint}>Escolhidos pelo seu personal pra esse exercício:</Text>
                <FlatList
                  style={{ maxHeight: 220 }}
                  data={subTarget?.options || []}
                  keyExtractor={(e) => e.id}
                  ListEmptyComponent={<Text style={styles.modalEmpty}>Nenhum exercício cadastrado.</Text>}
                  renderItem={({ item: ex }) => (
                    <TouchableOpacity style={styles.catalogRow} onPress={() => setSubChosen(ex)}>
                      <Text style={styles.catalogRowText}>{ex.name}</Text>
                      {ex.muscle_group ? <Text style={styles.catalogRowGroup}>{ex.muscle_group}</Text> : null}
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            <TextInput
              style={[styles.modalTextArea, { marginTop: 12 }]}
              placeholder="Motivo da troca (opcional)"
              placeholderTextColor={colors.textDim2}
              value={subReasonText}
              onChangeText={setSubReasonText}
              multiline
            />

            <TouchableOpacity style={styles.modalConfirm} onPress={confirmSubstitute}>
              <Text style={styles.modalConfirmText}>Confirmar substituição</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSubTarget(null)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showFinishModal} transparent animationType="slide" onRequestClose={() => setShowFinishModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <View style={styles.finishIconCircle}>
              <Feather name="award" size={26} color="#04170F" />
            </View>
            <Text style={styles.finishTitle}>Parabéns!</Text>
            <Text style={styles.finishSubtitle}>Você concluiu seu treino!</Text>

            <View style={styles.finishStatsBox}>
              <View style={styles.finishStatsRow}>
                <Text style={styles.finishStatsLabel}>Início</Text>
                <Text style={styles.finishStatsValue}>
                  {new Date(startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.finishStatsRow}>
                <Text style={styles.finishStatsLabel}>Fim</Text>
                <Text style={styles.finishStatsValue}>
                  {finishedAt
                    ? new Date(finishedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </Text>
              </View>
              <View style={styles.finishStatsRow}>
                <Text style={styles.finishStatsLabel}>Tempo de treino</Text>
                <Text style={styles.finishStatsValue}>{formatElapsed(elapsedSeconds)}</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>O que você achou dessa atividade?</Text>
            <View style={styles.moodRow}>
              {[
                { key: 'leve', label: 'Tranquilo' },
                { key: 'moderado', label: 'Moderado' },
                { key: 'dificil', label: 'Difícil' },
                { key: 'exaustao', label: 'Exaustão máxima' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.moodChip, moodChoice === m.key && styles.moodChipActive]}
                  onPress={() => setMoodChoice(m.key)}
                >
                  <Text style={[styles.moodChipText, moodChoice === m.key && styles.moodChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Deixe seu comentário aqui</Text>
            <TextInput
              style={styles.modalTextArea}
              placeholder="Como foi o treino hoje?"
              placeholderTextColor={colors.textDim2}
              value={feedbackComment}
              onChangeText={setFeedbackComment}
              multiline
            />

            <TouchableOpacity style={styles.modalConfirm} onPress={finishWorkout} disabled={finishing}>
              <Text style={styles.modalConfirmText}>{finishing ? 'Salvando...' : 'Concluir'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  timerText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  finishIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  finishTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  finishSubtitle: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  finishStatsBox: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
  },
  finishStatsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  finishStatsLabel: { color: colors.textDim, fontSize: 12.5, fontWeight: '600' },
  finishStatsValue: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
  fieldLabel: { color: colors.textDim, fontSize: 12.5, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  moodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  moodChipText: { color: colors.textDim, fontSize: 12 },
  moodChipTextActive: { color: '#04170F', fontWeight: '700' },
  exerciseBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 1,
    padding: 14,
    marginBottom: 14,
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exerciseName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  substitutedLabel: { color: colors.textDim, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  menuButton: { paddingHorizontal: 10, paddingVertical: 4 },
  skippedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.redGlow,
    borderRadius: radius.sm,
    padding: 12,
  },
  skippedText: { color: colors.red, fontSize: 13, flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  cardioBlock: { marginTop: 4 },
  cardioTarget: { color: colors.textDim, fontSize: 12, marginBottom: 10 },
  cardioRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cardioLabel: { color: colors.textDim2, fontSize: 11, marginBottom: 4 },
  intensityRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  intensityChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intensityChipActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  intensityChipText: { color: colors.textDim, fontSize: 11.5, textTransform: 'capitalize' },
  intensityChipTextActive: { color: colors.accent, fontWeight: '700' },
  cardioDoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 11,
  },
  cardioDoneButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  cardioDoneText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  cardioDoneTextActive: { color: '#04170F' },
  setLabel: { color: colors.textDim, width: 56, fontSize: 12.5 },
  setInput: {
    backgroundColor: colors.surface2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    width: 60,
    textAlign: 'center',
    paddingVertical: 8,
  },
  doneButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  doneButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  finishButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center', marginTop: 8 },
  finishButtonText: { color: '#04170F', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalHint: { color: colors.textDim, fontSize: 12.5, marginBottom: 8 },
  videoButton: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  videoThumb: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  comboBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  comboBadgeText: { color: colors.amber, fontSize: 11, fontWeight: '700' },
  instructionsText: { color: colors.textDim, fontSize: 12, lineHeight: 17, marginTop: 6 },
  videoButtonText: { color: colors.accent, fontSize: 12, fontWeight: '600', marginLeft: 4 },
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
  modalTextArea: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalEmpty: { color: colors.textDim, fontSize: 13, paddingVertical: 12 },
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
    padding: 12,
    marginBottom: 4,
  },
  chosenText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  chosenRemove: { color: colors.textDim, fontSize: 12, textDecorationLine: 'underline' },
  modalConfirm: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 14, alignItems: 'center', marginTop: 14 },
  modalConfirmText: { color: '#04170F', fontWeight: '700', fontSize: 15 },
  modalClose: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  modalCloseText: { color: colors.textDim, fontSize: 14 },
});
