import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / MS);
}

// ------------------------------------------------------------
// Tipos de desafio suportados. Pra adicionar um tipo novo:
//   1. adiciona aqui (icon/label/description)
//   2. adiciona os campos de config específicos no modal de criação
//   3. adiciona a leitura desse campo no StudentChallengeScreen
// ------------------------------------------------------------
export const CHALLENGE_TYPES = [
  {
    value: 'FOTO',
    label: 'Foto',
    icon: 'camera',
    description: 'Aluno tira uma foto pelo app como prova.',
    proofLabel: 'fotos enviadas como prova',
  },
  {
    value: 'VIDEO',
    label: 'Vídeo',
    icon: 'video',
    description: 'Aluno grava/envia um vídeo curto como prova.',
    proofLabel: 'vídeos enviados como prova',
  },
  {
    value: 'TEXTO',
    label: 'Texto / Quiz',
    icon: 'edit-3',
    description: 'Aluno responde uma pergunta escrita.',
    proofLabel: 'respostas enviadas',
  },
  {
    value: 'NUMERICO',
    label: 'Numérico',
    icon: 'hash',
    description: 'Aluno registra um valor (carga, km, repetições...).',
    proofLabel: 'registros enviados',
  },
];

function getTypeInfo(type) {
  return CHALLENGE_TYPES.find((t) => t.value === type) || CHALLENGE_TYPES[0];
}

// Status calculado do desafio: finalizado manualmente, encerrado pelo prazo, ou em andamento.
function getStatus(c) {
  if (c.finished_at) return { key: 'finalizado', label: 'finalizado', color: colors.textDim2 };
  if (todayISO() > c.end_date) return { key: 'encerrado', label: 'encerrado', color: colors.amber };
  if (todayISO() < c.start_date) return { key: 'agendado', label: 'agendado', color: colors.blue };
  return { key: 'andamento', label: 'em andamento', color: colors.accent };
}

// Explica pro personal como decidir o vencedor, de acordo com o tipo do desafio.
function winnerRuleText(type) {
  if (type === 'FOTO' || type === 'VIDEO') return 'Vale 1 envio por dia. Vence quem tiver mais pontos — mas você também pode marcar outro nome manualmente.';
  if (type === 'TEXTO') return 'Leia as respostas abaixo e escolha o vencedor pelo conteúdo — não precisa ser só a posição do ranking.';
  if (type === 'NUMERICO') return 'Veja os valores enviados e escolha o vencedor pela quantidade e pela posição no ranking.';
  return '';
}

