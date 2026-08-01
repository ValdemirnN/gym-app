import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

export default function StudentWorkoutDetailScreen({ route, navigation }) {
  const { workoutId, workoutName, studentId, studentName } = route.params;
  const [items, setItems] = useState([]);
  const [videos, setVideos] = useState([]);
  const [attachTarget, setAttachTarget] = useState(null); // { exerciseId, name }
  const [attachSearch, setAttachSearch] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('workout_exercises')
      .select('id, target_sets, target_reps, order_index, exercises(id, name, muscle_group, video_id)')
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

  const openVideo = (item) => {
    const videoId = item.exercises.video_id;
    if (!videoId) {
      setAttachTarget({ exerciseId: item.exercises.id, name: item.exercises.name });
      return;
    }
    navigation.navigate('VideoPlayer', { videoId, title: item.exercises.name });
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

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício nesse treino.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.cardMain} activeOpacity={0.8} onPress={() => openVideo(item)}>
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
                </View>
              ) : (
                <View style={styles.addVideoChip}>
                  <Feather name="film" size={11} color={colors.textDim} />
                  <Text style={styles.addVideoLabel}> Adicionar</Text>
                </View>
              )}
            </TouchableOpacity>
            {item.exercises.video_id ? (
              <TouchableOpacity style={styles.manageButton} onPress={() => manageVideo(item)}>
                <Feather name="more-vertical" size={18} color={colors.textDim} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      />

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
        <Text style={styles.deleteButtonText}>Excluir treino</Text>
      </TouchableOpacity>

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
                <TouchableOpacity style={styles.modalVideoRow} onPress={() => attachVideo(item)}>
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
    alignItems: 'center',
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
  exerciseName: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  exerciseDetail: { color: colors.textDim, fontSize: 12.5, marginTop: 2 },
  playChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
