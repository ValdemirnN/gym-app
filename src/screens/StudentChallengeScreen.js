import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

const IMAGE_MIME_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
function getImageContentType(uri) {
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  return IMAGE_MIME_TYPES[ext] || 'image/jpeg';
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentChallengeScreen({ navigation }) {
  const { session, profile } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [ranking, setRanking] = useState({}); // challengeId -> [{id,name,avatar_url,count}]
  const [sending, setSending] = useState(null); // challengeId sendo enviado agora

  const load = useCallback(async () => {
    if (!profile?.personal_id) {
      setChallenges([]);
      return;
    }
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('personal_id', profile.personal_id)
      .order('start_date', { ascending: false })
      .limit(5);
    setChallenges(data || []);

    for (const c of data || []) {
      const { data: subs } = await supabase
        .from('challenge_submissions')
        .select('student_id, profiles:student_id(id, name, avatar_url)')
        .eq('challenge_id', c.id);

      const counts = {};
      const info = {};
      (subs || []).forEach((s) => {
        counts[s.student_id] = (counts[s.student_id] || 0) + 1;
        if (s.profiles) info[s.student_id] = s.profiles;
      });
      const list = Object.keys(counts)
        .map((id) => ({ id, name: info[id]?.name || 'Aluno', avatar_url: info[id]?.avatar_url, count: counts[id] }))
        .sort((a, b) => b.count - a.count);
      setRanking((prev) => ({ ...prev, [c.id]: list }));
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sendProof = async (challenge) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera pra você enviar a prova do desafio.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.length) return;

    setSending(challenge.id);
    try {
      const uri = result.assets[0].uri;
      const bytes = await new File(uri).bytes();
      const contentType = getImageContentType(uri);
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
      const path = `${challenge.id}/${session.user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('challenge-photos')
        .upload(path, bytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('challenge_submissions')
        .insert({ challenge_id: challenge.id, student_id: session.user.id, storage_path: path });
      if (insertError) throw insertError;

      Alert.alert('Prova enviada!', 'Seu ponto já apareceu no ranking.');
      load();
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setSending(null);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Desafios</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>Como participar e ganhar pontos</Text>
          <View style={styles.howStep}>
            <View style={styles.howBullet}><Text style={styles.howBulletText}>1</Text></View>
            <Text style={styles.howStepText}>Leia a descrição do desafio abaixo — ali seu personal explica a regra (ex: "treine todo dia até domingo").</Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howBullet}><Text style={styles.howBulletText}>2</Text></View>
            <Text style={styles.howStepText}>Toque em "Tirar foto e ganhar ponto" sempre que cumprir o combinado — a foto é tirada na hora, direto pelo app.</Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howBullet}><Text style={styles.howBulletText}>3</Text></View>
            <Text style={styles.howStepText}>Cada foto enviada vale 1 ponto no ranking — quanto mais provas você mandar, mais alto você sobe.</Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howBullet}><Text style={styles.howBulletText}>4</Text></View>
            <Text style={styles.howStepText}>No fim do prazo, seu personal escolhe o vencedor pelo ranking e entrega a premiação (quando tiver uma).</Text>
          </View>
        </View>

        {challenges.length === 0 && <Text style={styles.empty}>Seu personal ainda não criou nenhum desafio.</Text>}
        {challenges.map((c) => {
          const isActive = todayISO() >= c.start_date && todayISO() <= c.end_date;
          const list = ranking[c.id] || [];
          const winner = list.find((s) => s.id === c.winner_id);
          const myPosition = list.findIndex((s) => s.id === session.user.id);
          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                {isActive && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Em andamento</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDates}>
                {formatDate(c.start_date)} até {formatDate(c.end_date)}
              </Text>
              {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
              {c.prize ? (
                <View style={styles.prizeBadge}>
                  <Feather name="award" size={13} color={colors.amber} />
                  <Text style={styles.prizeText}> Premiação: {c.prize}</Text>
                </View>
              ) : null}
              {c.winner_id && winner ? <Text style={styles.winnerText}>🏆 Vencedor: {winner.name}</Text> : null}

              {isActive && (
                <TouchableOpacity style={styles.proofButton} onPress={() => sendProof(c)} disabled={sending === c.id}>
                  {sending === c.id ? (
                    <ActivityIndicator color="#04170F" size="small" />
                  ) : (
                    <>
                      <Feather name="camera" size={16} color="#04170F" />
                      <Text style={styles.proofButtonText}> Tirar foto e ganhar ponto</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {myPosition >= 0 && (
                <Text style={styles.myPosition}>
                  Você está em {myPosition + 1}º lugar, com {list[myPosition].count} foto
                  {list[myPosition].count === 1 ? '' : 's'} enviada{list[myPosition].count === 1 ? '' : 's'}
                </Text>
              )}

              <Text style={styles.rankingTitle}>Ranking</Text>
              {list.length === 0 && <Text style={styles.emptySmall}>Ninguém enviou foto ainda — seja o primeiro!</Text>}
              {list.slice(0, 10).map((s, i) => (
                <View key={s.id} style={[styles.rankRow, s.id === session.user.id && styles.rankRowMe]}>
                  <Text style={styles.rankPosition}>{i + 1}º</Text>
                  <Avatar uri={s.avatar_url} size={28} />
                  <Text style={styles.rankName}>{s.name}</Text>
                  <Text style={styles.rankCount}>{s.count} 📸</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(10), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(18), fontWeight: '800', color: colors.text, marginBottom: vs(16) },
  empty: { color: colors.textDim, fontSize: fs(11), marginTop: vs(20) },
  howCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: vs(16),
  },
  howTitle: { color: colors.text, fontSize: fs(12), fontWeight: '700', marginBottom: vs(12) },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: vs(10) },
  howBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(1),
  },
  howBulletText: { color: colors.accent, fontSize: fs(9), fontWeight: '800' },
  howStepText: { color: colors.textDim, fontSize: fs(10.5), flex: 1, lineHeight: 18 },
  emptySmall: { color: colors.textDim, fontSize: fs(10), marginBottom: vs(6) },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: vs(12) },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: fs(14), fontWeight: '700', flex: 1 },
  activeBadge: { backgroundColor: colors.accentGlow, paddingHorizontal: s(8), paddingVertical: vs(3), borderRadius: radius.pill },
  activeBadgeText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  cardDates: { color: colors.textDim, fontSize: fs(10), marginTop: vs(4) },
  desc: { color: colors.textDim, fontSize: fs(10.5), marginTop: vs(8), lineHeight: 18 },
  prizeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: vs(10) },
  prizeText: { color: colors.amber, fontSize: fs(10.5), fontWeight: '600' },
  winnerText: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700', marginTop: vs(6) },
  proofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: vs(12),
    marginTop: vs(12),
  },
  proofButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(11.5) },
  myPosition: { color: colors.text, fontSize: fs(11), fontWeight: '600', marginTop: vs(10), backgroundColor: colors.accentGlow, padding: 10, borderRadius: radius.sm },
  rankingTitle: { color: colors.textDim, fontSize: fs(9.5), fontWeight: '700', marginTop: vs(14), marginBottom: vs(6), textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: vs(7) },
  rankRowMe: { backgroundColor: colors.accentGlow, borderRadius: radius.sm, paddingHorizontal: s(6) },
  rankPosition: { color: colors.textDim2, fontSize: fs(11), fontWeight: '700', width: 22 },
  rankName: { color: colors.text, fontSize: fs(11), flex: 1 },
  rankCount: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700' },
});
