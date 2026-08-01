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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';

const DAY_LABEL = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

// JS: getDay() -> 0 = domingo ... 6 = sábado
const WEEKDAY_KEYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const todayKey = () => WEEKDAY_KEYS[new Date().getDay()];

export default function WorkoutDetailScreen({ route, navigation }) {
  const { workoutId, workoutName, dayOfWeek } = route.params;
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [starting, setStarting] = useState(false);

  // modal: justificar troca de dia (fazer hoje um treino programado pra outro dia)
  const [dayChangeReason, setDayChangeReason] = useState('');
  const [showDayChangeModal, setShowDayChangeModal] = useState(false);

  // modal: justificar que não vai treinar hoje
  const [skipReason, setSkipReason] = useState('');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from('workout_exercises')
      .select(
        'id, target_sets, target_reps, order_index, exercises(id, name, muscle_group, video_id), workout_exercise_substitutes(substitute_exercise_id, exercises:substitute_exercise_id(id, name, muscle_group))'
      )
      .eq('workout_id', workoutId)
      .order('order_index');
    setItems(data || []);
  }, [workoutId]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  // O aluno só pode assistir ao vídeo. Adicionar/trocar/remover vídeo é
  // uma ação do Personal (ver StudentWorkoutDetailScreen.js).
  const openVideo = (item) => {
    const videoId = item.exercises.video_id;
    if (!videoId) {
      Alert.alert('Sem vídeo', 'Seu personal ainda não adicionou um vídeo de demonstração para esse exercício.');
      return;
    }
    navigation.navigate('VideoPlayer', { videoId, title: item.exercises.name });
  };

  const createLogAndGo = async (extraFields) => {
    setStarting(true);
    const { data: log, error } = await supabase
      .from('workout_logs')
      .insert({ user_id: session.user.id, workout_id: workoutId, ...extraFields })
      .select()
      .single();
    setStarting(false);

    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }

    navigation.navigate('ActiveWorkout', { logId: log.id, workoutName, exercises: items });
  };

  const handleIniciar = () => {
    // Se o treino tem um dia programado e hoje é outro dia, pede uma
    // justificativa antes de liberar o início (ex: trocou quarta por segunda).
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
    const { error } = await supabase.from('workout_logs').insert({
      user_id: session.user.id,
      workout_id: workoutId,
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
    Alert.alert('Tudo certo', 'Avisamos seu personal que você não vai treinar hoje.');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{workoutName}</Text>
          {dayOfWeek ? <Text style={styles.dayLabel}>Programado para {DAY_LABEL[dayOfWeek] || dayOfWeek}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('CreateWorkout', { workoutId, workoutName })}>
          <Text style={styles.editLink}>Editar</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openVideo(item)}>
            <View style={styles.cardIcon}>
              <Feather name="zap" size={17} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{item.exercises.name}</Text>
              <Text style={styles.exerciseDetail}>
                {item.target_sets} séries x {item.target_reps} reps · {item.exercises.muscle_group}
              </Text>
            </View>
            {item.exercises.video_id ? (
              <View style={styles.playChip}>
                <Feather name="play" size={11} color={colors.accent} />
                <Text style={styles.playChipText}>Ver vídeo</Text>
              </View>
            ) : (
              <Text style={styles.noVideoLabel}>Sem vídeo</Text>
            )}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.startButton} onPress={handleIniciar} disabled={starting} activeOpacity={0.85}>
        <Feather name="play" size={16} color="#04170F" />
        <Text style={styles.startButtonText}>{starting ? 'Abrindo...' : 'Iniciar Treino'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipDayButton} onPress={() => setShowSkipModal(true)}>
        <Text style={styles.skipDayButtonText}>Não vou treinar hoje</Text>
      </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  dayLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  editLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 1,
    padding: 14,
    marginBottom: 10,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  exerciseDetail: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  playChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  playChipText: { color: colors.accent, fontSize: 11.5, fontWeight: '700' },
  noVideoLabel: { color: colors.textDim2, fontSize: 11.5 },
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
});
