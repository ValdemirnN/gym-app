import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  return value;
}

function FieldCard({ label, value }) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function StudentHealthScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const [student, setStudent] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select(
        'chronic_conditions, other_chronic_condition, health_restrictions, frequent_pain, medications, health_conditions, sleep_hours, stress_level, is_smoker, drinks_alcohol, liability_waiver_accepted, medical_clearance_url'
      )
      .eq('id', studentId)
      .single();
    setStudent(data);
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const chronicConditions = student?.chronic_conditions || [];
  const conditionsLabel = chronicConditions.length
    ? chronicConditions
        .map((c) => (c === 'Outra' && student?.other_chronic_condition ? `Outra (${student.other_chronic_condition})` : c))
        .join(', ')
    : 'Nenhuma informada';
  const habitsLabel =
    [student?.is_smoker && 'Fumante', student?.drinks_alcohol && 'Consome álcool'].filter(Boolean).join(', ') || 'Nenhum';
  const clearanceLabel = student?.medical_clearance_url
    ? 'Documento enviado ✓'
    : student?.liability_waiver_accepted
    ? 'Termo de responsabilidade aceito'
    : 'Pendente';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Dados de saúde</Text>
      <View style={styles.readOnlyNotice}>
        <Feather name="lock" size={13} color={colors.textDim} />
        <Text style={styles.subtitle}>
          {' '}Informado pelo próprio aluno no cadastro. Você pode consultar, mas só o aluno pode alterar esses dados.
        </Text>
      </View>

      <Text style={styles.eyebrow}>Anamnese física</Text>
      <FieldCard label="Doenças crônicas / condições" value={conditionsLabel} />
      <FieldCard label="Histórico de lesões e cirurgias" value={displayValue(student?.health_restrictions)} />
      <FieldCard label="Dores frequentes" value={displayValue(student?.frequent_pain)} />
      <FieldCard label="Medicamentos de uso contínuo" value={displayValue(student?.medications)} />
      <FieldCard label="Outras observações de saúde" value={displayValue(student?.health_conditions)} />
      <FieldCard label="Horas de sono (média)" value={student?.sleep_hours ? `${student.sleep_hours}h` : 'Não informado'} />
      <FieldCard label="Nível de estresse" value={student?.stress_level ? `${student.stress_level}/5` : 'Não informado'} />
      <FieldCard label="Hábitos" value={habitsLabel} />

      <Text style={styles.eyebrow}>Liberação médica</Text>
      <FieldCard label="Atestado / termo" value={clearanceLabel} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, marginBottom: vs(10) },
  readOnlyNotice: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: vs(20) },
  subtitle: { color: colors.textDim, fontSize: fs(11), lineHeight: 18, flex: 1 },
  eyebrow: {
    color: colors.textDim2,
    fontWeight: '700',
    fontSize: fs(9.5),
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: vs(8),
    marginBottom: vs(10),
  },
  fieldCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: vs(13),
    paddingHorizontal: s(15),
    marginBottom: vs(10),
  },
  fieldLabel: {
    fontSize: fs(9),
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginBottom: vs(4),
  },
  fieldValue: { fontSize: fs(12.5), color: colors.text, fontWeight: '600' },
});
