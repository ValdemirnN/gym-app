import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

const STATUS_LABEL = {
  aprovado: { text: 'Ativo', color: colors.accent, glow: colors.accentGlow },
  pendente: { text: 'Pendente de pagamento', color: colors.amber, glow: colors.amberGlow },
  recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function FieldCard({ label, value }) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || 'Não informado'}</Text>
    </View>
  );
}

export default function StudentRegistrationScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const [student, setStudent] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', studentId).single();
    setStudent(data);
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const status = STATUS_LABEL[student?.status] || STATUS_LABEL.pendente;
  const diasVinculado = student?.created_at
    ? Math.floor((Date.now() - new Date(student.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Dados cadastrais</Text>

      <View style={[styles.badge, { backgroundColor: status.glow, marginBottom: 16 }]}>
        <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
      </View>

      <FieldCard label="Nome" value={student?.name} />
      <FieldCard label="E-mail" value={student?.email} />
      <FieldCard label="Aluno desde" value={formatDate(student?.created_at)} />
      <FieldCard label="Vinculado há" value={diasVinculado !== null ? `${diasVinculado} dia(s)` : null} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontSize: 12, fontWeight: '700' },
  fieldCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 10.5,
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldValue: { fontSize: 14.5, color: colors.text, fontWeight: '600' },
});
