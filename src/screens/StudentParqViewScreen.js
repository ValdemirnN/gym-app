import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

const QUESTIONS = [
  { key: 'q1', text: 'Algum médico já disse que possui um problema cardíaco e recomendou supervisão médica pra atividade física?' },
  { key: 'q2', text: 'Sente dor no peito quando pratica atividade física?' },
  { key: 'q3', text: 'No último mês, sentiu dor no peito mesmo sem praticar atividade física?' },
  { key: 'q4', text: 'Perde o equilíbrio por tontura ou já perdeu a consciência?' },
  { key: 'q5', text: 'Tem algum problema ósseo/articular que pode piorar com mudança na atividade física?' },
  { key: 'q6', text: 'Algum médico recomendou medicamento pra pressão arterial ou coração?' },
  { key: 'q7', text: 'Conhece alguma outra razão pra não praticar atividade física?' },
];

function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('pt-BR');
}

export default function StudentParqViewScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('parq_responses')
      .select('*')
      .eq('student_id', studentId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setResponse(data);
    setLoading(false);
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>PAR-Q</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : !response ? (
        <Text style={styles.empty}>Esse aluno ainda não respondeu o questionário de saúde.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[styles.statusCard, { backgroundColor: response.has_risk ? colors.redGlow : colors.accentGlow }]}>
            <Feather name={response.has_risk ? 'alert-triangle' : 'check-circle'} size={18} color={response.has_risk ? colors.red : colors.accent} />
            <Text style={[styles.statusText, { color: response.has_risk ? colors.red : colors.accent }]}>
              {response.has_risk
                ? 'Alguma resposta indicou risco — recomenda-se liberação médica.'
                : 'Nenhum risco indicado nas respostas.'}
            </Text>
          </View>

          <Text style={styles.meta}>Assinado por {response.full_name_signature} em {formatDateTime(response.signed_at)}</Text>

          {QUESTIONS.map((q, i) => {
            const answer = response.answers?.[q.key];
            return (
              <View key={q.key} style={styles.questionRow}>
                <Text style={styles.questionText}>{i + 1}. {q.text}</Text>
                <Text style={[styles.answerBadge, answer === 'sim' ? styles.answerBadgeYes : styles.answerBadgeNo]}>
                  {answer === 'sim' ? 'Sim' : answer === 'nao' ? 'Não' : '-'}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  empty: { color: colors.textDim, fontSize: 13, marginTop: 20 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  statusText: { fontSize: 12.5, fontWeight: '600', flex: 1, lineHeight: 18 },
  meta: { color: colors.textDim, fontSize: 11.5, marginBottom: 16 },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  questionText: { color: colors.text, fontSize: 12.5, flex: 1, lineHeight: 17 },
  answerBadge: { fontSize: 11.5, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  answerBadgeYes: { color: colors.red, backgroundColor: colors.redGlow },
  answerBadgeNo: { color: colors.accent, backgroundColor: colors.accentGlow },
});
