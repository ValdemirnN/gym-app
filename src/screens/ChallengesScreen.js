import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';

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

  const loadRanking = async (challenge) => {
    if (ranking[challenge.id]) return; // já carregado
    setLoadingRanking(challenge.id);

    const { data: students } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('personal_id', session.user.id)
      .eq('is_excluded', false);

    const studentIds = (students || []).map((s) => s.id);
    let counts = {};
    if (studentIds.length > 0) {
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('user_id')
        .in('user_id', studentIds)
        .gte('started_at', challenge.start_date)
        .lte('started_at', challenge.end_date + 'T23:59:59')
        .not('finished_at', 'is', null)
        .is('skipped', false);
      (logs || []).forEach((l) => {
        counts[l.user_id] = (counts[l.user_id] || 0) + 1;
      });
    }

    const list = (students || [])
      .map((s) => ({ ...s, count: counts[s.id] || 0 }))
      .sort((a, b) => b.count - a.count);

    setRanking((prev) => ({ ...prev, [challenge.id]: list }));
    setLoadingRanking(null);
  };

  const toggleExpand = (challenge) => {
    const next = expandedId === challenge.id ? null : challenge.id;
    setExpandedId(next);
    if (next) loadRanking(challenge);
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
                  <Text style={styles.rankingTitle}>Ranking (treinos concluídos no período)</Text>
                  {loadingRanking === c.id && <Text style={styles.empty}>Carregando...</Text>}
                  {list.map((s, i) => (
                    <TouchableOpacity key={s.id} style={styles.rankRow} onPress={() => setWinner(c, s)}>
                      <Text style={styles.rankPosition}>{i + 1}º</Text>
                      <Avatar uri={s.avatar_url} size={30} />
                      <Text style={styles.rankName}>{s.name}</Text>
                      <Text style={styles.rankCount}>{s.count} treinos</Text>
                    </TouchableOpacity>
                  ))}
                  {list.length === 0 && loadingRanking !== c.id && (
                    <Text style={styles.empty}>Nenhum aluno pra ranquear ainda.</Text>
                  )}
                  <Text style={styles.hint}>Toque num aluno da lista pra marcar como vencedor.</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  newButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  newButtonText: { color: '#04170F', fontWeight: '700', fontSize: 12.5 },
  empty: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardDates: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  prizeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  prizeText: { color: colors.amber, fontSize: 12.5, fontWeight: '600' },
  winnerText: { color: colors.accent, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  rankingBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  desc: { color: colors.textDim, fontSize: 12.5, marginBottom: 10, lineHeight: 18 },
  rankingTitle: { color: colors.textDim, fontSize: 11.5, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rankPosition: { color: colors.textDim2, fontSize: 13, fontWeight: '700', width: 24 },
  rankName: { color: colors.text, fontSize: 13.5, flex: 1 },
  rankCount: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
  hint: { color: colors.textDim2, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  fieldLabel: { color: colors.textDim, fontSize: 12.5, marginBottom: 6, marginTop: 4, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#04170F', fontWeight: '700', fontSize: 14 },
  modalClose: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  modalCloseText: { color: colors.textDim, fontSize: 13 },
});
