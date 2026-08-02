import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';

const MEASURE_FIELDS = [
  { key: 'chest', label: 'Peito (cm)' },
  { key: 'waist', label: 'Cintura (cm)' },
  { key: 'hip', label: 'Quadril (cm)' },
  { key: 'arm', label: 'Braço (cm)' },
  { key: 'thigh', label: 'Coxa (cm)' },
  { key: 'calf', label: 'Panturrilha (cm)' },
];

function formatDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function StudentEvaluationsScreen({ route, navigation }) {
  const { studentId, studentName } = route.params;
  const { session } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [goals, setGoals] = useState([]);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [measurements, setMeasurements] = useState({});
  const [notes, setNotes] = useState('');

  const [goalDesc, setGoalDesc] = useState('');
  const [goalDate, setGoalDate] = useState('');

  const load = useCallback(async () => {
    const { data: evals } = await supabase
      .from('evaluations')
      .select('*')
      .eq('student_id', studentId)
      .order('evaluation_date', { ascending: false });
    setEvaluations(evals || []);

    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    setGoals(goalsData || []);
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const resetEvalForm = () => {
    setWeight('');
    setBodyFat('');
    setMeasurements({});
    setNotes('');
  };

  const handleSaveEvaluation = async () => {
    setSaving(true);
    const { error } = await supabase.from('evaluations').insert({
      student_id: studentId,
      personal_id: session.user.id,
      weight_kg: weight ? parseFloat(weight.replace(',', '.')) : null,
      body_fat_pct: bodyFat ? parseFloat(bodyFat.replace(',', '.')) : null,
      measurements,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setShowEvalModal(false);
    resetEvalForm();
    load();
  };

  const handleSaveGoal = async () => {
    if (!goalDesc.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('goals').insert({
      student_id: studentId,
      personal_id: session.user.id,
      description: goalDesc.trim(),
      target_date: goalDate.trim() || null,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    setShowGoalModal(false);
    setGoalDesc('');
    setGoalDate('');
    load();
  };

  const toggleAchieved = async (goal) => {
    const { error } = await supabase
      .from('goals')
      .update({ achieved: !goal.achieved, achieved_at: !goal.achieved ? new Date().toISOString() : null })
      .eq('id', goal.id);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    load();
  };

  const first = evaluations[evaluations.length - 1];
  const last = evaluations[0];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{studentName || 'Aluno'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Avaliações físicas</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {evaluations.length >= 2 && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Progresso (primeira → última avaliação)</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Peso</Text>
              <Text style={styles.progressValue}>
                {first?.weight_kg ?? '-'} kg → {last?.weight_kg ?? '-'} kg
              </Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>% Gordura</Text>
              <Text style={styles.progressValue}>
                {first?.body_fat_pct ?? '-'}% → {last?.body_fat_pct ?? '-'}%
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Metas</Text>
          <TouchableOpacity onPress={() => setShowGoalModal(true)}>
            <Feather name="plus-circle" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
        {goals.length === 0 && <Text style={styles.empty}>Nenhuma meta cadastrada ainda.</Text>}
        {goals.map((g) => (
          <TouchableOpacity key={g.id} style={styles.goalRow} onPress={() => toggleAchieved(g)}>
            <Feather
              name={g.achieved ? 'check-circle' : 'circle'}
              size={20}
              color={g.achieved ? colors.accent : colors.textDim2}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalText, g.achieved && styles.goalTextDone]}>{g.description}</Text>
              {g.target_date ? <Text style={styles.goalDate}>Até {formatDate(g.target_date)}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Histórico de avaliações</Text>
          <TouchableOpacity onPress={() => setShowEvalModal(true)}>
            <Feather name="plus-circle" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
        {evaluations.length === 0 && <Text style={styles.empty}>Nenhuma avaliação registrada ainda.</Text>}
        {evaluations.map((ev) => (
          <View key={ev.id} style={styles.evalCard}>
            <Text style={styles.evalDate}>{formatDate(ev.evaluation_date)}</Text>
            <View style={styles.evalGrid}>
              {ev.weight_kg ? <Text style={styles.evalItem}>Peso: {ev.weight_kg} kg</Text> : null}
              {ev.body_fat_pct ? <Text style={styles.evalItem}>Gordura: {ev.body_fat_pct}%</Text> : null}
              {MEASURE_FIELDS.map((f) =>
                ev.measurements?.[f.key] ? (
                  <Text key={f.key} style={styles.evalItem}>
                    {f.label.replace(' (cm)', '')}: {ev.measurements[f.key]} cm
                  </Text>
                ) : null
              )}
            </View>
            {ev.notes ? <Text style={styles.evalNotes}>{ev.notes}</Text> : null}
          </View>
        ))}
      </ScrollView>

      {/* Modal: nova avaliação */}
      <Modal visible={showEvalModal} transparent animationType="slide" onRequestClose={() => setShowEvalModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nova avaliação física</Text>

            <Text style={styles.fieldLabel}>Peso (kg)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={weight} onChangeText={setWeight} placeholder="Ex: 78,5" placeholderTextColor={colors.textDim2} />

            <Text style={styles.fieldLabel}>% Gordura corporal</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={bodyFat} onChangeText={setBodyFat} placeholder="Ex: 18,2" placeholderTextColor={colors.textDim2} />

            <Text style={[styles.fieldLabel, { marginTop: 6 }]}>Medidas (cm)</Text>
            {MEASURE_FIELDS.map((f) => (
              <View key={f.key} style={{ marginBottom: 8 }}>
                <Text style={styles.fieldLabelSmall}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={measurements[f.key] || ''}
                  onChangeText={(v) => setMeasurements((prev) => ({ ...prev, [f.key]: v }))}
                  placeholderTextColor={colors.textDim2}
                />
              </View>
            ))}

            <Text style={styles.fieldLabel}>Observações</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              multiline
              value={notes}
              onChangeText={setNotes}
              placeholderTextColor={colors.textDim2}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveEvaluation} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar avaliação'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowEvalModal(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: nova meta */}
      <Modal visible={showGoalModal} transparent animationType="slide" onRequestClose={() => setShowGoalModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nova meta</Text>
            <Text style={styles.fieldLabel}>Descrição</Text>
            <TextInput
              style={styles.input}
              value={goalDesc}
              onChangeText={setGoalDesc}
              placeholder="Ex: Perder 5kg, chegar a 15% de gordura..."
              placeholderTextColor={colors.textDim2}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Data alvo (opcional, AAAA-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={goalDate}
              onChangeText={setGoalDate}
              placeholder="2026-12-31"
              placeholderTextColor={colors.textDim2}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveGoal} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar meta'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowGoalModal(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  empty: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  progressCard: { backgroundColor: colors.accentGlow, borderRadius: radius.md, padding: 14 },
  progressTitle: { color: colors.accent, fontSize: 12.5, fontWeight: '700', marginBottom: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { color: colors.textDim, fontSize: 13 },
  progressValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  goalText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  goalTextDone: { textDecorationLine: 'line-through', color: colors.textDim },
  goalDate: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  evalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  evalDate: { color: colors.accent, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  evalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  evalItem: { color: colors.text, fontSize: 12.5 },
  evalNotes: { color: colors.textDim, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  fieldLabel: { color: colors.textDim, fontSize: 12.5, marginBottom: 6, marginTop: 4, fontWeight: '600' },
  fieldLabelSmall: { color: colors.textDim2, fontSize: 11.5, marginBottom: 4 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#04170F', fontWeight: '700', fontSize: 14 },
  modalClose: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  modalCloseText: { color: colors.textDim, fontSize: 13 },
});
