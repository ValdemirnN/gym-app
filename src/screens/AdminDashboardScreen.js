import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';

export default function AdminDashboardScreen() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    personalsPendentes: 0,
    personalsAtivos: 0,
    totalAlunos: 0,
    alunosPendentes: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: personals } = await supabase.from('profiles').select('id, status').eq('role', 'personal');
    const { data: clientes } = await supabase.from('profiles').select('id, status').eq('role', 'cliente');

    setStats({
      personalsPendentes: personals?.filter((p) => p.status === 'pendente').length || 0,
      personalsAtivos: personals?.filter((p) => p.status === 'aprovado').length || 0,
      totalAlunos: clientes?.length || 0,
      alunosPendentes: clientes?.filter((c) => c.status === 'pendente').length || 0,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={styles.greeting}>Painel do Admin</Text>
      <Text style={styles.subtitle}>Olá, {profile?.name} 👋</Text>

      <View style={styles.grid}>
        <View style={[styles.card, stats.personalsPendentes > 0 && styles.cardAlert]}>
          <Text style={styles.cardValue}>{stats.personalsPendentes}</Text>
          <Text style={styles.cardLabel}>Personals aguardando aprovação</Text>
        </View>
        <View style={[styles.card, styles.cardGreen]}>
          <Text style={styles.cardValue}>{stats.personalsAtivos}</Text>
          <Text style={styles.cardLabel}>Personals ativos</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{stats.totalAlunos}</Text>
          <Text style={styles.cardLabel}>Alunos no total (todos personals)</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{stats.alunosPendentes}</Text>
          <Text style={styles.cardLabel}>Alunos pendentes de pagamento</Text>
        </View>
      </View>

      {stats.personalsPendentes > 0 && (
        <View style={styles.tip}>
          <Feather name="alert-triangle" size={15} color={colors.amber} />
          <Text style={styles.tipText}>
            {' '}Você tem {stats.personalsPendentes} Personal{stats.personalsPendentes > 1 ? 's' : ''} esperando aprovação.
            Vá até a aba "Personals" para revisar.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textDim, marginTop: 4, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGreen: { borderColor: colors.accent },
  cardAlert: { borderColor: colors.amber },
  cardValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  cardLabel: { fontSize: 12, color: colors.textDim, marginTop: 4 },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.amberGlow,
    borderRadius: radius.sm,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },
  tipText: { color: colors.amber, fontSize: 13, lineHeight: 19, flex: 1 },
});
