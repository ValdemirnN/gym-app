import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Switch, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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

// Gera lista dos próximos 3 meses + mês atual para o seletor
function buildMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const isCurrentMonth = i === 0;
    options.push({ value, label: isCurrentMonth ? `${label} (mês atual)` : label });
  }
  return options;
}

// 'YYYY-MM-01' a partir de um objeto Date (dia sempre fixado em 01)
function monthToValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function StudentSubscriptionScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const { session } = useAuth();

  const [payments, setPayments] = useState([]);
  const [student, setStudent] = useState(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingFee, setEditingFee] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingAccess, setTogglingAccess] = useState(false);

  // Seletor de mês para novo pagamento
  const monthOptions = buildMonthOptions();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  // Opção "outro mês" (qualquer mês passado ou futuro) — fica escondida atrás
  // de um botão pra não poluir o seletor rápido de todo dia.
  const [useCustomMonth, setUseCustomMonth] = useState(false);
  const [customMonthDate, setCustomMonthDate] = useState(new Date());

  const load = useCallback(async () => {
    const { data: pays } = await supabase
      .from('payments')
      .select('*')
      .eq('cliente_id', studentId)
      .order('reference_month', { ascending: false });
    setPayments(pays || []);

    const { data: st } = await supabase
      .from('profiles')
      .select('access_expires_at, access_blocked, monthly_fee, created_at, pix_key')
      .eq('id', studentId)
      .single();
    setStudent(st);
    setFeeInput(st?.monthly_fee ? String(st.monthly_fee) : '');
  }, [studentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Acesso ──────────────────────────────────────────────
  // O acesso é SEMPRE derivado dos pagamentos confirmados.
  // Quando o personal confirma um pagamento, calculamos access_expires_at
  // a partir do último vencimento. O toggle manual apenas sobrescreve
  // access_blocked (bloqueio de emergência / desbloqueio manual).
  const recalcAccessAfterPayment = async () => {
    // Busca todos os pagamentos confirmados ordenados
    const { data: confirmed } = await supabase
      .from('payments')
      .select('reference_month')
      .eq('cliente_id', studentId)
      .eq('status', 'confirmado')
      .order('reference_month', { ascending: false });

    if (!confirmed || confirmed.length === 0) {
      // Sem pagamentos confirmados → bloquear acesso
      await supabase
        .from('profiles')
        .update({ access_expires_at: null, access_blocked: true, status: 'pendente' })
        .eq('id', studentId);
      return;
    }

    // O mês de referência mais recente + 1 mês = nova expiração
    const latestMonth = confirmed[0].reference_month; // 'YYYY-MM-01'
    const d = new Date(latestMonth + 'T00:00:00');
    d.setMonth(d.getMonth() + 1); // avança 1 mês
    const expiresAt = d.toISOString();

    await supabase
      .from('profiles')
      .update({ access_expires_at: expiresAt, access_blocked: false, status: 'aprovado' })
      .eq('id', studentId);
  };

  // ── Registrar pagamento ──────────────────────────────────
  const registrarPagamento = async () => {
    const selectedMonth = useCustomMonth ? monthToValue(customMonthDate) : monthOptions[selectedMonthIndex].value;

    // Impede duplicata: verifica se já existe pagamento confirmado nesse mês
    const already = payments.find(
      (p) => p.status === 'confirmado' && (p.reference_month || '').startsWith(selectedMonth.slice(0, 7))
    );
    if (already) {
      Alert.alert(
        'Mês já pago',
        `Já existe um pagamento confirmado para ${monthLabel(selectedMonth)}. Exclua o lançamento anterior se quiser corrigir.`
      );
      return;
    }

    setSaving(true);
    const now = new Date();
    const { error } = await supabase.from('payments').insert({
      cliente_id: studentId,
      personal_id: session.user.id,
      reference_month: selectedMonth,
      amount: parseFloat(amount.replace(',', '.')) || student?.monthly_fee || null,
      status: 'confirmado',
      confirmed_at: now.toISOString(),
      confirmed_by: session.user.id,
    });
    setSaving(false);

    if (error) { Alert.alert('Erro', error.message); return; }

    await recalcAccessAfterPayment();
    setAmount('');
    setSelectedMonthIndex(0);
    setUseCustomMonth(false);
    setCustomMonthDate(new Date());
    load();
    Alert.alert('Pronto', `Pagamento de ${monthLabel(selectedMonth)} registrado e acesso do aluno atualizado.`);
  };

  // ── Excluir pagamento ────────────────────────────────────
  const excluirPagamento = async (paymentId) => {
    setDeleting(true);
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    setDeleting(false);
    setConfirmDeleteId(null);

    if (error) { Alert.alert('Erro', error.message); return; }

    // Recalcula o acesso baseado nos pagamentos restantes
    await recalcAccessAfterPayment();
    load();
  };

  // ── Toggle de acesso manual (bloqueio de emergência) ─────
  const toggleAcessoManual = async (value) => {
    setTogglingAccess(true);
    const { error } = await supabase
      .from('profiles')
      .update({ access_blocked: !value })
      .eq('id', studentId);
    setTogglingAccess(false);

    if (error) { Alert.alert('Erro', error.message); return; }
    load();
  };

  // ── Salvar mensalidade combinada ─────────────────────────
  const saveFee = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ monthly_fee: feeInput ? parseFloat(feeInput.replace(',', '.')) : null })
      .eq('id', studentId);
    if (error) { Alert.alert('Erro', error.message); return; }
    setEditingFee(false);
    load();
  };

  // ── Cálculos de exibição ─────────────────────────────────
  const confirmedPayments = payments.filter((p) => p.status === 'confirmado');
  const totalRecebido = confirmedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const lastPayment = confirmedPayments[0];

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthPaid = confirmedPayments.some((p) => (p.reference_month || '').startsWith(currentMonthKey));

  const accessBlocked = student?.access_blocked;
  const accessExpired = student?.access_expires_at && new Date(student.access_expires_at) < now;
  const accessLive = !accessBlocked && !accessExpired && student?.access_expires_at;

  const accessStatus = accessBlocked
    ? { text: 'Bloqueado', color: colors.red }
    : accessExpired
    ? { text: 'Expirado', color: colors.red }
    : accessLive
    ? { text: 'Ativo', color: colors.accent }
    : { text: 'Sem acesso', color: colors.red };

  const daysUntilExpiry = student?.access_expires_at
    ? Math.ceil((new Date(student.access_expires_at) - now) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Assinatura</Text>

      {/* Cards de resumo */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Mês atual</Text>
          <Text style={[styles.summaryValue, { color: currentMonthPaid ? colors.accent : colors.red }]}>
            {currentMonthPaid ? 'Em dia' : 'Pendente'}
          </Text>
          <Text style={styles.summaryMeta}>{new Date().toLocaleDateString('pt-BR', { month: 'long' })}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Acesso</Text>
          <Text style={[styles.summaryValue, { color: accessStatus.color }]}>{accessStatus.text}</Text>
          {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
            <Text style={[styles.summaryMeta, daysUntilExpiry <= 7 && { color: colors.amber }]}>
              Expira em {daysUntilExpiry}d
            </Text>
          )}
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total recebido</Text>
          <Text style={styles.summaryValue}>R$ {totalRecebido.toFixed(2)}</Text>
          <Text style={styles.summaryMeta}>{confirmedPayments.length} pagamento(s)</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Último pag.</Text>
          <Text style={styles.summaryValue}>{lastPayment ? formatDate(lastPayment.reference_month) : '-'}</Text>
          {lastPayment?.amount && (
            <Text style={styles.summaryMeta}>R$ {Number(lastPayment.amount).toFixed(2)}</Text>
          )}
        </View>
      </View>

      {/* Mensalidade combinada */}
      <View style={styles.feeBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.registerLabel}>Mensalidade combinada</Text>
          {editingFee ? (
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <TextInput
                style={styles.amountInput}
                placeholder="R$ 0,00"
                placeholderTextColor={colors.textDim2}
                keyboardType="decimal-pad"
                value={feeInput}
                onChangeText={setFeeInput}
                autoFocus
              />
              <TouchableOpacity style={styles.registerButton} onPress={saveFee}>
                <Text style={styles.registerButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingFee(true)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
              <Text style={styles.feeValue}>
                {student?.monthly_fee ? `R$ ${Number(student.monthly_fee).toFixed(2)} / mês` : 'Toque para definir um valor'}
              </Text>
              <Feather name="edit-2" size={13} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
        {student?.access_expires_at && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.registerLabel}>Válido até</Text>
            <Text style={styles.feeValue}>{formatDate(student.access_expires_at)}</Text>
          </View>
        )}
      </View>

      {/* Controle de acesso */}
      <View style={styles.accessCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.accessTitle}>Liberar acesso ao app</Text>
          <Text style={styles.accessSub}>
            {accessBlocked
              ? 'Acesso bloqueado manualmente. Registre um pagamento ou reative o toggle.'
              : 'O acesso é controlado pelos pagamentos confirmados aqui.'}
          </Text>
        </View>
        <Switch
          value={!accessBlocked}
          onValueChange={toggleAcessoManual}
          disabled={togglingAccess}
          trackColor={{ false: colors.border, true: colors.accentGlow }}
          thumbColor={!accessBlocked ? colors.accent : colors.textDim}
        />
      </View>

      {/* Aviso de bloqueio automático */}
      <View style={styles.infoBox}>
        <Feather name="shield" size={14} color={colors.accent} style={{ marginTop: 1 }} />
        <Text style={styles.infoText}>
          O acesso depende exclusivamente dos pagamentos que você confirmar. Cada mês registrado libera
          acesso por 30 dias a partir do vencimento anterior. Excluir um pagamento recalcula o acesso automaticamente.
        </Text>
      </View>

      {/* Registrar pagamento */}
      <View style={styles.registerBox}>
        <Text style={styles.registerLabel}>Registrar pagamento</Text>
        <Text style={styles.registerHint}>Selecione o mês de referência antes de confirmar</Text>

        {/* Seletor de mês */}
        <View style={styles.monthSelector}>
          {monthOptions.map((opt, idx) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.monthOption, !useCustomMonth && selectedMonthIndex === idx && styles.monthOptionActive]}
              onPress={() => {
                setUseCustomMonth(false);
                setSelectedMonthIndex(idx);
              }}
            >
              <Text style={[styles.monthOptionText, !useCustomMonth && selectedMonthIndex === idx && styles.monthOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Outro mês (qualquer mês passado ou futuro, pra guardar no histórico) */}
          <TouchableOpacity
            style={[styles.monthOption, useCustomMonth && styles.monthOptionActive]}
            onPress={() => setUseCustomMonth(true)}
          >
            <Text style={[styles.monthOptionText, useCustomMonth && styles.monthOptionTextActive]}>
              Outro mês (anterior ou futuro)
            </Text>
          </TouchableOpacity>

          {useCustomMonth && (
            <View style={styles.customMonthRow}>
              <TouchableOpacity
                style={styles.customMonthNavBtn}
                onPress={() => setCustomMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <Feather name="chevron-left" size={16} color={colors.textDim} />
              </TouchableOpacity>
              <Text style={styles.customMonthLabel}>
                {customMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                style={styles.customMonthNavBtn}
                onPress={() => setCustomMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <Feather name="chevron-right" size={16} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <TextInput
            style={styles.amountInput}
            placeholder={student?.monthly_fee ? `R$ ${Number(student.monthly_fee).toFixed(2)}` : 'R$ (opcional)'}
            placeholderTextColor={colors.textDim2}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <TouchableOpacity style={styles.registerButton} onPress={registrarPagamento} disabled={saving} activeOpacity={0.85}>
            <Text style={styles.registerButtonText}>{saving ? '...' : 'Confirmar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Histórico */}
      <Text style={styles.historyTitle}>Histórico de pagamentos</Text>
      <Text style={styles.historyHint}>Toque no lixo para remover um lançamento incorreto</Text>

      {payments.length === 0 && (
        <Text style={styles.empty}>Nenhum pagamento registrado ainda.</Text>
      )}

      {payments.map((item) => {
        const isConfirmed = item.status === 'confirmado';
        const isDeleting = confirmDeleteId === item.id;

        return (
          <View key={item.id} style={[styles.card, isDeleting && styles.cardDeleting]}>
            {/* Confirmação de exclusão inline */}
            {isDeleting ? (
              <View style={styles.deleteConfirm}>
                <Text style={styles.deleteConfirmText}>Remover este lançamento?</Text>
                <Text style={styles.deleteConfirmSub}>O acesso será recalculado automaticamente.</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={styles.btnCancel}
                    onPress={() => setConfirmDeleteId(null)}
                  >
                    <Text style={styles.btnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnDelete}
                    onPress={() => excluirPagamento(item.id)}
                    disabled={deleting}
                  >
                    <Text style={styles.btnDeleteText}>{deleting ? '...' : 'Remover'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.cardIcon}>
                  <Feather name="credit-card" size={16} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{monthLabel(item.reference_month)}</Text>
                  {item.amount ? (
                    <Text style={styles.cardSubtitle}>R$ {Number(item.amount).toFixed(2)}</Text>
                  ) : null}
                  {item.confirmed_at && (
                    <Text style={styles.cardMeta}>
                      Confirmado em {formatDate(item.confirmed_at)}
                    </Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: isConfirmed ? colors.accentGlow : colors.amberGlow }]}>
                  <Text style={[styles.badgeText, { color: isConfirmed ? colors.accent : colors.amber }]}>
                    {isConfirmed ? 'Pago' : 'Pendente'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.trashBtn}
                  onPress={() => setConfirmDeleteId(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={15} color={colors.textDim} />
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, marginBottom: vs(16) },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: vs(14) },
  summaryCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  summaryLabel: { color: colors.textDim, fontSize: fs(9), marginBottom: vs(4) },
  summaryValue: { color: colors.text, fontSize: fs(13), fontWeight: '700' },
  summaryMeta: { color: colors.textDim, fontSize: fs(9), marginTop: vs(2) },

  feeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(12),
  },
  feeValue: { color: colors.text, fontSize: fs(13), fontWeight: '700', marginTop: vs(4) },

  accessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(12),
  },
  accessTitle: { color: colors.text, fontSize: fs(12), fontWeight: '600' },
  accessSub: { color: colors.textDim, fontSize: fs(10), marginTop: vs(2), lineHeight: 16 },

  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: vs(14),
  },
  infoText: { color: colors.textDim, fontSize: fs(10), lineHeight: 17, flex: 1 },

  registerBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(16),
  },
  registerLabel: { color: colors.textDim, fontSize: fs(10), marginBottom: vs(4) },
  registerHint: { color: colors.textFaint, fontSize: fs(9), marginBottom: vs(10) },

  monthSelector: { gap: 6 },
  monthOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: vs(8),
    paddingHorizontal: s(12),
  },
  monthOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  monthOptionText: { color: colors.textDim, fontSize: fs(11) },
  monthOptionTextActive: { color: colors.accent, fontWeight: '600' },

  customMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: s(10),
    paddingVertical: vs(6),
    marginTop: vs(2),
  },
  customMonthNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMonthLabel: { color: colors.text, fontSize: fs(12), fontWeight: '700', textTransform: 'capitalize' },

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
  registerButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm - 4,
    paddingHorizontal: s(16),
    justifyContent: 'center',
  },
  registerButtonText: { color: '#04170F', fontWeight: '700' },

  historyTitle: { color: colors.textDim, fontSize: fs(10), fontWeight: '700', textTransform: 'uppercase', marginBottom: vs(2) },
  historyHint: { color: colors.textFaint, fontSize: fs(9), marginBottom: vs(10) },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(40), fontSize: fs(12) },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardDeleting: {
    borderColor: colors.red,
    backgroundColor: 'rgba(255,90,122,0.06)',
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.text, fontSize: fs(12), fontWeight: '700', textTransform: 'capitalize' },
  cardSubtitle: { color: colors.textDim, fontSize: fs(10), marginTop: vs(2) },
  cardMeta: { color: colors.textFaint, fontSize: fs(9), marginTop: vs(2) },
  badge: { paddingHorizontal: s(10), paddingVertical: vs(5), borderRadius: radius.pill },
  badgeText: { fontSize: fs(9), fontWeight: '700' },
  trashBtn: {
    padding: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: colors.border,
  },

  deleteConfirm: { flex: 1 },
  deleteConfirmText: { color: colors.red, fontSize: fs(12), fontWeight: '700' },
  deleteConfirmSub: { color: colors.textDim, fontSize: fs(10), marginTop: vs(2) },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    paddingVertical: vs(8),
    alignItems: 'center',
  },
  btnCancelText: { color: colors.textDim, fontSize: fs(11) },
  btnDelete: {
    flex: 1,
    backgroundColor: colors.red,
    borderRadius: radius.sm - 4,
    paddingVertical: vs(8),
    alignItems: 'center',
  },
  btnDeleteText: { color: '#fff', fontSize: fs(11), fontWeight: '700' },
});
