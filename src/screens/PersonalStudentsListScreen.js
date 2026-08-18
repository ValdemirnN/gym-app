import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Linking, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

const STATUS_LABEL = {
  aprovado: { text: 'Ativo', color: colors.accent, glow: colors.accentGlow },
  pendente: { text: 'Pendente', color: colors.amber, glow: colors.amberGlow },
  recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
};

// "Ativo" pra essa tela = aprovado, não excluído, sem bloqueio/expiração.
// Tudo que não é excluído nem esse "ativo perfeito" cai em "Inativos"
// (pendente, recusado, bloqueado ou com acesso expirado).
function getTab(item) {
  if (item.is_excluded) return 'excluidos';
  const okAccess = !item.access_blocked && (!item.access_expires_at || new Date(item.access_expires_at) >= new Date());
  if (item.status === 'aprovado' && okAccess) return 'ativos';
  return 'inativos';
}

function openWhatsApp(whatsapp, name) {
  if (!whatsapp) {
    Alert.alert('Sem WhatsApp cadastrado', 'Esse aluno não tem número de WhatsApp cadastrado.');
    return;
  }
  const digits = whatsapp.replace(/\D/g, '');
  const phone = digits.length <= 11 ? '55' + digits : digits; // assume BR se vier sem DDI
  const msg = encodeURIComponent(`Oi ${name ? name.split(' ')[0] : ''}! `);
  Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
    Alert.alert('Erro', 'Não consegui abrir o WhatsApp.');
  });
}

export default function PersonalStudentsListScreen({ navigation }) {
  const { session } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('ativos');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select(
        'id, name, email, whatsapp, status, created_at, access_expires_at, access_blocked, avatar_url, is_excluded'
      )
      .eq('personal_id', session.user.id)
      .order('name');
    setStudents(data || []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const getBadge = (item) => {
    if (item.status !== 'aprovado') return STATUS_LABEL[item.status] || STATUS_LABEL.pendente;
    if (item.access_blocked) return { text: 'Bloqueado', color: colors.red, glow: colors.redGlow };
    if (item.access_expires_at && new Date(item.access_expires_at) < new Date()) {
      return { text: 'Expirado', color: colors.red, glow: colors.redGlow };
    }
    return { text: 'Ativo', color: colors.accent, glow: colors.accentGlow };
  };

  const counts = students.reduce(
    (acc, s) => {
      acc[getTab(s)] += 1;
      return acc;
    },
    { ativos: 0, inativos: 0, excluidos: 0 }
  );

  const filtered = students
    .filter((s) => getTab(s) === tab)
    .filter((s) => (s.name || '').toLowerCase().includes(search.toLowerCase()));

  const toggleExcluded = async (item) => {
    const willExclude = !item.is_excluded;
    Alert.alert(
      willExclude ? 'Excluir aluno' : 'Reativar aluno',
      willExclude
        ? `${item.name} vai sair da sua lista de ativos, mas o cadastro fica guardado — você pode reativar quando quiser.`
        : `${item.name} volta pra sua lista normal.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: willExclude ? 'Excluir' : 'Reativar',
          style: willExclude ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase
              .from('profiles')
              .update({ is_excluded: willExclude, excluded_at: willExclude ? new Date().toISOString() : null })
              .eq('id', item.id);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meus Alunos</Text>

      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.textDim2} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Buscar aluno..."
          placeholderTextColor={colors.textDim2}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'ativos' && styles.tabActive]} onPress={() => setTab('ativos')}>
          <Text style={[styles.tabText, tab === 'ativos' && styles.tabTextActive]}>Ativos: {counts.ativos}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'inativos' && styles.tabActive]} onPress={() => setTab('inativos')}>
          <Text style={[styles.tabText, tab === 'inativos' && styles.tabTextActive]}>Inativos: {counts.inativos}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'excluidos' && styles.tabActive]}
          onPress={() => setTab('excluidos')}
        >
          <Text style={[styles.tabText, tab === 'excluidos' && styles.tabTextActive]}>Excluídos: {counts.excluidos}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'ativos'
              ? 'Nenhum aluno ativo por aqui ainda.'
              : tab === 'inativos'
              ? 'Nenhum aluno inativo no momento.'
              : 'Nenhum aluno excluído.'}
          </Text>
        }
        renderItem={({ item }) => {
          const status = getBadge(item);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('StudentDetail', { studentId: item.id, studentName: item.name })}
            >
              <Avatar uri={item.avatar_url} size={s(42)} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name || 'Aluno sem nome'}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>{item.email}</Text>
              </View>
              {!item.is_excluded && (
                <View style={[styles.badge, { backgroundColor: status.glow }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
                </View>
              )}
              {tab !== 'excluidos' && (
                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    openWhatsApp(item.whatsapp, item.name);
                  }}
                >
                  <Feather name="message-circle" size={18} color="#25D366" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.excludeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleExcluded(item);
                }}
              >
                <Feather name={item.is_excluded ? 'rotate-ccw' : 'trash-2'} size={16} color={colors.textDim2} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, marginBottom: vs(16) },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: s(14),
    marginBottom: vs(12),
  },
  search: { flex: 1, color: colors.text, paddingVertical: vs(12), fontSize: fs(13) },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: vs(16) },
  tab: {
    paddingHorizontal: s(12),
    paddingVertical: vs(7),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  tabText: { color: colors.textDim, fontSize: fs(10.5), fontWeight: '600' },
  tabTextActive: { color: colors.accent },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(40), fontSize: fs(12), lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: s(14),
    paddingVertical: vs(12),
    marginBottom: vs(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  // Bloco de texto: flex:1 + minWidth:0 garante truncamento correto do email
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: { color: colors.text, fontSize: fs(12), fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: fs(10), marginTop: vs(2) },
  badge: { paddingHorizontal: s(10), paddingVertical: vs(4), borderRadius: radius.pill, flexShrink: 0 },
  badgeText: { fontSize: fs(9), fontWeight: '700' },
  whatsappButton: { padding: s(6), flexShrink: 0 },
  excludeButton: { padding: s(6), flexShrink: 0 },
});
