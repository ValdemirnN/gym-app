import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

// ─── constantes ──────────────────────────────────────────────
const STATUS_META = {
  aprovado:  { label: 'Ativo',      color: colors.accent, bg: colors.accentGlow },
  pendente:  { label: 'Pendente',   color: colors.amber,  bg: colors.amberGlow  },
  recusado:  { label: 'Recusado',   color: colors.red,    bg: colors.redGlow    },
  suspenso:  { label: 'Suspenso',   color: '#FF8C42',     bg: 'rgba(255,140,66,0.14)' },
};

const FILTER_TABS = ['todos','pendente','aprovado','suspenso','recusado'];

// ─── badge ───────────────────────────────────────────────────
function Badge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pendente;
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

// ─── detalhe info ────────────────────────────────────────────
function Detail({ icon, value }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={12} color={colors.textDim} />
      <Text style={styles.detailText}>{value}</Text>
    </View>
  );
}

// ─── modal de ação ───────────────────────────────────────────
function ActionModal({ visible, personal, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [targetStatus, setTargetStatus] = useState(null);

  const actions = personal ? (() => {
    const s = personal.status;
    const list = [];
    if (s === 'pendente')  list.push({ status:'aprovado', label:'Aprovar',   icon:'check-circle', color:colors.accent });
    if (s === 'pendente')  list.push({ status:'recusado', label:'Recusar',   icon:'x-circle',     color:colors.red   });
    if (s === 'aprovado')  list.push({ status:'suspenso', label:'Suspender', icon:'pause-circle',  color:'#FF8C42'   });
    if (s === 'suspenso')  list.push({ status:'aprovado', label:'Reativar',  icon:'check-circle', color:colors.accent });
    if (s === 'recusado')  list.push({ status:'aprovado', label:'Aprovar mesmo assim', icon:'check-circle', color:colors.accent });
    if (s === 'suspenso')  list.push({ status:'recusado', label:'Recusar definitivamente', icon:'x-circle', color:colors.red });
    return list;
  })() : [];

  const needsReason = targetStatus === 'recusado' || targetStatus === 'suspenso';

  const handleSelect = (status) => setTargetStatus(status);

  const handleConfirm = () => {
    if (needsReason && !reason.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe um motivo para recusa ou suspensão.');
      return;
    }
    onConfirm(personal, targetStatus, reason.trim() || null);
    setTargetStatus(null);
    setReason('');
  };

  const handleClose = () => {
    setTargetStatus(null);
    setReason('');
    onClose();
  };

  if (!personal) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
          {/* handle */}
          <View style={styles.handle} />

          {/* personal info */}
          <Text style={styles.modalName}>{personal.name || 'Sem nome'}</Text>
          <Text style={styles.modalEmail}>{personal.email}</Text>
          {personal.cref_number && (
            <Text style={styles.modalCref}>CREF {personal.cref_number}{personal.cref_state ? `/${personal.cref_state}` : ''}</Text>
          )}
          <Badge status={personal.status} />

          {/* campos de perfil */}
          <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
            {personal.bio ? <Text style={styles.modalBio}>{personal.bio}</Text> : null}
          </ScrollView>

          <View style={styles.modalDivider} />

          {/* ações */}
          {!targetStatus ? (
            <>
              <Text style={styles.modalSectionLabel}>Alterar status</Text>
              {actions.map(a => (
                <TouchableOpacity key={a.status} style={[styles.modalAction, { borderColor: a.color + '44' }]}
                  onPress={() => handleSelect(a.status)}>
                  <Feather name={a.icon} size={16} color={a.color} />
                  <Text style={[styles.modalActionText, { color: a.color }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.modalSectionLabel}>
                {targetStatus === 'aprovado' ? '✅ Aprovar' :
                 targetStatus === 'recusado' ? '❌ Recusar' :
                 targetStatus === 'suspenso' ? '⏸ Suspender' : '↩ Reativar'} "{personal.name}"?
              </Text>
              {needsReason && (
                <>
                  <Text style={styles.inputLabel}>Motivo (obrigatório)</Text>
                  <TextInput
                    style={styles.reasonInput}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Ex: documentação inválida, denúncia de aluno..."
                    placeholderTextColor={colors.textDim}
                    multiline
                    numberOfLines={3}
                  />
                </>
              )}
              <View style={styles.modalConfirmRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setTargetStatus(null)}>
                  <Text style={styles.cancelBtnText}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                  <Text style={styles.confirmBtnText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── screen principal ─────────────────────────────────────────
export default function AdminPersonalsListScreen() {
  const [personals, setPersonals] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, status, pix_key, whatsapp, cref_number, cref_state, bio, instagram_url, created_at, approved_at')
      .eq('role', 'personal')
      .order('created_at', { ascending: false });

    const sorted = (data || []).sort((a, b) => {
      const order = { pendente: 0, suspenso: 1, aprovado: 2, recusado: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    });
    setPersonals(sorted);
    applyFilters(sorted, filter, search);
    setLoading(false);
  }, []);

  const applyFilters = (list, tab, q) => {
    let result = tab === 'todos' ? list : list.filter(p => p.status === tab);
    if (q.trim()) {
      const q2 = q.toLowerCase();
      result = result.filter(p =>
        (p.name||'').toLowerCase().includes(q2) ||
        (p.email||'').toLowerCase().includes(q2) ||
        (p.cref_number||'').toLowerCase().includes(q2)
      );
    }
    setFiltered(result);
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleFilterTab = (tab) => {
    setFilter(tab);
    applyFilters(personals, tab, search);
  };

  const handleSearch = (q) => {
    setSearch(q);
    applyFilters(personals, filter, q);
  };

  const openModal = (personal) => {
    setSelected(personal);
    setModalVisible(true);
  };

  const handleConfirmAction = async (personal, newStatus, reason) => {
    setModalVisible(false);
    try {
      const { error } = await supabase.rpc('admin_set_personal_status', {
        p_personal_id: personal.id,
        p_new_status: newStatus,
        p_reason: reason,
      });
      if (error) throw error;
    } catch (e) {
      // fallback se a RPC ainda não existir (rode o schema_v25 primeiro)
      await supabase.from('profiles').update({ status: newStatus }).eq('id', personal.id);
    }
    await load();
  };

  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab] = tab === 'todos' ? personals.length : personals.filter(p => p.status === tab).length;
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personals</Text>

      {/* busca */}
      <View style={styles.searchBox}>
        <Feather name="search" size={15} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearch}
          placeholder="Nome, e-mail ou CREF..."
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
        {FILTER_TABS.map(tab => {
          const active = tab === filter;
          const meta = STATUS_META[tab];
          const accentColor = meta?.color || colors.accent;
          return (
            <TouchableOpacity key={tab} style={[styles.tab, active && { borderColor: accentColor, backgroundColor: accentColor + '18' }]}
              onPress={() => handleFilterTab(tab)}>
              <Text style={[styles.tabText, active && { color: accentColor }]}>
                {tab === 'todos' ? 'Todos' : (STATUS_META[tab]?.label || tab)}
                {counts[tab] > 0 ? ` (${counts[tab]})` : ''}
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
                {search ? 'Nenhum resultado para sua busca.' : 'Nenhum personal encontrado.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openModal(item)} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                {/* avatar placeholder */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{(item.name||'?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardName}>{item.name || 'Sem nome'}</Text>
                  <Text style={styles.cardEmail}>{item.email}</Text>
                </View>
                <Badge status={item.status} />
              </View>

              <View style={styles.detailsBlock}>
                {item.cref_number && (
                  <Detail icon="award" value={`CREF ${item.cref_number}${item.cref_state ? `/${item.cref_state}` : ''}`} />
                )}
                <Detail icon="phone" value={item.whatsapp} />
                <Detail icon="credit-card" value={item.pix_key ? `Pix: ${item.pix_key}` : null} />
              </View>

              {item.status === 'pendente' && (
                <View style={styles.pendenteBanner}>
                  <Feather name="clock" size={11} color={colors.amber} />
                  <Text style={styles.pendenteBannerText}>Aguardando revisão — toque para agir</Text>
                </View>
              )}
              {item.status === 'suspenso' && (
                <View style={[styles.pendenteBanner, { borderColor: '#FF8C42', backgroundColor: 'rgba(255,140,66,0.1)' }]}>
                  <Feather name="pause-circle" size={11} color="#FF8C42" />
                  <Text style={[styles.pendenteBannerText, { color: '#FF8C42' }]}>Personal suspenso — toque para reativar</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <ActionModal
        visible={modalVisible}
        personal={selected}
        onClose={() => setModalVisible(false)}
        onConfirm={handleConfirmAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: screenPaddingTop },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, paddingHorizontal: s(20), marginBottom: vs(14) },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, marginHorizontal: 20, marginBottom: vs(12), paddingHorizontal: s(12), paddingVertical: vs(10) },
  searchInput: { flex: 1, color: colors.text, fontSize: fs(12) },

  tabsScroll: { maxHeight: 44 },
  tabs: { paddingHorizontal: s(20), gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: s(12), paddingVertical: vs(6), borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border },
  tabText: { fontSize: fs(10), fontWeight: '600', color: colors.textDim },

  card: { marginHorizontal: 20, marginTop: vs(10), backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentGlow,
    justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: colors.accent, fontWeight: '800', fontSize: fs(14) },
  cardName: { color: colors.text, fontSize: fs(12), fontWeight: '700' },
  cardEmail: { color: colors.textDim, fontSize: fs(10), marginTop: vs(1) },

  detailsBlock: { marginTop: vs(10), gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { color: colors.textDim, fontSize: fs(10) },

  badge: { paddingHorizontal: s(9), paddingVertical: vs(4), borderRadius: radius.pill },
  badgeText: { fontSize: fs(9), fontWeight: '700' },

  pendenteBanner: { flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: vs(10), borderRadius: radius.sm - 4, paddingHorizontal: s(10), paddingVertical: vs(6),
    borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberGlow },
  pendenteBannerText: { color: colors.amber, fontSize: fs(9) },

  empty: { alignItems: 'center', paddingTop: screenPaddingTop, gap: 10 },
  emptyText: { color: colors.textDim, fontSize: fs(12), textAlign: 'center' },

  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: 24, paddingBottom: vs(40) },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: vs(20) },
  modalName: { fontSize: fs(16), fontWeight: '800', color: colors.text, marginBottom: vs(2) },
  modalEmail: { fontSize: fs(11), color: colors.textDim, marginBottom: vs(4) },
  modalCref: { fontSize: fs(10), color: colors.blue, fontWeight: '600', marginBottom: vs(8) },
  modalBio: { fontSize: fs(11), color: colors.textDim, lineHeight: 18, marginVertical: 8 },
  modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  modalSectionLabel: { fontSize: fs(10), fontWeight: '700', color: colors.textDim,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: vs(12) },
  modalAction: { flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: radius.sm, borderWidth: 1, marginBottom: vs(10),
    backgroundColor: colors.surface2 },
  modalActionText: { fontSize: fs(12), fontWeight: '700' },
  inputLabel: { fontSize: fs(10), color: colors.textDim, marginBottom: vs(6) },
  reasonInput: { backgroundColor: colors.bg, color: colors.text, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.sm, padding: 12, fontSize: fs(12),
    minHeight: 72, textAlignVertical: 'top', marginBottom: vs(16) },
  modalConfirmRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: 14, alignItems: 'center' },
  cancelBtnText: { color: colors.textDim, fontWeight: '700' },
  confirmBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.sm,
    padding: 14, alignItems: 'center' },
  confirmBtnText: { color: '#04170F', fontWeight: '700' },
});