export default function ChallengesScreen({ navigation }) {
  const { session } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [menuId, setMenuId] = useState(null);
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

  // Tipo do desafio + campos de config específicos de cada tipo
  const [type, setType] = useState('FOTO');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [question, setQuestion] = useState(''); // TEXTO
  const [numericLabel, setNumericLabel] = useState(''); // NUMERICO
  const [numericUnit, setNumericUnit] = useState(''); // NUMERICO
  const [maxDurationSeconds, setMaxDurationSeconds] = useState('30'); // VIDEO

  // Calendário único, reaproveitado tanto pra "Início" quanto "Fim"
  const [datePickerFor, setDatePickerFor] = useState(null); // 'start' | 'end' | null
  const [tempPickerDate, setTempPickerDate] = useState(new Date());

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

    // Consulta enxuta (mesmos campos que a tela do aluno usa) — assim o ranking
    // não depende da coluna storage_path, que pode não existir/estar preenchida
    // em todo desafio e fazia a consulta inteira falhar silenciosamente.
    const { data: subs, error } = await supabase
      .from('challenge_submissions')
      .select('id, student_id, created_at, text_response, numeric_response, numeric_unit, profiles:student_id(id, name, avatar_url)')
      .eq('challenge_id', challenge.id)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadingRanking(null);
      Alert.alert('Erro ao carregar ranking', error.message);
      return;
    }

    const counts = {};
    const info = {};
    const submissionsByStudent = {};
    (subs || []).forEach((s) => {
      counts[s.student_id] = (counts[s.student_id] || 0) + 1;
      if (s.profiles) info[s.student_id] = s.profiles;
      submissionsByStudent[s.student_id] = submissionsByStudent[s.student_id] || [];
      submissionsByStudent[s.student_id].push(s);
    });

    const list = Object.keys(counts)
      .map((id) => ({
        id,
        name: info[id]?.name || 'Aluno',
        avatar_url: info[id]?.avatar_url,
        count: counts[id],
        submissions: submissionsByStudent[id],
      }))
      .sort((a, b) => b.count - a.count);

    setRanking((prev) => ({ ...prev, [challenge.id]: list }));
    setLoadingRanking(null);
  };

  // Busca as fotos de um aluno específico num desafio (só quando o personal
  // realmente abre a galeria — mantém o ranking rápido e independente disso).
  const [loadingPhotosFor, setLoadingPhotosFor] = useState(null);
  const openStudentPhotos = async (challenge, student) => {
    setLoadingPhotosFor(student.id);
    const { data, error } = await supabase
      .from('challenge_submissions')
      .select('id, storage_path, created_at')
      .eq('challenge_id', challenge.id)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    setLoadingPhotosFor(null);
    if (error) {
      Alert.alert('Erro ao carregar fotos', error.message);
      return;
    }
    setViewingPhotos({ challenge, student: { ...student, photos: (data || []).filter((p) => p.storage_path) } });
  };

  // Modal genérico de "ver provas" de um aluno — mostra fotos (grade) ou
  // respostas de texto/número (lista), dependendo do tipo do desafio.
  const [viewingSubmissions, setViewingSubmissions] = useState(null); // { challenge, student }
  const openStudentSubmissions = (challenge, student) => {
    if (challenge.type === 'FOTO' || challenge.type === 'VIDEO') {
      openStudentPhotos(challenge, student);
    } else {
      setViewingSubmissions({ challenge, student });
    }
  };

  const toggleExpand = (challenge) => {
    const next = expandedId === challenge.id ? null : challenge.id;
    setExpandedId(next);
    if (next) loadRanking(challenge);
  };

  // Apaga qualquer prova (foto, vídeo, resposta de texto ou número) de um aluno.
  // Se tiver storage_path (foto/vídeo), remove o arquivo do Storage também.
  const deleteSubmission = async (challengeId, submission, student) => {
    Alert.alert('Apagar envio', 'Isso remove o ponto desse envio do ranking. Confirma?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          setDeletingPhoto(submission.id);
          if (submission.storage_path) {
            await supabase.storage.from('challenge-photos').remove([submission.storage_path]);
          }
          const { error } = await supabase.from('challenge_submissions').delete().eq('id', submission.id);
          setDeletingPhoto(null);
          if (error) {
            Alert.alert('Erro', error.message);
            return;
          }
          setViewingPhotos(null);
          if (viewingSubmissions) {
            // atualiza a lista aberta no modal, removendo o item apagado
            setViewingSubmissions((prev) =>
              prev
                ? { ...prev, student: { ...prev.student, submissions: prev.student.submissions.filter((s) => s.id !== submission.id) } }
                : prev
            );
          }
          const c = challenges.find((ch) => ch.id === challengeId);
          if (c) loadRanking(c, true);
        },
      },
    ]);
  };

  // Encerra o desafio antes (ou depois) do prazo, sem apagar nada — só marca finished_at.
  const finalizeChallenge = (challenge) => {
    setMenuId(null);
    Alert.alert(
      'Finalizar desafio',
      `Isso encerra "${challenge.title}" agora. Os alunos não poderão mais enviar provas, mas o ranking continua visível. Confirma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            const { error } = await supabase.from('challenges').update({ finished_at: new Date().toISOString() }).eq('id', challenge.id);
            if (error) {
              Alert.alert('Erro', error.message);
              return;
            }
            load();
          },
        },
      ]
    );
  };

  // Apaga o desafio inteiro (e, em cascata, as provas enviadas).
  const deleteChallenge = (challenge) => {
    setMenuId(null);
    Alert.alert(
      'Apagar desafio',
      `Isso apaga "${challenge.title}" e todas as provas enviadas nele, pra sempre. Essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('challenges').delete().eq('id', challenge.id);
            if (error) {
              Alert.alert('Erro', error.message);
              return;
            }
            if (expandedId === challenge.id) setExpandedId(null);
            load();
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrize('');
    setStartDate(todayISO());
    setEndDate('');
    setType('FOTO');
    setQuestion('');
    setNumericLabel('');
    setNumericUnit('');
    setMaxDurationSeconds('30');
  };

  // Monta o JSON de config de acordo com o tipo escolhido.
  function buildConfig() {
    switch (type) {
      case 'TEXTO':
        return { question: question.trim() };
      case 'NUMERICO':
        return { label: numericLabel.trim(), unit: numericUnit.trim() || null };
      case 'VIDEO':
        return { max_duration_seconds: Number(maxDurationSeconds) || 30 };
      default:
        return {};
    }
  }

  const handleCreate = async () => {
    if (!title.trim() || !endDate.trim()) {
      Alert.alert('Faltou algo', 'Preenche pelo menos o título e a data final.');
      return;
    }
    if (type === 'TEXTO' && !question.trim()) {
      Alert.alert('Faltou algo', 'Escreve a pergunta que o aluno vai responder.');
      return;
    }
    if (type === 'NUMERICO' && !numericLabel.trim()) {
      Alert.alert('Faltou algo', 'Escreve o que o aluno vai registrar (ex: "Carga no supino").');
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
      type,
      config: buildConfig(),
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

  // Abre um menu pra escolher em qual posição do pódio (1º, 2º ou 3º) o aluno entra.
  const [podiumMenuFor, setPodiumMenuFor] = useState(null); // { challenge, student }

  const PODIUM_FIELDS = {
    1: { field: 'winner_id', label: '1º lugar', medal: '🥇' },
    2: { field: 'winner_2nd_id', label: '2º lugar', medal: '🥈' },
    3: { field: 'winner_3rd_id', label: '3º lugar', medal: '🥉' },
  };

  const setPodium = async (challenge, student, position) => {
    setPodiumMenuFor(null);
    const { field, label, medal } = PODIUM_FIELDS[position];
    Alert.alert(`Definir ${label}`, `Marcar ${student.name} como ${medal} ${label} de "${challenge.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          // Evita duplicar o mesmo aluno em duas posições do pódio de uma vez.
          const patch = { [field]: student.id };
          Object.entries(PODIUM_FIELDS).forEach(([pos, info]) => {
            if (Number(pos) !== position && challenge[info.field] === student.id) {
              patch[info.field] = null;
            }
          });
          const { error } = await supabase.from('challenges').update(patch).eq('id', challenge.id);
          if (error) {
            Alert.alert('Erro', error.message);
            return;
          }
          load();
        },
      },
    ]);
  };

  const clearPodiumPosition = async (challenge, position) => {
    setPodiumMenuFor(null);
    const { field } = PODIUM_FIELDS[position];
    const { error } = await supabase.from('challenges').update({ [field]: null }).eq('id', challenge.id);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    load();
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
        Escolha o tipo — foto, vídeo, texto ou número —, defina a regra e o prazo. Cada envio vale 1 ponto no
        ranking, e você escolhe quem leva o prêmio no fim (ou finaliza o desafio quando quiser).
      </Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} onScrollBeginDrag={() => setMenuId(null)}>
        {challenges.length === 0 && (
          <Text style={styles.empty}>
            Nenhum desafio criado ainda. Crie um desafio pra motivar seus alunos — o ranking é calculado
            automaticamente pela quantidade de provas enviadas no período.
          </Text>
        )}

        {challenges.map((c) => {
          const isOpen = expandedId === c.id;
          const isMenuOpen = menuId === c.id;
          const list = ranking[c.id] || [];
          const winner = list.find((s) => s.id === c.winner_id);
          const status = getStatus(c);
          const typeInfo = getTypeInfo(c.type);
          const totalDays = Math.max(1, daysBetween(c.start_date, c.end_date));
          const daysLeft = Math.max(0, daysBetween(todayISO(), c.end_date));
          const totalProofs = list.reduce((sum, s) => sum + s.count, 0);

          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.filmStrip} />
              <View style={styles.cardBody}>
                <TouchableOpacity onPress={() => toggleExpand(c)}>
                  <View style={styles.cardTop}>
                    <View style={styles.chip}>
                      <Feather name={typeInfo.icon} size={12} color={colors.accent} />
                      <Text style={styles.chipText}>{typeInfo.label}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{c.title}</Text>
                  <Text style={styles.cardDates}>
                    {formatDate(c.start_date)} → {formatDate(c.end_date)}
                  </Text>
                </TouchableOpacity>

                <View style={styles.statRow}>
                  <View style={styles.ringBadge}>
                    <Text style={styles.ringBadgeText}>{status.key === 'andamento' ? `${daysLeft}d` : '—'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statTitle}>{totalDays} dias de desafio</Text>
                    <Text style={styles.statSub}>
                      {status.key === 'andamento'
                        ? `faltam ${daysLeft} dia${daysLeft === 1 ? '' : 's'} para o fim`
                        : status.key === 'agendado'
                        ? 'ainda não começou'
                        : 'prazo encerrado'}
                    </Text>
                  </View>
                  <View style={styles.statNums}>
                    <View style={styles.statNum}>
                      <Text style={styles.statNumB}>{totalProofs}</Text>
                      <Text style={styles.statNumSpan}>provas</Text>
                    </View>
                    <View style={styles.statNum}>
                      <Text style={styles.statNumB}>{list.length}</Text>
                      <Text style={styles.statNumSpan}>alunos</Text>
                    </View>
                  </View>
                </View>

                {c.prize ? (
                  <View style={styles.prizeBanner}>
                    <Feather name="award" size={18} color={colors.amber} />
                    <View>
                      <Text style={styles.prizeLabel}>PREMIAÇÃO</Text>
                      <Text style={styles.prizeValue}>{c.prize}</Text>
                    </View>
                  </View>
                ) : null}

                {(c.winner_id || c.winner_2nd_id || c.winner_3rd_id) && (
                  <View style={styles.podiumBox}>
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
                {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => toggleExpand(c)}>
                    <Feather name={isOpen ? 'chevron-up' : 'bar-chart-2'} size={14} color={colors.text} />
                    <Text style={styles.actionBtnText}>{isOpen ? 'Fechar ranking' : 'Ver ranking'}</Text>
                  </TouchableOpacity>

                  <View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuId(isMenuOpen ? null : c.id)}>
                      <Feather name="more-vertical" size={16} color={colors.textDim} />
                    </TouchableOpacity>
                    {isMenuOpen && (
                      <View style={styles.menuBox}>
                        {status.key !== 'finalizado' && (
                          <TouchableOpacity style={styles.menuItem} onPress={() => finalizeChallenge(c)}>
                            <Feather name="flag" size={14} color={colors.text} />
                            <Text style={styles.menuItemText}>Finalizar desafio</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.menuItem} onPress={() => deleteChallenge(c)}>
                          <Feather name="trash-2" size={14} color={colors.red} />
                          <Text style={[styles.menuItemText, { color: colors.red }]}>Apagar desafio</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {isOpen && (
                  <View style={styles.rankingBox}>
                    <Text style={styles.rankingTitle}>Ranking · {typeInfo.proofLabel}</Text>
                    <Text style={styles.ruleNote}>{winnerRuleText(c.type)}</Text>
                    {loadingRanking === c.id && <Text style={styles.empty}>Carregando...</Text>}
                    {list.map((s, i) => {
                      const medal = s.id === c.winner_id ? '🥇' : s.id === c.winner_2nd_id ? '🥈' : s.id === c.winner_3rd_id ? '🥉' : null;
                      return (
                        <View key={s.id} style={styles.rankRow}>
                          <Text style={styles.rankPosition}>{i + 1}º</Text>
                          <Avatar uri={s.avatar_url} size={30} />
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPodiumMenuFor({ challenge: c, student: s })}>
                            <Text style={styles.rankName}>
                              {medal ? `${medal} ` : ''}
                              {s.name}
                            </Text>
                          </TouchableOpacity>
                          <Text style={styles.rankCount}>
                            {s.count} {typeInfo.icon === 'camera' ? '📸' : typeInfo.icon === 'video' ? '🎬' : typeInfo.icon === 'edit-3' ? '📝' : '🔢'}
                          </Text>
                          <TouchableOpacity onPress={() => openStudentSubmissions(c, s)} disabled={loadingPhotosFor === s.id}>
                            <Feather name={c.type === 'FOTO' || c.type === 'VIDEO' ? 'image' : 'list'} size={16} color={colors.textDim2} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {list.length === 0 && loadingRanking !== c.id && (
                      <Text style={styles.empty}>Ninguém enviou nada nesse desafio ainda.</Text>
                    )}
                    <Text style={styles.hint}>
                      Toque no nome pra marcar 1º, 2º ou 3º lugar, ou no ícone pra ver{c.type === 'FOTO' || c.type === 'VIDEO' ? '/apagar as provas' : ' as respostas'}.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>Novo desafio</Text>

            <Text style={styles.fieldLabel}>Tipo de desafio</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShowTypeMenu((v) => !v)}>
              <Feather name={getTypeInfo(type).icon} size={14} color={colors.accent} />
              <Text style={styles.dropdownText}>{getTypeInfo(type).label}</Text>
              <Feather name={showTypeMenu ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim2} />
            </TouchableOpacity>
            {showTypeMenu && (
              <View style={styles.dropdownMenu}>
                {CHALLENGE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.dropdownItem, t.value === type && styles.dropdownItemActive]}
                    onPress={() => {
                      setType(t.value);
                      setShowTypeMenu(false);
                    }}
                  >
                    <Feather name={t.icon} size={14} color={t.value === type ? colors.accent : colors.textDim} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.dropdownItemText, t.value === type && styles.dropdownItemTextActive]}>{t.label}</Text>
                      <Text style={styles.dropdownItemDesc}>{t.description}</Text>
                    </View>
                    {t.value === type && <Feather name="check" size={14} color={colors.accent} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabel}>Título</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Desafio de Agosto" placeholderTextColor={colors.textDim2} autoFocus />

            <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline value={description} onChangeText={setDescription} placeholderTextColor={colors.textDim2} />

            {type === 'TEXTO' && (
              <>
                <Text style={styles.fieldLabel}>Pergunta que o aluno vai responder</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  multiline
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="Ex: Quantos copos de água você bebeu hoje?"
                  placeholderTextColor={colors.textDim2}
                />
              </>
            )}

            {type === 'NUMERICO' && (
              <>
                <Text style={styles.fieldLabel}>O que o aluno vai registrar</Text>
                <TextInput
                  style={styles.input}
                  value={numericLabel}
                  onChangeText={setNumericLabel}
                  placeholder="Ex: Carga no supino"
                  placeholderTextColor={colors.textDim2}
                />
                <Text style={styles.fieldLabel}>Unidade (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={numericUnit}
                  onChangeText={setNumericUnit}
                  placeholder="Ex: kg, km, reps"
                  placeholderTextColor={colors.textDim2}
                />
              </>
            )}

            {type === 'VIDEO' && (
              <>
                <Text style={styles.fieldLabel}>Duração máxima do vídeo (segundos)</Text>
                <TextInput
                  style={styles.input}
                  value={maxDurationSeconds}
                  onChangeText={setMaxDurationSeconds}
                  keyboardType="numeric"
                  placeholder="30"
                  placeholderTextColor={colors.textDim2}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Premiação (opcional)</Text>
            <TextInput style={styles.input} value={prize} onChangeText={setPrize} placeholder="Ex: Camiseta da academia" placeholderTextColor={colors.textDim2} />

            <Text style={styles.fieldLabel}>Período do desafio</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.dateInput, { flex: 1 }]}
                activeOpacity={0.7}
                onPress={() => {
                  setTempPickerDate(isoToDate(startDate));
                  setDatePickerFor('start');
                }}
              >
                <Text style={styles.dateInputLabel}>Início</Text>
                <View style={styles.dateInputRow}>
                  <Text style={[styles.dateInputValue, !startDate && styles.dateInputPlaceholder]}>
                    {isoToDisplay(startDate) || 'dd/mm/aaaa'}
                  </Text>
                  <Feather name="calendar" size={15} color={colors.textDim2} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateInput, { flex: 1 }]}
                activeOpacity={0.7}
                onPress={() => {
                  setTempPickerDate(isoToDate(endDate || startDate));
                  setDatePickerFor('end');
                }}
              >
                <Text style={styles.dateInputLabel}>Fim</Text>
                <View style={styles.dateInputRow}>
                  <Text style={[styles.dateInputValue, !endDate && styles.dateInputPlaceholder]}>
                    {isoToDisplay(endDate) || 'dd/mm/aaaa'}
                  </Text>
                  <Feather name="calendar" size={15} color={colors.textDim2} />
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleCreate} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Criando...' : 'Criar desafio'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowCreate(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Calendário único, reaproveitado tanto pra "Início" quanto "Fim" */}
      <Modal visible={!!datePickerFor} transparent animationType="fade" onRequestClose={() => setDatePickerFor(null)}>
        <TouchableOpacity style={styles.datePickerOverlay} activeOpacity={1} onPress={() => setDatePickerFor(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.datePickerCard}>
            <Text style={styles.datePickerCardTitle}>{datePickerFor === 'start' ? 'Data de início' : 'Data de fim'}</Text>
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
                      if (datePickerFor === 'start') setStartDate(dateToIso(selectedDate));
                      else setEndDate(dateToIso(selectedDate));
                    }
                    setDatePickerFor(null);
                    return;
                  }
                  // No iOS o picker "inline" só dispara onChange quando a data MUDA —
                  // por isso só guardamos o valor aqui, e confirmamos no botão abaixo.
                  if (selectedDate) setTempPickerDate(selectedDate);
                }}
              />
            )}
            {Platform.OS === 'ios' && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.saveButton, { flex: 1, backgroundColor: colors.surface2, marginTop: 0 }]}
                  onPress={() => setDatePickerFor(null)}
                >
                  <Text style={[styles.saveButtonText, { color: colors.textDim }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    if (datePickerFor === 'start') setStartDate(dateToIso(tempPickerDate));
                    else setEndDate(dateToIso(tempPickerDate));
                    setDatePickerFor(null);
                  }}
                >
                  <Text style={styles.saveButtonText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!podiumMenuFor} transparent animationType="fade" onRequestClose={() => setPodiumMenuFor(null)}>
        <TouchableOpacity style={styles.datePickerOverlay} activeOpacity={1} onPress={() => setPodiumMenuFor(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.datePickerCard}>
            <Text style={styles.datePickerCardTitle}>{podiumMenuFor?.student?.name}</Text>
            <Text style={[styles.howNote, { marginBottom: vs(10) }]}>Escolha a posição no pódio desse desafio.</Text>
            {[1, 2, 3].map((position) => {
              const { field, label, medal } = PODIUM_FIELDS[position];
              const isCurrent = podiumMenuFor && podiumMenuFor.challenge[field] === podiumMenuFor.student.id;
              return (
                <TouchableOpacity
                  key={position}
                  style={[styles.podiumOption, isCurrent && styles.podiumOptionActive]}
                  onPress={() =>
                    isCurrent
                      ? clearPodiumPosition(podiumMenuFor.challenge, position)
                      : setPodium(podiumMenuFor.challenge, podiumMenuFor.student, position)
                  }
                >
                  <Text style={styles.podiumOptionText}>
                    {medal} {label}
                  </Text>
                  {isCurrent && <Text style={styles.podiumOptionRemove}>toque pra remover</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.modalClose} onPress={() => setPodiumMenuFor(null)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
                        onPress={() => deleteSubmission(viewingPhotos.challenge.id, p, viewingPhotos.student)}
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
      <Modal visible={!!viewingSubmissions} transparent animationType="slide" onRequestClose={() => setViewingSubmissions(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {viewingSubmissions?.challenge?.type === 'TEXTO' ? 'Respostas de ' : 'Valores de '}
              {viewingSubmissions?.student?.name}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(viewingSubmissions?.student?.submissions || []).map((sub) => (
                <View key={sub.id} style={styles.submissionItem}>
                  <View style={{ flex: 1 }}>
                    {viewingSubmissions.challenge.type === 'TEXTO' ? (
                      <Text style={styles.submissionText}>{sub.text_response || '(sem texto)'}</Text>
                    ) : (
                      <Text style={styles.submissionText}>
                        {sub.numeric_response ?? '-'} {sub.numeric_unit || viewingSubmissions.challenge.config?.unit || ''}
                      </Text>
                    )}
                    <Text style={styles.submissionDate}>{new Date(sub.created_at).toLocaleString('pt-BR')}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteSubmission(viewingSubmissions.challenge.id, sub, viewingSubmissions.student)}
                    disabled={deletingPhoto === sub.id}
                  >
                    <Feather name="trash-2" size={16} color={colors.red} />
                  </TouchableOpacity>
                </View>
              ))}
              {(!viewingSubmissions?.student?.submissions || viewingSubmissions.student.submissions.length === 0) && (
                <Text style={styles.empty}>Nenhum envio encontrado.</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setViewingSubmissions(null)}>
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

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: vs(14), overflow: 'hidden' },
  filmStrip: { height: 8, backgroundColor: colors.surface2, opacity: 0.6 },
  cardBody: { padding: 16 },

  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(10) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentGlow, borderWidth: 1, borderColor: 'rgba(47,230,160,0.25)', paddingHorizontal: s(9), paddingVertical: vs(4), borderRadius: radius.pill },
  chipText: { color: colors.accent, fontSize: fs(10.5), fontWeight: '700' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: fs(10.5), fontWeight: '700' },

  cardTitle: { color: colors.text, fontSize: fs(16), fontWeight: '800', marginBottom: vs(3) },
  cardDates: { color: colors.textFaint, fontSize: fs(10.5), marginBottom: vs(12) },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: vs(12) },
  ringBadge: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  ringBadgeText: { color: colors.text, fontSize: fs(10), fontWeight: '700' },
  statTitle: { color: colors.text, fontSize: fs(11.5), fontWeight: '700' },
  statSub: { color: colors.textFaint, fontSize: fs(10), marginTop: vs(2) },
  statNums: { flexDirection: 'row', gap: 14 },
  statNum: { alignItems: 'center' },
  statNumB: { color: colors.text, fontSize: fs(14), fontWeight: '800' },
  statNumSpan: { color: colors.textFaint, fontSize: fs(8.5), textTransform: 'uppercase' },

  prizeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.amberGlow, borderWidth: 1, borderColor: 'rgba(255,182,72,0.3)', borderRadius: radius.md, padding: 11, marginBottom: vs(12) },
  prizeLabel: { color: colors.amber, fontSize: fs(9), fontWeight: '700', letterSpacing: 0.4 },
  prizeValue: { color: colors.text, fontSize: fs(12.5), fontWeight: '700' },

  podiumBox: { marginBottom: vs(10), gap: 3 },
  winnerText: { color: colors.accent, fontSize: fs(11), fontWeight: '700' },
  podiumOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: s(14),
    paddingVertical: vs(12),
    marginBottom: vs(8),
  },
  podiumOptionActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  podiumOptionText: { color: colors.text, fontSize: fs(12.5), fontWeight: '700' },
  podiumOptionRemove: { color: colors.textFaint, fontSize: fs(9.5) },
  desc: { color: colors.textDim, fontSize: fs(10.5), marginBottom: vs(12), lineHeight: 18 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: vs(4) },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: s(12), paddingVertical: vs(8) },
  actionBtnText: { color: colors.text, fontSize: fs(10.5), fontWeight: '700' },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  menuBox: { position: 'absolute', right: 0, top: 38, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden', minWidth: 170, zIndex: 20, elevation: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: s(12), paddingVertical: vs(11), borderBottomWidth: 1, borderBottomColor: colors.border },
  menuItemText: { color: colors.text, fontSize: fs(11.5), fontWeight: '600' },

  rankingBox: { marginTop: vs(14), borderTopWidth: 1, borderTopColor: colors.border, paddingTop: vs(12) },
  rankingTitle: { color: colors.textDim, fontSize: fs(9.5), fontWeight: '700', marginBottom: vs(4), textTransform: 'uppercase' },
  ruleNote: { color: colors.textFaint, fontSize: fs(9.5), lineHeight: 15, marginBottom: vs(10) },
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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: s(12),
    paddingVertical: vs(11),
    marginBottom: vs(4),
  },
  dropdownText: { flex: 1, color: colors.text, fontSize: fs(12), fontWeight: '600' },
  dropdownMenu: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginTop: vs(6),
    marginBottom: vs(10),
    overflow: 'hidden',
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12), paddingVertical: vs(10), borderTopWidth: 1, borderTopColor: colors.border },
  dropdownItemActive: { backgroundColor: colors.accentGlow },
  dropdownItemText: { color: colors.text, fontSize: fs(11.5), fontWeight: '600' },
  dropdownItemTextActive: { color: colors.accent },
  dropdownItemDesc: { color: colors.textDim2, fontSize: fs(9.5), marginTop: vs(2) },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: vs(13), alignItems: 'center', marginTop: vs(16) },
  saveButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(12) },
  dateInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
  },
  dateInputLabel: { color: colors.textDim2, fontSize: fs(9), marginBottom: vs(4) },
  dateInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateInputValue: { color: colors.text, fontSize: fs(12), fontWeight: '600' },
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
  datePickerCardTitle: { color: colors.text, fontSize: fs(13), fontWeight: '700', marginBottom: vs(4) },
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
  submissionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: vs(10), borderBottomWidth: 1, borderBottomColor: colors.border },
  submissionText: { color: colors.text, fontSize: fs(12), lineHeight: 18 },
  submissionDate: { color: colors.textFaint, fontSize: fs(9), marginTop: vs(4) },
});
