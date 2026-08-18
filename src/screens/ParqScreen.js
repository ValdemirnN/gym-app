import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

const QUESTIONS = [
  { key: 'q1', text: 'Algum médico já disse que você possui um problema cardíaco e recomendou que você só praticasse atividade física sob supervisão médica?' },
  { key: 'q2', text: 'Você sente dor no peito quando pratica atividade física?' },
  { key: 'q3', text: 'No último mês, você sentiu dor no peito mesmo sem estar praticando atividade física?' },
  { key: 'q4', text: 'Você perde o equilíbrio por causa de tontura ou já perdeu a consciência?' },
  { key: 'q5', text: 'Você tem algum problema ósseo ou articular que pode piorar com uma mudança na sua atividade física?' },
  { key: 'q6', text: 'Algum médico já recomendou o uso de medicamentos para pressão arterial ou para o coração?' },
  { key: 'q7', text: 'Você conhece alguma outra razão pela qual não deveria praticar atividade física?' },
];

function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('pt-BR');
}

export default function ParqScreen({ navigation, route }) {
  const { session, profile } = useAuth();
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('parq_responses')
      .select('*')
      .eq('student_id', session.user.id)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setExisting(data);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const allAnswered = QUESTIONS.every((q) => answers[q.key] === 'sim' || answers[q.key] === 'nao');

  const handleSubmit = async () => {
    if (!allAnswered) {
      Alert.alert('Faltou responder', 'Responde todas as perguntas antes de continuar.');
      return;
    }
    if (!signature.trim()) {
      Alert.alert('Faltou assinar', 'Digite seu nome completo como assinatura digital.');
      return;
    }
    const hasRisk = Object.values(answers).some((a) => a === 'sim');
    setSaving(true);
    const { error } = await supabase.from('parq_responses').insert({
      student_id: session.user.id,
      personal_id: profile?.personal_id,
      answers,
      has_risk: hasRisk,
      full_name_signature: signature.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    load();
    if (hasRisk) {
      Alert.alert(
        'Atenção',
        'Uma ou mais respostas indicam que é importante conversar com um médico antes de iniciar os treinos. Seu personal foi avisado.'
      );
    } else {
      Alert.alert('Tudo certo!', 'Seu questionário foi registrado.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Questionário de saúde (PAR-Q)</Text>
      <Text style={styles.subtitle}>
        Esse questionário ajuda a identificar se você precisa de liberação médica antes de começar a treinar. Suas
        respostas ficam registradas e visíveis pro seu personal.
      </Text>

      {existing && (
        <View style={styles.existingCard}>
          <Feather name="check-circle" size={16} color={colors.accent} />
          <Text style={styles.existingText}>
            {' '}Você já respondeu em {formatDateTime(existing.signed_at)}
            {existing.has_risk ? ' — foi sinalizado que vale a pena conversar com um médico.' : '.'}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.sectionTitle}>{existing ? 'Responder de novo' : 'Responda com sinceridade:'}</Text>
        {QUESTIONS.map((q, i) => (
          <View key={q.key} style={styles.questionCard}>
            <Text style={styles.questionText}>{i + 1}. {q.text}</Text>
            <View style={styles.answerRow}>
              <TouchableOpacity
                style={[styles.answerButton, answers[q.key] === 'sim' && styles.answerButtonActive]}
                onPress={() => setAnswers((prev) => ({ ...prev, [q.key]: 'sim' }))}
              >
                <Text style={[styles.answerText, answers[q.key] === 'sim' && styles.answerTextActive]}>Sim</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.answerButton, answers[q.key] === 'nao' && styles.answerButtonActive]}
                onPress={() => setAnswers((prev) => ({ ...prev, [q.key]: 'nao' }))}
              >
                <Text style={[styles.answerText, answers[q.key] === 'nao' && styles.answerTextActive]}>Não</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Assinatura digital</Text>
        <Text style={styles.signatureHint}>Digite seu nome completo — isso vale como sua assinatura nesse formulário.</Text>
        <TextInput
          style={styles.input}
          value={signature}
          onChangeText={setSignature}
          placeholder="Seu nome completo"
          placeholderTextColor={colors.textDim2}
        />

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.submitButtonText}>{saving ? 'Enviando...' : 'Enviar respostas'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(10), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(18), fontWeight: '800', color: colors.text, marginBottom: vs(8) },
  subtitle: { color: colors.textDim, fontSize: fs(10.5), lineHeight: 18, marginBottom: vs(14) },
  existingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: vs(16),
  },
  existingText: { color: colors.accent, fontSize: fs(10), flex: 1, lineHeight: 17 },
  sectionTitle: { color: colors.textDim, fontSize: fs(10), fontWeight: '700', textTransform: 'uppercase', marginBottom: vs(10), marginTop: vs(6) },
  questionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(10),
  },
  questionText: { color: colors.text, fontSize: fs(11.5), lineHeight: 19, marginBottom: vs(12) },
  answerRow: { flexDirection: 'row', gap: 10 },
  answerButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: vs(9),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  answerButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  answerText: { color: colors.textDim, fontSize: fs(11), fontWeight: '600' },
  answerTextActive: { color: '#04170F' },
  signatureHint: { color: colors.textDim2, fontSize: fs(9.5), marginBottom: vs(8), marginTop: -6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: s(12),
    paddingVertical: vs(12),
    color: colors.text,
    fontSize: fs(12),
    marginBottom: vs(20),
  },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: vs(14), alignItems: 'center' },
  submitButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(12.5) },
});
