import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

const STATUS_LABEL = {
  aprovado: { text: 'Aprovado', color: colors.accent, glow: colors.accentGlow },
  pendente: { text: 'Pendente', color: colors.amber, glow: colors.amberGlow },
  recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
};

export default function AdminPersonalsListScreen() {
  const [personals, setPersonals] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, status, pix_key, whatsapp, created_at')
      .eq('role', 'personal')
      .order('status') // pendentes primeiro (p < a alfabeticamente... ajustamos abaixo)
      .order('name');
    // pendentes primeiro de propósito
    const sorted = (data || []).sort((a, b) => {
      if (a.status === b.status) return 0;
      if (a.status === 'pendente') return -1;
      if (b.status === 'pendente') return 1;
      return 0;
    });
    setPersonals(sorted);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    load();
  };

  const confirmAction = (personal, status) => {
    const acao = status === 'aprovado' ? 'aprovar' : 'recusar';
    Alert.alert(`Confirmar`, `Deseja ${acao} o Personal "${personal.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => updateStatus(personal.id, status) },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personals</Text>

      <FlatList
        data={personals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum Personal cadastrado ainda.</Text>}
        renderItem={({ item }) => {
          const status = STATUS_LABEL[item.status] || STATUS_LABEL.pendente;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name || 'Sem nome'}</Text>
                  <Text style={styles.cardSubtitle}>{item.email}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: status.glow }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
                </View>
              </View>

              {item.pix_key ? <Text style={styles.detail}>Pix: {item.pix_key}</Text> : null}
              {item.whatsapp ? <Text style={styles.detail}>WhatsApp: {item.whatsapp}</Text> : null}

              {item.status === 'pendente' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => confirmAction(item, 'aprovado')}
                  >
                    <Text style={styles.approveButtonText}>Aprovar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => confirmAction(item, 'recusado')}
                  >
                    <Text style={styles.rejectButtonText}>Recusar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.status === 'recusado' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton, { marginTop: 10 }]}
                  onPress={() => confirmAction(item, 'aprovado')}
                >
                  <Text style={styles.approveButtonText}>Aprovar mesmo assim</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
  detail: { color: colors.textDim, fontSize: 12, marginTop: 8 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionButton: { flex: 1, borderRadius: radius.sm - 4, paddingVertical: 10, alignItems: 'center' },
  approveButton: { backgroundColor: colors.accent },
  approveButtonText: { color: '#04170F', fontWeight: '700', fontSize: 13 },
  rejectButton: { borderWidth: 1, borderColor: colors.red },
  rejectButtonText: { color: colors.red, fontWeight: '700', fontSize: 13 },
});
