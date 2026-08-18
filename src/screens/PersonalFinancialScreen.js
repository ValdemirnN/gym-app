import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function monthLabel(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default function PersonalFinancialScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    // Busca o perfil do personal (plano, validade, status)
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_price, subscription_expires_at, subscription_status, subscription_payment_method')
      .eq('id', session.user.id)
      .single();

    // Busca histórico de pagamentos do personal com a plataforma
    const { data: payments } = await supabase
      .from('personal_payments')
      .select('*')
      .eq('personal_id', session.user.id)
      .order('reference_month', { ascending: false })
      .limit(10);

    setSubscription({ profile, payments: payments || [] });
    setLoading(false);
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Cálculos de exibição ─────────────────────────────────
  const now = new Date();
  const expiresAt = subscription?.profile?.subscription_expires_at
    ? new Date(subscription.profile.subscription_expires_at)
    : null;

  const daysLeft = expiresAt
    ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
    : null;

  const isActive = expiresAt && expiresAt > now;
  const planPrice = subscription?.profile?.subscription_price;
  const planName = subscription?.profile?.subscription_plan ?? 'Plano mensal';
  const paymentMethod = subscription?.profile?.subscription_payment_method ?? null;
  const payments = subscription?.payments ?? [];

  // Status do plano
  const planStatusLabel = isActive
    ? daysLeft !== null && daysLeft <= 7
      ? `Ativo · vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`
      : 'Ativo'
    : expiresAt
    ? 'Vencido'
    : 'Inativo';

  const planStatusColor = isActive
    ? daysLeft !== null && daysLeft <= 7
      ? colors.amber
      : colors.accent
    : colors.red;

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
          <Feather name="chevron-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Financeiro</Text>
          <Text style={styles.subtitle}>Sua situação com a plataforma</Text>
        </View>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Carregando...</Text>
      ) : (
        <>
          {/* Grid de stats */}
          <View style={styles.grid}>
            <View style={[styles.statCard, styles.statCardAccent]}>
              <Text style={styles.statNum}>
                {planPrice ? `R$${Number(planPrice).toFixed(0)}` : '--'}
              </Text>
              <Text style={styles.statLbl}>Valor do plano / mês</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: planStatusColor }]}>
                {daysLeft !== null ? (daysLeft > 0 ? String(daysLeft) : '0') : '--'}
              </Text>
              <Text style={styles.statLbl}>Dias até o vencimento</Text>
            </View>
          </View>

          {/* Card de status do plano */}
          <View style={[
            styles.wideCard,
            !isActive && { borderColor: colors.red + '55', backgroundColor: colors.redGlow },
          ]}>
            <View style={[
              styles.ring,
              { borderColor: isActive ? (daysLeft <= 7 ? colors.amber : colors.accent) : colors.red },
            ]}>
              <Feather
                name={isActive ? (daysLeft !== null && daysLeft <= 7 ? 'clock' : 'check-circle') : 'x-circle'}
                size={22}
                color={isActive ? (daysLeft !== null && daysLeft <= 7 ? colors.amber : colors.accent) : colors.red}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.wideTitle}>
                {isActive
                  ? `Plano ativo até ${expiresAt ? formatDate(expiresAt.toISOString()) : '-'}`
                  : expiresAt
                  ? `Plano venceu em ${formatDate(expiresAt.toISOString())}`
                  : 'Sem assinatura ativa'}
              </Text>
              <Text style={[styles.wideSub, !isActive && { color: colors.red }]}>
                {isActive && paymentMethod
                  ? paymentMethod
                  : isActive
                  ? `Renovação em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}.`
                  : 'Entre em contato com o suporte para renovar seu plano.'}
              </Text>
            </View>
          </View>

          {/* Status pill */}
          <View style={[styles.statusPill, { backgroundColor: isActive ? colors.accentGlow : colors.redGlow }]}>
            <View style={[styles.statusDot, { backgroundColor: planStatusColor }]} />
            <Text style={[styles.statusPillText, { color: planStatusColor }]}>
              {planStatusLabel}
            </Text>
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
          <Text style={styles.histSub}>Seus últimos pagamentos à plataforma</Text>

          {payments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="file-text" size={22} color={colors.textFaint} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>Nenhum pagamento registrado ainda.</Text>
            </View>
          ) : (
            payments.map((item) => {
              const isPaid = item.status === 'pago' || item.status === 'confirmado';
              return (
                <View key={item.id} style={styles.histRow}>
                  <View style={styles.histIcon}>
                    <Feather name="credit-card" size={15} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histLabel}>{planName}</Text>
                    <Text style={styles.histDate}>
                      {isPaid
                        ? `Pago em ${formatDate(item.confirmed_at || item.reference_month)}`
                        : `Vence em ${formatDate(item.reference_month)}`}
                    </Text>
                  </View>
                  <View style={isPaid ? styles.badgePaid : styles.badgePending}>
                    <Text style={isPaid ? styles.badgePaidText : styles.badgePendingText}>
                      {isPaid ? 'Pago' : 'Pendente'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loadingText: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: vs(60),
    fontSize: fs(12),
  },

  // header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: vs(24),
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
  title: { color: colors.text, fontSize: fs(17), fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: fs(11), marginTop: vs(2) },

  // grid
  grid: { flexDirection: 'row', gap: 12, marginBottom: vs(16) },
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
    fontSize: fs(25),
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  statLbl: { color: colors.textDim, fontSize: fs(10), marginTop: vs(4) },

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
    marginBottom: vs(12),
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
  wideTitle: { color: colors.text, fontWeight: '700', fontSize: fs(12.5) },
  wideSub: {
    color: colors.amber,
    fontSize: fs(10.5),
    marginTop: vs(4),
    lineHeight: 18,
    opacity: 0.85,
  },

  // status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: s(12),
    paddingVertical: vs(6),
    gap: 6,
    marginBottom: vs(16),
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: fs(10),
    fontWeight: '700',
  },

  // ações
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: vs(24) },
  actionCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: colors.accent },
  actionPrimaryText: { color: '#04170F', fontWeight: '800', fontSize: fs(11.5) },
  actionSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionSecondaryText: { color: colors.text, fontWeight: '700', fontSize: fs(11.5) },

  // histórico
  histTitle: {
    color: colors.text,
    fontSize: fs(13.5),
    fontWeight: '800',
    marginBottom: vs(4),
  },
  histSub: { color: colors.textFaint, fontSize: fs(10), marginBottom: vs(12) },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: colors.textDim, fontSize: fs(11) },
  histRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: vs(9),
    borderWidth: 1,
    borderColor: colors.border,
  },
  histIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histLabel: { color: colors.text, fontWeight: '700', fontSize: fs(11.5) },
  histDate: { color: colors.textDim, fontSize: fs(9.5), marginTop: vs(2) },
  badgePaid: {
    backgroundColor: colors.accentGlow,
    borderRadius: 20,
    paddingHorizontal: s(11),
    paddingVertical: vs(5),
  },
  badgePaidText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  badgePending: {
    backgroundColor: colors.amberGlow,
    borderRadius: 20,
    paddingHorizontal: s(11),
    paddingVertical: vs(5),
  },
  badgePendingText: { color: colors.amber, fontSize: fs(9), fontWeight: '700' },
});
