import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, radius } from '../theme/theme';

const PAYMENT_HISTORY = [
  { id: '1', label: 'Plano mensal', date: 'Pago em 12/07', status: 'paid' },
  { id: '2', label: 'Plano mensal', date: 'Pago em 12/06', status: 'paid' },
  { id: '3', label: 'Plano mensal', date: 'Vence em 12/08', status: 'pending' },
];

export default function PersonalFinancialScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
    >
      {/* Header com voltar */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Financeiro</Text>
          <Text style={styles.subtitle}>Sua situação com a plataforma</Text>
        </View>
      </View>

      {/* Grid de stats */}
      <View style={styles.grid}>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Text style={styles.statNum}>R$97</Text>
          <Text style={styles.statLbl}>Valor do plano / mês</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>3</Text>
          <Text style={styles.statLbl}>Dias até o vencimento</Text>
        </View>
      </View>

      {/* Card de status do plano */}
      <View style={styles.wideCard}>
        <View style={styles.ring}>
          <Text style={{ fontSize: 22 }}>⏳</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.wideTitle}>Plano ativo até 12/08</Text>
          <Text style={styles.wideSub}>
            Pagamento automático via cartão final •• 4412. Renovação em 3 dias.
          </Text>
        </View>
      </View>

      {/* Ações */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionPrimary]}
          onPress={() => Alert.alert('Em breve', 'Pagamento será integrado em breve.')}
        >
          <Text style={styles.actionPrimaryText}>💳  Pagar agora</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionSecondary]}
          onPress={() => Alert.alert('Em breve', 'Troca de forma de pagamento em breve.')}
        >
          <Text style={styles.actionSecondaryText}>🧾  Trocar forma de pagto.</Text>
        </TouchableOpacity>
      </View>

      {/* Histórico */}
      <Text style={styles.histTitle}>Histórico de pagamentos</Text>
      <Text style={styles.histSub}>Seus últimos acessos liberados</Text>

      {PAYMENT_HISTORY.map((item) => (
        <View key={item.id} style={styles.histRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.histLabel}>{item.label}</Text>
            <Text style={styles.histDate}>{item.date}</Text>
          </View>
          <View style={item.status === 'paid' ? styles.badgePaid : styles.badgePending}>
            <Text style={item.status === 'paid' ? styles.badgePaidText : styles.badgePendingText}>
              {item.status === 'paid' ? 'Pago' : 'Pendente'}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backArrow: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 13, marginTop: 2 },

  // grid
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardAccent: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  statNum: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  statLbl: { color: colors.textDim, fontSize: 12, marginTop: 4 },

  // wide card (plano ativo)
  wideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.amberGlow,
    borderWidth: 1,
    borderColor: colors.amber + '55',
    borderRadius: radius.md,
    padding: 17,
    marginBottom: 16,
  },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    borderColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideTitle: { color: colors.text, fontWeight: '700', fontSize: 14.5 },
  wideSub: {
    color: colors.amber,
    fontSize: 12.5,
    marginTop: 4,
    lineHeight: 18,
    opacity: 0.85,
  },

  // ações
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: colors.accent },
  actionPrimaryText: { color: '#04170F', fontWeight: '800', fontSize: 13.5 },
  actionSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionSecondaryText: { color: colors.text, fontWeight: '700', fontSize: 13.5 },

  // histórico
  histTitle: {
    color: colors.text,
    fontSize: 15.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  histSub: { color: colors.textFaint, fontSize: 12, marginBottom: 12 },
  histRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  histLabel: { color: colors.text, fontWeight: '700', fontSize: 13.5 },
  histDate: { color: colors.textDim, fontSize: 11.5, marginTop: 2 },
  badgePaid: {
    backgroundColor: colors.accentGlow,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgePaidText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  badgePending: {
    backgroundColor: colors.amberGlow,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgePendingText: { color: colors.amber, fontSize: 11, fontWeight: '700' },
});
