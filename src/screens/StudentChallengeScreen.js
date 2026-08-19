import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / MS);
}

// Status do desafio do ponto de vista do aluno — mesma lógica usada na tela do personal.
function getStatus(c) {
  if (c.finished_at) return { key: 'finalizado', label: 'finalizado' };
  if (todayISO() > c.end_date) return { key: 'encerrado', label: 'encerrado' };
  if (todayISO() < c.start_date) return { key: 'agendado', label: 'agendado' };
  return { key: 'andamento', label: 'em andamento' };
}

// Mesma tabela de tipos usada na tela do personal (ChallengesScreen.js).
// Mantida aqui em duplicata simples pra essa tela não depender da outra;
// se preferir, pode extrair pra um arquivo compartilhado (ex: src/constants/challengeTypes.js).
const TYPE_META = {
  FOTO: { icon: 'camera', actionLabel: 'Tirar foto e ganhar ponto', unit: '📸' },
  VIDEO: { icon: 'video', actionLabel: 'Gravar vídeo e ganhar ponto', unit: '🎬' },
  TEXTO: { icon: 'edit-3', actionLabel: 'Responder e ganhar ponto', unit: '📝' },
  NUMERICO: { icon: 'hash', actionLabel: 'Registrar e ganhar ponto', unit: '🔢' },
};
function typeMeta(type) {
  return TYPE_META[type] || TYPE_META.FOTO;
}

// Explica pro aluno como o vencedor é decidido, de acordo com o tipo do desafio.
function winnerRuleText(type) {
  if (type === 'FOTO' || type === 'VIDEO') return 'Vale 1 envio por dia. No fim, vence quem tiver mais pontos.';
  if (type === 'TEXTO') return 'Seu personal lê as respostas e escolhe o vencedor — não é só pela posição no ranking.';
  if (type === 'NUMERICO') return 'Seu personal decide o vencedor pela quantidade enviada e pela posição no ranking.';
  return '';
}

