import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

// ─── helpers ────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtBRL(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── mini-card ───────────────────────────────────────────────
function StatCard({ label, value, accent, icon, alert }) {
  return (
    <View style={[styles.card, alert && styles.cardAlert, accent && styles.cardAccent]}>
      <View style={styles.cardTop}>
        <Feather name={icon} size={15} color={alert ? colors.amber : accent ? colors.accent : colors.textDim} />
        <Text style={[styles.cardLabel, alert && { color: colors.amber }, accent && { color: colors.accent }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.cardValue, alert && { color: colors.amber }, accent && { color: colors.accent }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── seção de título ─────────────────────────────────────────
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Tenta a view pré-agregada primeiro (schema_v24)
      const { data: overview, error } = await supabase
        .from('admin_platform_overview')
        .select('*')
        .single();

      if (!error && overview) {
        setData(overview);
        return;
      }

      // Fallback manual se a view não existir ainda
      const [personals, clientes, payments, logs] = await Promise.all([
        supabase.from('profiles').select('id,status').eq('role','personal'),
        supabase.from('profiles').select('id,status,is_excluded').eq('role','cliente'),
        supabase.from('payments').select('amount,status,reference_month'),
        supabase.from('workout_logs').select('id,finished_at,skipped,started_at'),
      ]);

      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const semanaAtras = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const payMes = (payments.data || []).filter(p => p.reference_month >= mesInicio);

      setData({
        personals_ativos: (personals.data||[]).filter(p=>p.status==='aprovado').length,
        personals_pendentes: (personals.data||[]).filter(p=>p.status==='pendente').length,
        alunos_ativos: (clientes.data||[]).filter(c=>!c.is_excluded).length,
        alunos_pendentes: (clientes.data||[]).filter(c=>c.status==='pendente').length,
        receita_confirmada_mes: payMes.filter(p=>p.status==='confirmado').reduce((s,p)=>s+(p.amount||0),0),
        receita_pendente_mes: payMes.filter(p=>p.status==='pendente').reduce((s,p)=>s+(p.amount||0),0),
        pagamentos_pendentes_mes: payMes.filter(p=>p.status==='pendente').length,
        treinos_concluidos_semana: (logs.data||[]).filter(l=>l.finished_at && l.finished_at>=semanaAtras).length,
        treinos_pulados_semana: (logs.data||[]).filter(l=>l.skipped && l.started_at>=semanaAtras).length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Painel Admin</Text>
          <Text style={styles.subtitle}>Olá, {profile?.name} 👋</Text>
        </View>
        <View style={styles.roleChip}>
          <Feather name="shield" size={11} color={colors.accent} />
          <Text style={styles.roleChipText}>Admin</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* alerta pendentes */}
          {(data?.personals_pendentes > 0 || data?.pagamentos_pendentes_mes > 0) && (
            <View style={styles.alertBox}>
              <Feather name="alert-triangle" size={14} color={colors.amber} />
              <Text style={styles.alertText}>
                {[
                  data?.personals_pendentes > 0 && `${data.personals_pendentes} personal${data.personals_pendentes>1?'is':''} aguardando aprovação`,
                  data?.pagamentos_pendentes_mes > 0 && `${data.pagamentos_pendentes_mes} pagamento${data.pagamentos_pendentes_mes>1?'s':''} pendente${data.pagamentos_pendentes_mes>1?'s':''}`,
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}

          {/* personals & alunos */}
          <Section title="Plataforma">
            <View style={styles.grid}>
              <StatCard label="Personals ativos"    value={fmt(data?.personals_ativos)}   icon="briefcase" accent />
              <StatCard label="Aguardando aprovação" value={fmt(data?.personals_pendentes)} icon="clock"     alert={data?.personals_pendentes > 0} />
              <StatCard label="Alunos ativos"        value={fmt(data?.alunos_ativos)}       icon="users"     accent />
              <StatCard label="Alunos pendentes"     value={fmt(data?.alunos_pendentes)}    icon="user-x"    alert={data?.alunos_pendentes > 0} />
            </View>
          </Section>

          {/* financeiro */}
          <Section title="Financeiro — mês atual">
            <View style={styles.grid}>
              <StatCard label="Receita confirmada" value={fmtBRL(data?.receita_confirmada_mes)} icon="check-circle" accent />
              <StatCard label="Receita pendente"   value={fmtBRL(data?.receita_pendente_mes)}   icon="dollar-sign"  alert={data?.pagamentos_pendentes_mes > 0} />
            </View>
          </Section>

          {/* atividade */}
          <Section title="Atividade — últimos 7 dias">
            <View style={styles.grid}>
              <StatCard label="Treinos concluídos" value={fmt(data?.treinos_concluidos_semana)} icon="check-square" accent />
              <StatCard label="Treinos pulados"     value={fmt(data?.treinos_pulados_semana)}    icon="x-square"    />
            </View>
          </Section>

          {/* taxa conclusão */}
          {(data?.treinos_concluidos_semana + data?.treinos_pulados_semana) > 0 && (() => {
            const total = data.treinos_concluidos_semana + data.treinos_pulados_semana;
            const pct = Math.round((data.treinos_concluidos_semana / total) * 100);
            return (
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Taxa de conclusão (semana)</Text>
                <Text style={styles.progressPct}>{pct}%</Text>
              </View>
            );
          })()}

          <Text style={styles.hint}>Puxe pra baixo para atualizar</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingTop: screenPaddingTop, paddingBottom: vs(40) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: vs(24) },
  greeting: { fontSize: fs(22), fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fs(11), color: colors.textDim, marginTop: vs(2) },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentGlow,
    borderRadius: radius.pill, paddingHorizontal: s(10), paddingVertical: vs(5), borderWidth: 1, borderColor: colors.accent + '44' },
  roleChipText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },

  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.amberGlow, borderRadius: radius.sm, padding: 14,
    marginBottom: vs(20), borderLeftWidth: 3, borderLeftColor: colors.amber },
  alertText: { color: colors.amber, fontSize: fs(11), flex: 1, lineHeight: 18 },

  section: { marginBottom: vs(24) },
  sectionTitle: { fontSize: fs(10), fontWeight: '700', color: colors.textDim,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: vs(10) },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47.5%', backgroundColor: colors.surface, borderRadius: radius.md,
    padding: 16, borderWidth: 1, borderColor: colors.border },
  cardAlert: { borderColor: colors.amber, backgroundColor: colors.amberGlow },
  cardAccent: { borderColor: colors.accent + '55' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: vs(10) },
  cardLabel: { fontSize: fs(9), color: colors.textDim, flex: 1 },
  cardValue: { fontSize: fs(24), fontWeight: '800', color: colors.text },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.sm, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: vs(24) },
  progressLabel: { fontSize: fs(11), color: colors.textDim },
  progressPct: { fontSize: fs(18), fontWeight: '800', color: colors.accent },

  hint: { textAlign: 'center', color: colors.textFaint, fontSize: fs(9), marginTop: vs(8) },
});
