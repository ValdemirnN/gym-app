import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ChallengesScreen({ navigation }) {
  const { session } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [ranking, setRanking] = useState({}); // challengeId -> [{id,name,avatar_url,count}]
  const [loadingRanking, setLoadingRanking] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [viewingPhotos, setViewingPhotos] = useState(null); // { challenge, student }
  const [deletingPhoto, setDeletingPhoto] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prize, setPrize] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('personal_id', session.user.id)
      .order('start_date', { ascending: false });
    setChallenges(data || []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadRanking = async (challenge, force) => {
    if (ranking[challenge.id] && !force) return; // já carregado
    setLoadingRanking(challenge.id);

    const { data: subs } = await supabase
      .from('challenge_submissions')
      .select('id, student_id, storage_path, created_at, profiles:student_id(id, name, avatar_url)')
      .eq('challenge_id', challenge.id)
      .order('created_at', { ascending: false });

    const counts = {};
    const info = {};
    const photosByStudent = {};
    (subs || []).forEach((s) => {
      counts[s.student_id] = (counts[s.student_id] || 0) + 1;
      if (s.profiles) info[s.student_id] = s.profiles;
      photosByStudent[s.student_id] = photosByStudent[s.student_id] || [];
      photosByStudent[s.student_id].push(s);
    });

    const list = Object.keys(counts)
      .map((id) => ({
        id,
        name: info[id]?.name || 'Aluno',
        avatar_url: info[id]?.avatar_url,
        count: counts[id],
        photos: photosByStudent[id],
      }))
      .sort((a, b) => b.count - a.count);

    setRanking((prev) => ({ ...prev, [challenge.id]: list }));
    setLoadingRanking(null);
  };

  const toggleExpand = (challenge) => {
    const next = expandedId === challenge.id ? null : challenge.id;
    setExpandedId(next);
    if (next) loadRanking(challenge);
  };

  const deletePhoto = async (challengeId, photo) => {
    Alert.alert('Apagar foto', 'Isso remove o ponto dessa foto do ranking. Confirma?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          setDeletingPhoto(photo.id);
          await supabase.storage.from('challenge-photos').remove([photo.storage_path]);
          const { error } = await supabase.from('challenge_submissions').delete().eq('id', photo.id);
          setDeletingPhoto(null);
          if (error) {
            Alert.alert('Erro', error.message);
            return;
          }
          setViewingPhotos(null);
          const c = challenges.find((ch) => ch.id === challengeId);
          if (c) loadRanking(c, true);
        },
      },
    ]);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrize('');
    setStartDate(todayISO());
    setEndDate('');
  };

  const handleCreate = async () => {
    if (!title.trim() || !endDate.trim()) {
      Alert.alert('Faltou algo', 'Preenche pelo menos o título e a data final.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('challenges').insert({
      personal_id: session.user.id,
      title: title.trim(),
      description: description.trim() || null,
      prize: prize.trim() || null,
      start_date: startDate,
      end_date: endDate,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setShowCreate(false);
    resetForm();
    load();
  };

  const setWinner = async (challenge, winner) => {
    Alert.alert('Definir vencedor', `Marcar ${winner.name} como vencedor de "${challenge.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          const { error } = await supabase.from('challenges').update({ winner_id: winner.id }).eq('id', challenge.id);
          if (error) {
            Alert.alert('Erro', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.title}>Desafios</Text>
        <TouchableOpacity style={styles.newButton} onPress={() => setShowCreate(true)}>
          <Feather name="plus" size={16} color="#04170F" />
          <Text style={styles.newButtonText}>Novo desafio</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.howNote}>
        Cada aluno tira uma foto pelo app pra provar que cumpriu a regra do desafio — cada foto vale 1 ponto no
        ranking. Você escreve a regra e o prazo, e escolhe o vencedor no fim.
      </Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {challenges.length === 0 && (
          <Text style={styles.empty}>
            Nenhum desafio criado ainda. Crie um desafio pra motivar seus alunos — o ranking é calculado
            automaticamente pela quantidade de treinos concluídos no período.
          </Text>
        )}

        {challenges.map((c) => {
          const isOpen = expandedId === c.id;
          const list = ranking[c.id] || [];
          const winner = list.find((s) => s.id === c.winner_id);
          const isActive = todayISO() >= c.start_date && todayISO() <= c.end_date;
          return (
            <View key={c.id} style={styles.card}>
              <TouchableOpacity onPress={() => toggleExpand(c)}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    <Text style={styles.cardDates}>
                      {formatDate(c.start_date)} até {formatDate(c.end_date)}
                      {isActive ? ' · em andamento' : ''}
                    </Text>
                  </View>
                  <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textDim2} />
                </View>
                {c.prize ? (
                  <View style={styles.prizeBadge}>
                    <Feather name="award" size={12} color={colors.amber} />
                    <Text style={styles.prizeText}> {c.prize}</Text>
                  </View>
                ) : null}
                {c.winner_id && winner ? (
                  <Text style={styles.winnerText}>🏆 Vencedor: {winner.name}</Text>
                ) : null}
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.rankingBox}>
                  {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
                  <Text style={styles.rankingTitle}>Ranking (fotos enviadas como prova)</Text>
                  {loadingRanking === c.id && <Text style={styles.empty}>Carregando...</Text>}
                  {list.map((s, i) => (
                    <View key={s.id} style={styles.rankRow}>
                      <Text style={styles.rankPosition}>{i + 1}º</Text>
                      <Avatar uri={s.avatar_url} size={30} />
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => setWinner(c, s)}>
                        <Text style={styles.rankName}>{s.name}</Text>
                      </TouchableOpacity>
                      <Text style={styles.rankCount}>{s.count} 📸</Text>
                      <TouchableOpacity onPress={() => setViewingPhotos({ challenge: c, student: s })}>
                        <Feather name="image" size={16} color={colors.textDim2} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {list.length === 0 && loadingRanking !== c.id && (
                    <Text style={styles.empty}>Ninguém enviou foto nesse desafio ainda.</Text>
                  )}
                  <Text style={styles.hint}>Toque no nome pra marcar vencedor, ou no ícone de foto pra ver/apagar as provas.</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>Novo desafio</Text>

            <Text style={styles.fieldLabel}>Título</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Desafio de Agosto" placeholderTextColor={colors.textDim2} autoFocus />

            <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline value={description} onChangeText={setDescription} placeholderTextColor={colors.textDim2} />

            <Text style={styles.fieldLabel}>Premiação (opcional)</Text>
            <TextInput style={styles.input} value={prize} onChangeText={setPrize} placeholder="Ex: Camiseta da academia" placeholderTextColor={colors.textDim2} />

            <Text style={styles.fieldLabel}>Data início (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholderTextColor={colors.textDim2} />

            <Text style={styles.fieldLabel}>Data fim (AAAA-MM-DD)</Text>
            <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="2026-08-31" placeholderTextColor={colors.textDim2} />

            <TouchableOpacity style={styles.saveButton} onPress={handleCreate} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Criando...' : 'Criar desafio'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreate(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!viewingPhotos} transparent animationType="slide" onRequestClose={() => setViewingPhotos(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Fotos de {viewingPhotos?.student?.name}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.photoGrid}>
                {(viewingPhotos?.student?.photos || []).map((p) => {
                  const { data } = supabase.storage.from('challenge-photos').getPublicUrl(p.storage_path);
                  return (
                    <View key={p.id} style={styles.photoItem}>
                      <Image source={{ uri: data.publicUrl }} style={styles.photoImage} />
                      <TouchableOpacity
                        style={styles.photoDeleteButton}
                        onPress={() => deletePhoto(viewingPhotos.challenge.id, p)}
                        disabled={deletingPhoto === p.id}
                      >
                        <Feather name="trash-2" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setViewingPhotos(null)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(10), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(16) },
  title: { fontSize: fs(18), fontWeight: '800', color: colors.text },
  newButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingHorizontal: s(12), paddingVertical: vs(8), borderRadius: radius.pill },
  newButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(10.5) },
  empty: { color: colors.textDim, fontSize: fs(11), lineHeight: 19, marginTop: vs(20) },
  howNote: { color: colors.textDim, fontSize: fs(10), lineHeight: 17, marginBottom: vs(16) },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: vs(10) },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: fs(13), fontWeight: '700' },
  cardDates: { color: colors.textDim, fontSize: fs(10), marginTop: vs(2) },
  prizeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: vs(8) },
  prizeText: { color: colors.amber, fontSize: fs(10.5), fontWeight: '600' },
  winnerText: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700', marginTop: vs(6) },
  rankingBox: { marginTop: vs(14), borderTopWidth: 1, borderTopColor: colors.border, paddingTop: vs(12) },
  desc: { color: colors.textDim, fontSize: fs(10.5), marginBottom: vs(10), lineHeight: 18 },
  rankingTitle: { color: colors.textDim, fontSize: fs(9.5), fontWeight: '700', marginBottom: vs(8), textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: vs(8) },
  rankPosition: { color: colors.textDim2, fontSize: fs(11), fontWeight: '700', width: 24 },
  rankName: { color: colors.text, fontSize: fs(11.5), flex: 1 },
  rankCount: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700' },
  hint: { color: colors.textDim2, fontSize: fs(9), marginTop: vs(6), fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: fs(14), fontWeight: '700', marginBottom: vs(14) },
  fieldLabel: { color: colors.textDim, fontSize: fs(10.5), marginBottom: vs(6), marginTop: vs(4), fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: s(12),
    paddingVertical: vs(10),
    color: colors.text,
    fontSize: fs(12),
    marginBottom: vs(4),
  },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: vs(13), alignItems: 'center', marginTop: vs(16) },
  saveButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(12) },
  modalClose: { alignItems: 'center', paddingVertical: vs(12), marginTop: vs(4) },
  modalCloseText: { color: colors.textDim, fontSize: fs(11) },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: '31%', aspectRatio: 1, position: 'relative' },
  photoImage: { width: '100%', height: '100%', borderRadius: radius.sm, backgroundColor: colors.surface },
  photoDeleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 5,
  },
});