export default function StudentChallengeScreen({ navigation }) {
  const { session, profile } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [ranking, setRanking] = useState({}); // challengeId -> [{id,name,avatar_url,count}]
  const [submittedToday, setSubmittedToday] = useState({}); // challengeId -> bool (só relevante p/ FOTO/VIDEO)
  const [sending, setSending] = useState(null); // challengeId sendo enviado agora
  const [drafts, setDrafts] = useState({}); // challengeId -> texto/número digitado ainda não enviado

  const setDraft = (challengeId, value) => setDrafts((prev) => ({ ...prev, [challengeId]: value }));

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
      const { data: subs, error } = await supabase
        .from('challenge_submissions')
        .select('id, student_id, created_at, profiles:student_id(id, name, avatar_url)')
        .eq('challenge_id', c.id);

      if (error) {
        console.log('Erro ao carregar ranking do desafio', c.id, error.message);
        continue;
      }

      const counts = {};
      const info = {};
      let submittedToday = false;
      const todayStr = todayISO();
      (subs || []).forEach((s) => {
        counts[s.student_id] = (counts[s.student_id] || 0) + 1;
        if (s.profiles) info[s.student_id] = s.profiles;
        if (s.student_id === session.user.id && (s.created_at || '').slice(0, 10) === todayStr) {
          submittedToday = true;
        }
      });
      const list = Object.keys(counts)
        .map((id) => ({ id, name: info[id]?.name || 'Aluno', avatar_url: info[id]?.avatar_url, count: counts[id] }))
        .sort((a, b) => b.count - a.count);
      setRanking((prev) => ({ ...prev, [c.id]: list }));
      setSubmittedToday((prev) => ({ ...prev, [c.id]: submittedToday }));
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Envia a prova de um desafio de FOTO ou VIDEO — abre a câmera/galeria,
  // mas (como já era antes) não faz upload nenhum: é só o ritual de provar.
  const sendMediaProof = async (challenge) => {
    if (submittedToday[challenge.id]) {
      Alert.alert('Prova de hoje já enviada', 'Só vale 1 envio por dia nesse desafio. Volte amanhã pra mandar a próxima!');
      return;
    }
    if (challenge.type === 'VIDEO') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera pra você enviar o vídeo do desafio.');
        return;
      }
      const maxDuration = challenge.config?.max_duration_seconds || 30;
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: maxDuration });
      if (result.canceled || !result.assets?.length) return;
    } else {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera pra você enviar a prova do desafio.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets?.length) return;
    }

    await submit(challenge, {});
  };

  // Envia a resposta de um desafio de TEXTO.
  const sendTextAnswer = async (challenge) => {
    const answer = (drafts[challenge.id] || '').trim();
    if (!answer) {
      Alert.alert('Escreva sua resposta', 'O campo de resposta não pode ficar vazio.');
      return;
    }
    await submit(challenge, { text_response: answer });
  };

  // Envia o valor de um desafio NUMERICO.
  const sendNumericAnswer = async (challenge) => {
    const raw = (drafts[challenge.id] || '').replace(',', '.').trim();
    const value = Number(raw);
    if (!raw || Number.isNaN(value)) {
      Alert.alert('Valor inválido', 'Digite um número válido.');
      return;
    }
    await submit(challenge, { numeric_response: value, numeric_unit: challenge.config?.unit || null });
  };

  // Insere a submission no banco e limpa o rascunho local. Comum a todos os tipos.
  const submit = async (challenge, extraFields) => {
    setSending(challenge.id);
    try {
      const { error: insertError } = await supabase.from('challenge_submissions').insert({
        challenge_id: challenge.id,
        student_id: session.user.id,
        ...extraFields,
      });
      if (insertError) throw insertError;

      setDrafts((prev) => ({ ...prev, [challenge.id]: '' }));
      Alert.alert('Enviado!', 'Seu ponto já apareceu no ranking.');
      load();
    } catch (e) {
      // Se o gatilho do banco barrar (ex: já enviou hoje), a mensagem já vem pronta.
      Alert.alert('Não foi possível enviar', e.message);
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
            <View style={styles.howStepLine} />
            <View style={styles.howBullet}><Text style={styles.howBulletText}>1</Text></View>
            <Text style={styles.howStepText}>Leia a descrição do desafio abaixo — ali seu personal explica a regra (ex: "treine todo dia até domingo").</Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howStepLine} />
            <View style={styles.howBullet}><Text style={styles.howBulletText}>2</Text></View>
            <Text style={styles.howStepText}>Cumpra o combinado e envie sua prova — foto, vídeo, resposta escrita ou número, dependendo do tipo do desafio.</Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howStepLine} />
            <View style={styles.howBullet}><Text style={styles.howBulletText}>3</Text></View>
            <Text style={styles.howStepText}>Cada envio vale 1 ponto no ranking — quanto mais provas você mandar, mais alto você sobe.</Text>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howBullet}><Text style={styles.howBulletText}>4</Text></View>
            <Text style={styles.howStepText}>No fim do prazo, seu personal escolhe o vencedor pelo ranking e entrega a premiação (quando tiver uma).</Text>
          </View>
        </View>

        {challenges.length === 0 && <Text style={styles.empty}>Seu personal ainda não criou nenhum desafio.</Text>}
        {challenges.map((c) => {
          const status = getStatus(c);
          const isActive = status.key === 'andamento';
          const daysLeft = Math.max(0, daysBetween(todayISO(), c.end_date));
          const list = ranking[c.id] || [];
          const winner = list.find((s) => s.id === c.winner_id);
          const myPosition = list.findIndex((s) => s.id === session.user.id);
          const top3 = list.slice(0, 3);
          const rest = list.slice(3, 10);
          // pódio na ordem visual 2º-1º-3º
          const podiumOrder = [top3[1], top3[0], top3[2]];

          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.filmStrip} />
              <View style={styles.cardBodyInner}>
                <View style={styles.cardTop}>
                  <View style={[styles.statusBadge, status.key !== 'andamento' && styles.statusBadgeMuted]}>
                    <Feather name={status.key === 'andamento' ? 'clock' : status.key === 'finalizado' ? 'flag' : 'lock'} size={11} color={status.key === 'andamento' ? '#04140e' : colors.textDim} />
                    <Text style={[styles.statusBadgeText, status.key !== 'andamento' && { color: colors.textDim }]}>{status.label}</Text>
                  </View>
                  {isActive && (
                    <View style={styles.ringBadge}>
                      <Text style={styles.ringBadgeText}>{daysLeft}d</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardHeader}>
                  <View style={styles.typeBadge}>
                    <Feather name={typeMeta(c.type).icon} size={12} color={colors.accent} />
                  </View>
                  <Text style={styles.cardTitle}>{c.title}</Text>
                </View>
                <Text style={styles.cardDates}>
                  {formatDate(c.start_date)} → {formatDate(c.end_date)}
                </Text>
                {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
                <Text style={styles.ruleNote}>
                  <Feather name="info" size={10} color={colors.textFaint} /> {winnerRuleText(c.type)}
                </Text>

                {c.prize ? (
                  <View style={styles.prizeBanner}>
                    <Feather name="award" size={18} color={colors.amber} />
                    <View>
                      <Text style={styles.prizeLabel}>PRÊMIO DE QUEM VENCER</Text>
                      <Text style={styles.prizeValue}>{c.prize}</Text>
                    </View>
                  </View>
                ) : null}
                {(c.winner_id || c.winner_2nd_id || c.winner_3rd_id) && (
                  <View style={{ marginBottom: vs(8), gap: 3 }}>
                    {c.winner_id && list.find((s) => s.id === c.winner_id) && (
                      <Text style={styles.winnerText}>🥇 {list.find((s) => s.id === c.winner_id).name}</Text>
                    )}
                    {c.winner_2nd_id && list.find((s) => s.id === c.winner_2nd_id) && (
                      <Text style={styles.winnerText}>🥈 {list.find((s) => s.id === c.winner_2nd_id).name}</Text>
                    )}
                    {c.winner_3rd_id && list.find((s) => s.id === c.winner_3rd_id) && (
                      <Text style={styles.winnerText}>🥉 {list.find((s) => s.id === c.winner_3rd_id).name}</Text>
                    )}
                  </View>
                )}

                {isActive && (
                  <View style={styles.inputArea}>
                    {/* TEXTO: campo de texto livre + botão enviar */}
                    {c.type === 'TEXTO' && (
                      <>
                        {c.config?.question ? <Text style={styles.questionText}>{c.config.question}</Text> : null}
                        <TextInput
                          style={[styles.textInput, { height: 70 }]}
                          multiline
                          value={drafts[c.id] || ''}
                          onChangeText={(v) => setDraft(c.id, v)}
                          placeholder="Digite sua resposta..."
                          placeholderTextColor={colors.textDim2}
                        />
                      </>
                    )}

                    {/* NUMERICO: campo numérico + unidade */}
                    {c.type === 'NUMERICO' && (
                      <>
                        {c.config?.label ? <Text style={styles.questionText}>{c.config.label}</Text> : null}
                        <View style={styles.numericRow}>
                          <TextInput
                            style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                            value={drafts[c.id] || ''}
                            onChangeText={(v) => setDraft(c.id, v)}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor={colors.textDim2}
                          />
                          {c.config?.unit ? <Text style={styles.unitText}>{c.config.unit}</Text> : null}
                        </View>
                      </>
                    )}

                    <TouchableOpacity
                      style={[styles.proofButton, (c.type === 'FOTO' || c.type === 'VIDEO') && submittedToday[c.id] && styles.proofButtonDone]}
                      onPress={() => {
                        if (c.type === 'TEXTO') sendTextAnswer(c);
                        else if (c.type === 'NUMERICO') sendNumericAnswer(c);
                        else sendMediaProof(c); // FOTO ou VIDEO
                      }}
                      disabled={sending === c.id || ((c.type === 'FOTO' || c.type === 'VIDEO') && submittedToday[c.id])}
                    >
                      {sending === c.id ? (
                        <ActivityIndicator color="#04170F" size="small" />
                      ) : (c.type === 'FOTO' || c.type === 'VIDEO') && submittedToday[c.id] ? (
                        <>
                          <Feather name="check-circle" size={16} color={colors.textDim} />
                          <Text style={styles.proofButtonDoneText}> Prova de hoje enviada — volte amanhã</Text>
                        </>
                      ) : (
                        <>
                          <Feather name={typeMeta(c.type).icon} size={16} color="#04170F" />
                          <Text style={styles.proofButtonText}> {typeMeta(c.type).actionLabel}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {myPosition >= 0 && (
                  <Text style={styles.myPosition}>
                    Você está em {myPosition + 1}º lugar, com {list[myPosition].count} envio
                    {list[myPosition].count === 1 ? '' : 's'}
                  </Text>
                )}

                <Text style={styles.rankingTitle}>Ranking</Text>

                {list.length === 0 && (
                  <View style={styles.podiumEmpty}>
                    <View style={styles.podiumCol}>
                      <View style={styles.podiumAvatarEmpty} />
                      <View style={[styles.podiumBar, { height: 40 }]}>
                        <Text style={styles.podiumMedal}>2º</Text>
                      </View>
                    </View>
                    <View style={styles.podiumCol}>
                      <View style={styles.podiumAvatarEmpty} />
                      <View style={[styles.podiumBar, styles.podiumBarGold, { height: 58 }]}>
                        <Text style={styles.podiumMedal}>1º</Text>
                      </View>
                    </View>
                    <View style={styles.podiumCol}>
                      <View style={styles.podiumAvatarEmpty} />
                      <View style={[styles.podiumBar, { height: 28 }]}>
                        <Text style={styles.podiumMedal}>3º</Text>
                      </View>
                    </View>
                  </View>
                )}
                {list.length === 0 && (
                  <Text style={styles.emptySmall}>Ninguém enviou prova ainda — seja o primeiro e abra o ranking.</Text>
                )}

                {top3.length > 0 && (
                  <View style={styles.podium}>
                    {podiumOrder.map((s, idx) => {
                      if (!s) return <View key={`empty-${idx}`} style={styles.podiumCol} />;
                      const place = idx === 1 ? 1 : idx === 0 ? 2 : 3;
                      const height = place === 1 ? 58 : place === 2 ? 40 : 28;
                      return (
                        <View key={s.id} style={styles.podiumCol}>
                          <Avatar uri={s.avatar_url} size={36} />
                          <Text style={styles.podiumName} numberOfLines={1}>{s.name}</Text>
                          <View style={[styles.podiumBar, place === 1 && styles.podiumBarGold, { height }]}>
                            <Text style={styles.podiumMedal}>{place}º</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {rest.map((s, i) => (
                  <View key={s.id} style={[styles.rankRow, s.id === session.user.id && styles.rankRowMe]}>
                    <Text style={styles.rankPosition}>{i + 4}º</Text>
                    <Avatar uri={s.avatar_url} size={28} />
                    <Text style={styles.rankName}>{s.name}</Text>
                    <Text style={styles.rankCount}>{s.count} {typeMeta(c.type).unit}</Text>
                  </View>
                ))}
              </View>
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
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: vs(10), position: 'relative' },
  howStepLine: { position: 'absolute', left: 9, top: 20, width: 2, height: '100%', backgroundColor: colors.border },
  howBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(1),
    zIndex: 1,
  },
  howBulletText: { color: colors.accent, fontSize: fs(9), fontWeight: '800' },
  howStepText: { color: colors.textDim, fontSize: fs(10.5), flex: 1, lineHeight: 18 },
  emptySmall: { color: colors.textDim, fontSize: fs(10), marginBottom: vs(6), textAlign: 'center' },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: vs(12), overflow: 'hidden' },
  filmStrip: { height: 8, backgroundColor: colors.surface2, opacity: 0.6 },
  cardBodyInner: { padding: 16 },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(10) },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, paddingHorizontal: s(10), paddingVertical: vs(5), borderRadius: radius.pill },
  statusBadgeMuted: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  statusBadgeText: { color: '#04140e', fontSize: fs(9.5), fontWeight: '700', textTransform: 'capitalize' },
  ringBadge: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  ringBadgeText: { color: colors.text, fontSize: fs(9), fontWeight: '700' },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentGlow, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: fs(15), fontWeight: '800', flex: 1 },
  cardDates: { color: colors.textFaint, fontSize: fs(10), marginTop: vs(4) },
  desc: { color: colors.textDim, fontSize: fs(10.5), marginTop: vs(8), lineHeight: 18 },
  ruleNote: { color: colors.textFaint, fontSize: fs(9.5), marginTop: vs(6), lineHeight: 15 },

  prizeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.amberGlow, borderWidth: 1, borderColor: 'rgba(255,182,72,0.3)', borderRadius: radius.md, padding: 11, marginTop: vs(12) },
  prizeLabel: { color: colors.amber, fontSize: fs(9), fontWeight: '700', letterSpacing: 0.4 },
  prizeValue: { color: colors.text, fontSize: fs(12.5), fontWeight: '700' },
  winnerText: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700', marginTop: vs(8) },

  inputArea: { marginTop: vs(12) },
  questionText: { color: colors.text, fontSize: fs(11.5), fontWeight: '600', marginBottom: vs(8) },
  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: s(12),
    paddingVertical: vs(10),
    color: colors.text,
    fontSize: fs(12),
    marginBottom: vs(4),
  },
  numericRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitText: { color: colors.textDim, fontSize: fs(11), fontWeight: '600' },
  proofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: vs(12),
    marginTop: vs(8),
  },
  proofButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(11.5) },
  proofButtonDone: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  proofButtonDoneText: { color: colors.textDim, fontWeight: '700', fontSize: fs(11) },
  myPosition: { color: colors.text, fontSize: fs(11), fontWeight: '600', marginTop: vs(10), backgroundColor: colors.accentGlow, padding: 10, borderRadius: radius.sm },
  rankingTitle: { color: colors.textDim, fontSize: fs(9.5), fontWeight: '700', marginTop: vs(16), marginBottom: vs(10), textTransform: 'uppercase' },

  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: vs(14) },
  podiumEmpty: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginBottom: vs(8) },
  podiumCol: { alignItems: 'center', width: 72 },
  podiumAvatarEmpty: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, marginBottom: vs(6) },
  podiumName: { color: colors.textDim, fontSize: fs(9.5), fontWeight: '600', marginTop: vs(4), marginBottom: vs(6), maxWidth: 70 },
  podiumBar: { width: '100%', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, alignItems: 'center', justifyContent: 'flex-start', paddingTop: vs(6) },
  podiumBarGold: { backgroundColor: colors.amberGlow, borderColor: 'rgba(255,182,72,0.35)' },
  podiumMedal: { color: colors.textDim, fontSize: fs(11), fontWeight: '800' },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: vs(7) },
  rankRowMe: { backgroundColor: colors.accentGlow, borderRadius: radius.sm, paddingHorizontal: s(6) },
  rankPosition: { color: colors.textDim2, fontSize: fs(11), fontWeight: '700', width: 22 },
  rankName: { color: colors.text, fontSize: fs(11), flex: 1 },
  rankCount: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700' },
});
