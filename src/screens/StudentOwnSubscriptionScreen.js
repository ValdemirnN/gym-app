import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';

const STATUS_LABEL = {
  confirmado: { text: 'Pago', color: colors.accent, glow: colors.accentGlow },
  pendente: { text: 'Aguardando confirmação', color: colors.amber, glow: colors.amberGlow },
  recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
};

function monthLabel(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function StudentOwnSubscriptionScreen({ navigation }) {
  const { session, profile } = useAuth();
  const [payments, setPayments] = useState([]);
  const [access, setAccess] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('cliente_id', session.user.id)
      .order('reference_month', { ascending: false });
    setPayments(data || []);

    const { data: acc } = await supabase
      .from('profiles')
      .select('access_expires_at, access_blocked, monthly_fee')
      .eq('id', session.user.id)
      .single();
    setAccess(acc);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthPaid = payments.some((p) => p.status === 'confirmado' && (p.reference_month || '').startsWith(currentMonthKey));

  const accessStatus = access?.access_blocked
    ? { text: 'Bloqueado', color: colors.red }
    : access?.access_expires_at && new Date(access.access_expires_at) < now
    ? { text: 'Expirado', color: colors.red }
    : { text: 'Ativo', color: colors.accent };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Faturas</Text>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Mês atual</Text>
          <Text style={[styles.summaryValue, { color: currentMonthPaid ? colors.accent : colors.red }]}>
            {currentMonthPaid ? 'Em dia' : 'Pendente'}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Acesso</Text>
          <Text style={[styles.summaryValue, { color: accessStatus.color }]}>{accessStatus.text}</Text>
        </View>
      </View>

      {access?.monthly_fee ? (
        <View style={styles.feeBox}>
          <Text style={styles.feeLabel}>Sua mensalidade</Text>
          <Text style={styles.feeValue}>R$ {Number(access.monthly_fee).toFixed(2)}</Text>
        </View>
      ) : null}

      {access?.access_expires_at ? (
        <View style={styles.feeBox}>
          <Text style={styles.feeLabel}>Seu acesso é válido até</Text>
          <Text style={styles.feeValue}>{formatDate(access.access_expires_at)}</Text>
        </View>
      ) : null}

      <Text style={styles.historyTitle}>Histórico</Text>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma fatura registrada ainda.</Text>}
        renderItem={({ item }) => {
          const status = STATUS_LABEL[item.status] || STATUS_LABEL.pendente;
          return (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <Feather name="credit-card" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{monthLabel(item.reference_month)}</Text>
                {item.amount ? <Text style={styles.cardSubtitle}>R$ {Number(item.amount).toFixed(2)}</Text> : null}
              </View>
              <View style={[styles.badge, { backgroundColor: status.glow }]}>
                <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  summaryLabel: { color: colors.textDim, fontSize: 11, marginBottom: 4 },
  summaryValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  feeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  feeLabel: { color: colors.accent, fontSize: 12.5, fontWeight: '600' },
  feeValue: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  historyTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 10, marginBottom: 8 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
