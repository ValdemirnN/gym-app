import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Clipboard, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';;
import { colors, radius } from '../theme/theme';

function monthLabel(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function StudentOwnSubscriptionScreen({ navigation }) {
  const { session } = useAuth();
  const [payments, setPayments] = useState([]);
  const [access, setAccess] = useState(null);
  const [pixKey, setPixKey] = useState(null);

  const load = useCallback(async () => {
    const userId = session.user.id;

    const { data: pays } = await supabase
      .from('payments')
      .select('*')
      .eq('cliente_id', userId)
      .order('reference_month', { ascending: false });
    setPayments(pays || []);

    const { data: acc } = await supabase
      .from('profiles')
      .select('access_expires_at, access_blocked, monthly_fee, personal_id')
      .eq('id', userId)
      .single();
    setAccess(acc);

    // Busca a chave pix do personal deste aluno
    if (acc?.personal_id) {
      const { data: personal } = await supabase
        .from('profiles')
        .select('pix_key, name')
        .eq('id', acc.personal_id)
        .single();
      setPixKey(personal);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthPaid = payments.some(
    (p) => p.status === 'confirmado' && (p.reference_month || '').startsWith(currentMonthKey)
  );

  const accessBlocked = access?.access_blocked;
  const accessExpired = access?.access_expires_at && new Date(access.access_expires_at) < now;
  const isBlocked = accessBlocked || accessExpired || !access?.access_expires_at;

  const daysUntilExpiry = access?.access_expires_at
    ? Math.ceil((new Date(access.access_expires_at) - now) / (1000 * 60 * 60 * 24))
    : null;

  // Nível de urgência: 0=ok, 1=aviso (≤15 dias), 2=urgente (≤7 dias), 3=bloqueado
  const urgencyLevel = isBlocked ? 3 : daysUntilExpiry !== null && daysUntilExpiry <= 7 ? 2 : daysUntilExpiry !== null && daysUntilExpiry <= 15 ? 1 : 0;

  const copiarPix = () => {
    if (pixKey?.pix_key) {
      Clipboard.setString(pixKey.pix_key);
      Alert.alert('Copiado!', 'Chave Pix copiada para a área de transferência.');
    }
  };

  const STATUS_LABEL = {
    confirmado: { text: 'Pago', color: colors.accent, glow: colors.accentGlow },
    pendente: { text: 'Pendente', color: colors.amber, glow: colors.amberGlow },
    recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Minhas faturas</Text>

      {/* Banner de aviso / bloqueio */}
      {urgencyLevel === 3 && (
        <View style={[styles.alertBanner, styles.alertDanger]}>
          <View style={[styles.alertIcon, { backgroundColor: 'rgba(255,90,122,0.15)' }]}>
            <Feather name="lock" size={20} color={colors.red} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: colors.red }]}>Acesso suspenso</Text>
            <Text style={[styles.alertText, { color: '#ff8fa3' }]}>
              Seu acesso ao app foi suspenso por falta de pagamento confirmado. Fale com seu personal para regularizar.
            </Text>
          </View>
        </View>
      )}

      {urgencyLevel === 2 && (
        <View style={[styles.alertBanner, styles.alertWarnStrong]}>
          <View style={[styles.alertIcon, { backgroundColor: 'rgba(255,182,72,0.15)' }]}>
            <Feather name="alert-circle" size={20} color={colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: colors.amber }]}>
              Acesso vence em {daysUntilExpiry} dia{daysUntilExpiry !== 1 ? 's' : ''}
            </Text>
            <Text style={[styles.alertText, { color: '#c8902e' }]}>
              Renove com seu personal até {formatDate(access.access_expires_at)} para não perder o acesso.
            </Text>
            {pixKey?.pix_key && (
              <TouchableOpacity onPress={copiarPix} style={styles.alertAction}>
                <Feather name="copy" size={13} color={colors.amber} />
                <Text style={[styles.alertActionText, { color: colors.amber }]}>Copiar chave Pix</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {urgencyLevel === 1 && (
        <View style={[styles.alertBanner, styles.alertWarnLight]}>
          <View style={[styles.alertIcon, { backgroundColor: 'rgba(255,182,72,0.1)' }]}>
            <Feather name="bell" size={18} color={colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: colors.amber }]}>Renovação em {daysUntilExpiry} dias</Text>
            <Text style={[styles.alertText, { color: '#c8902e' }]}>
              Seu acesso vence em {formatDate(access.access_expires_at)}. Avise seu personal para renovar.
            </Text>
          </View>
        </View>
      )}

      {/* Cards de status */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Mês atual</Text>
          <Text style={[styles.summaryValue, { color: currentMonthPaid ? colors.accent : colors.red }]}>
            {currentMonthPaid ? 'Em dia' : 'Pendente'}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Acesso</Text>
          <Text style={[styles.summaryValue, { color: isBlocked ? colors.red : colors.accent }]}>
            {isBlocked ? (accessBlocked ? 'Bloqueado' : 'Expirado') : 'Ativo'}
          </Text>
        </View>
      </View>

      {/* Plano + validade */}
      {(access?.monthly_fee || access?.access_expires_at) && (
        <View style={styles.planBox}>
          {access?.monthly_fee && (
            <View style={styles.planRow}>
              <Text style={styles.planLabel}>Mensalidade do plano</Text>
              <Text style={styles.planValue}>R$ {Number(access.monthly_fee).toFixed(2)} / mês</Text>
            </View>
          )}
          {access?.access_expires_at && (
            <View style={[styles.planRow, { borderTopWidth: access?.monthly_fee ? 0.5 : 0, borderTopColor: colors.border, marginTop: access?.monthly_fee ? 10 : 0, paddingTop: access?.monthly_fee ? 10 : 0 }]}>
              <Text style={styles.planLabel}>Acesso válido até</Text>
              <Text style={[styles.planValue, isBlocked && { color: colors.red }]}>
                {formatDate(access.access_expires_at)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Chave pix do personal */}
      {pixKey?.pix_key && (
        <View style={styles.pixBox}>
          <Text style={styles.pixTitle}>Chave Pix do personal</Text>
          <TouchableOpacity style={styles.pixRow} onPress={copiarPix} activeOpacity={0.7}>
            <Text style={styles.pixKey} numberOfLines={1}>{pixKey.pix_key}</Text>
            <View style={styles.pixCopyBtn}>
              <Feather name="copy" size={14} color={colors.accent} />
              <Text style={styles.pixCopyText}>Copiar</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.pixNote}>Após pagar, avise seu personal para confirmar o pagamento.</Text>
        </View>
      )}

      {/* Falar com personal */}
      <TouchableOpacity
        style={styles.contactCard}
        onPress={() => navigation.navigate('TalkToPersonal')}
        activeOpacity={0.8}
      >
        <View style={styles.contactIcon}>
          <Feather name="message-circle" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactTitle}>Falar com personal</Text>
          <Text style={styles.contactSub}>Confirmar pagamento ou tirar dúvidas</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textDim} />
      </TouchableOpacity>

      {/* Histórico */}
      <Text style={styles.historyTitle}>Histórico</Text>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
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
                {item.confirmed_at && item.status === 'confirmado' && (
                  <Text style={styles.cardMeta}>Pago em {formatDate(item.confirmed_at)}</Text>
                )}
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
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 14 },

  alertBanner: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  alertDanger: { backgroundColor: 'rgba(255,90,122,0.08)', borderWidth: 1, borderColor: 'rgba(255,90,122,0.3)' },
  alertWarnStrong: { backgroundColor: 'rgba(255,182,72,0.1)', borderWidth: 1, borderColor: 'rgba(255,182,72,0.35)' },
  alertWarnLight: { backgroundColor: 'rgba(255,182,72,0.07)', borderWidth: 1, borderColor: 'rgba(255,182,72,0.2)' },
  alertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  alertTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  alertText: { fontSize: 12, lineHeight: 17 },
  alertAction: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  alertActionText: { fontSize: 12, fontWeight: '600' },

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

  planBox: {
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
  },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { color: colors.accent, fontSize: 12.5, fontWeight: '600' },
  planValue: { color: colors.accent, fontSize: 14, fontWeight: '800' },

  pixBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 12,
  },
  pixTitle: { color: colors.textDim, fontSize: 12, marginBottom: 8 },
  pixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    padding: 10,
    gap: 8,
  },
  pixKey: { color: colors.textDim, fontSize: 13, flex: 1 },
  pixCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pixCopyText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  pixNote: { color: colors.textFaint, fontSize: 11, marginTop: 8 },

  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  contactSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },

  historyTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
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
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  cardMeta: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
