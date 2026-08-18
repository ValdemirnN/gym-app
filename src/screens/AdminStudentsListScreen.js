import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

// ─── helpers ─────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function accessStatus(profile) {
  if (!profile.access_expires_at && !profile.access_blocked) return { label: 'Sem acesso', color: colors.textDim, bg: colors.surface2 };
  if (profile.access_blocked) return { label: 'Bloqueado', color: colors.red, bg: colors.redGlow };
  const expired = new Date(profile.access_expires_at) < new Date();
  if (expired) return { label: 'Expirado', color: colors.amber, bg: colors.amberGlow };
  return { label: 'Ativo', color: colors.accent, bg: colors.accentGlow };
}

const ACCESS_FILTERS = ['todos', 'ativo', 'bloqueado', 'expirado', 'sem_acesso'];
const ACCESS_FILTER_LABELS = { todos: 'Todos', ativo: 'Ativos', bloqueado: 'Bloqueados', expirado: 'Expirados', sem_acesso: 'Sem acesso' };

// ─── badge ───────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── modal de detalhe ────────────────────────────────────────
function StudentModal({ visible, student, personalName, onClose }) {
  if (!student) return null;
  const acc = accessStatus(student);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <View style={styles.modalHeader}>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarLgLetter}>{(student.name || '?')[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.modalName}>{student.name || 'Sem nome'}</Text>
              <Text style={styles.modalEmail}>{student.email}</Text>
            </View>
            <Badge label={acc.label} color={acc.color} bg={acc.bg} />
          </View>

          <View style={styles.modalDivider} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Row icon="user" label="Personal" value={personalName || '—'} />
            <Row icon="calendar" label="Cadastro" value={fmtDate(student.created_at)} />
            <Row icon="clock" label="Acesso expira" value={fmtDate(student.access_expires_at)} />
            <Row icon="phone" label="WhatsApp" value={student.whatsapp} />
            {student.age ? <Row icon="info" label="Idade" value={`${student.age} anos`} /> : null}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function Row({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Feather name={icon} size={13} color={colors.textDim} style={{ marginTop: 1 }} />
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── screen principal ─────────────────────────────────────────
export default function AdminStudentsListScreen() {
  const [students, setStudents] = useState([]);
  const [personalsMap, setPersonalsMap] = useState({});
  const [filtered, setFiltered] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [studentsRes, personalsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, status, whatsapp, age, personal_id, access_expires_at, access_blocked, created_at, approved_at')
        .eq('role', 'cliente')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'personal'),
    ]);

    const map = {};
    (personalsRes.data || []).forEach(p => { map[p.id] = p.name; });
    setPersonalsMap(map);

    const list = studentsRes.data || [];
    setStudents(list);
    applyFilters(list, filter, search);
    setLoading(false);
  }, []);

  const getAccessKey = (s) => {
    if (!s.access_expires_at && !s.access_blocked) return 'sem_acesso';
    if (s.access_blocked) return 'bloqueado';
    if (new Date(s.access_expires_at) < new Date()) return 'expirado';
    return 'ativo';
  };

  const applyFilters = (list, tab, q) => {
    let result = tab === 'todos' ? list : list.filter(s => getAccessKey(s) === tab);
    if (q.trim()) {
      const q2 = q.toLowerCase();
      result = result.filter(s =>
        (s.name || '').toLowerCase().includes(q2) ||
        (s.email || '').toLowerCase().includes(q2)
      );
    }
    setFiltered(result);
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleFilterTab = (tab) => {
    setFilter(tab);
    applyFilters(students, tab, search);
  };

  const handleSearch = (q) => {
    setSearch(q);
    applyFilters(students, filter, q);
  };

  const counts = ACCESS_FILTERS.reduce((acc, tab) => {
    acc[tab] = tab === 'todos' ? students.length : students.filter(s => getAccessKey(s) === tab).length;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alunos</Text>

      {/* busca */}
      <View style={styles.searchBox}>
        <Feather name="search" size={15} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearch}
          placeholder="Nome ou e-mail..."
          placeholderTextColor={colors.textDim}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Feather name="x" size={15} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {/* filtro tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}>
        {ACCESS_FILTERS.map(tab => {
          const active = tab === filter;
          const COLOR_MAP = { ativo: colors.accent, bloqueado: colors.red, expirado: colors.amber };
          const ac = COLOR_MAP[tab] || colors.textDim;
          return (
            <TouchableOpacity key={tab}
              style={[styles.tab, active && { borderColor: ac, backgroundColor: ac + '18' }]}
              onPress={() => handleFilterTab(tab)}>
              <Text style={[styles.tabText, active && { color: ac }]}>
                {ACCESS_FILTER_LABELS[tab]}{counts[tab] > 0 ? ` (${counts[tab]})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="inbox" size={32} color={colors.textFaint} />
              <Text style={styles.emptyText}>
                {search ? 'Nenhum resultado para sua busca.' : 'Nenhum aluno encontrado.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const acc = accessStatus(item);
            const personalNm = personalsMap[item.personal_id] || null;
            return (
              <TouchableOpacity style={styles.card}
                onPress={() => { setSelected(item); setModalVisible(true); }}
                activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>{(item.name || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.cardName}>{item.name || 'Sem nome'}</Text>
                    <Text style={styles.cardEmail}>{item.email}</Text>
                  </View>
                  <Badge label={acc.label} color={acc.color} bg={acc.bg} />
                </View>

                <View style={styles.cardFooter}>
                  {personalNm && (
                    <View style={styles.footerChip}>
                      <Feather name="briefcase" size={11} color={colors.textDim} />
                      <Text style={styles.footerChipText}>{personalNm}</Text>
                    </View>
                  )}
                  {item.access_expires_at && (
                    <View style={styles.footerChip}>
                      <Feather name="calendar" size={11} color={colors.textDim} />
                      <Text style={styles.footerChipText}>Expira {fmtDate(item.access_expires_at)}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <StudentModal
        visible={modalVisible}
        student={selected}
        personalName={selected ? personalsMap[selected.personal_id] : null}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: screenPaddingTop },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, paddingHorizontal: s(20), marginBottom: vs(14) },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, marginHorizontal: 20, marginBottom: vs(12),
    paddingHorizontal: s(12), paddingVertical: vs(10) },
  searchInput: { flex: 1, color: colors.text, fontSize: fs(12) },

  tabsScroll: { maxHeight: 44 },
  tabs: { paddingHorizontal: s(20), gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: s(12), paddingVertical: vs(6), borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border },
  tabText: { fontSize: fs(10), fontWeight: '600', color: colors.textDim },

  card: { marginHorizontal: 20, marginTop: vs(10), backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.blueGlow,
    justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: colors.blue, fontWeight: '800', fontSize: fs(14) },
  cardName: { color: colors.text, fontSize: fs(12), fontWeight: '700' },
  cardEmail: { color: colors.textDim, fontSize: fs(10), marginTop: vs(1) },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: vs(10) },
  footerChip: { flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface2, borderRadius: radius.pill,
    paddingHorizontal: s(8), paddingVertical: vs(4) },
  footerChipText: { color: colors.textDim, fontSize: fs(9) },

  badge: { paddingHorizontal: s(9), paddingVertical: vs(4), borderRadius: radius.pill },
  badgeText: { fontSize: fs(9), fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: screenPaddingTop, gap: 10 },
  emptyText: { color: colors.textDim, fontSize: fs(12), textAlign: 'center' },

  // modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: 24, paddingBottom: vs(44), maxHeight: '70%' },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: vs(20) },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(4) },
  avatarLg: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blueGlow,
    justifyContent: 'center', alignItems: 'center' },
  avatarLgLetter: { color: colors.blue, fontWeight: '800', fontSize: fs(18) },
  modalName: { fontSize: fs(15), fontWeight: '800', color: colors.text },
  modalEmail: { fontSize: fs(10), color: colors.textDim, marginTop: vs(2) },
  modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },

  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: vs(14) },
  rowLabel: { fontSize: fs(9), color: colors.textDim, marginBottom: vs(1) },
  rowValue: { fontSize: fs(12), color: colors.text, fontWeight: '600' },
});
