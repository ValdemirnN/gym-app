import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';

const STATUS_LABEL = {
  confirmado: { text: 'Confirmado', color: colors.accent, glow: colors.accentGlow },
  pendente: { text: 'Aguardando confirmação', color: colors.amber, glow: colors.amberGlow },
  recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function StudentSubscriptionScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const { session } = useAuth();
  const [payments, setPayments] = useState([]);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('cliente_id', studentId)
      .order('reference_month', { ascending: false });
    setPayments(data || []);
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unlockStudent = async () => {
    await supabase.from('profiles').update({ status: 'aprovado' }).eq('id', studentId);
  };

  const confirmarPagamento = async (paymentId) => {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'confirmado', confirmed_at: new Date().toISOString(), confirmed_by: session.user.id })
      .eq('id', paymentId);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    await unlockStudent();
    load();
    Alert.alert('Pronto', 'Pagamento confirmado e acesso do aluno liberado.');
  };

  const registrarPagamento = async () => {
    setSaving(true);
    const now = new Date();
    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const { error } = await supabase.from('payments').insert({
      cliente_id: studentId,
      personal_id: session.user.id,
      reference_month: referenceMonth,
      amount: parseFloat(amount) || null,
      status: 'confirmado',
      confirmed_at: now.toISOString(),
      confirmed_by: session.user.id,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    await unlockStudent();
    setAmount('');
    load();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Assinatura</Text>

      <View style={styles.registerBox}>
        <Text style={styles.registerLabel}>Registrar pagamento deste mês (valor opcional)</Text>
        <View style={{ flexDirection: 'row' }}>
          <TextInput
            style={styles.amountInput}
            placeholder="R$"
            placeholderTextColor={colors.textDim2}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <TouchableOpacity style={styles.registerButton} onPress={registrarPagamento} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.registerButtonText}>{saving ? '...' : 'Registrar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum pagamento registrado ainda.</Text>}
        renderItem={({ item }) => {
          const status = STATUS_LABEL[item.status] || STATUS_LABEL.pendente;
          return (
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <Feather name="credit-card" size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Referente a {formatDate(item.reference_month)}</Text>
                {item.amount ? <Text style={styles.cardSubtitle}>R$ {Number(item.amount).toFixed(2)}</Text> : null}
              </View>
              {item.status === 'pendente' ? (
                <TouchableOpacity style={styles.confirmButton} onPress={() => confirmarPagamento(item.id)}>
                  <Text style={styles.confirmButtonText}>Confirmar</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.badge, { backgroundColor: status.glow }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
                </View>
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
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  registerBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 20,
  },
  registerLabel: { color: colors.textDim, fontSize: 12, marginBottom: 10 },
  amountInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    padding: 10,
    marginRight: 10,
  },
  registerButton: { backgroundColor: colors.accent, borderRadius: radius.sm - 4, paddingHorizontal: 16, justifyContent: 'center' },
  registerButtonText: { color: '#04170F', fontWeight: '700' },
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
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
  confirmButton: { backgroundColor: colors.accent, borderRadius: radius.sm - 4, paddingHorizontal: 12, paddingVertical: 8 },
  confirmButtonText: { color: '#04170F', fontWeight: '700', fontSize: 12 },
});
