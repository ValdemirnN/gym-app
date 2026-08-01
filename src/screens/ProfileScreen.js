import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';

const IMAGE_MIME_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
function getImageContentType(uri) {
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  return IMAGE_MIME_TYPES[ext] || 'image/jpeg';
}

const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];
const GOAL_OPTIONS = ['Emagrecimento', 'Hipertrofia', 'Condicionamento geral', 'TAF', 'Qualidade de vida'];
const ACTIVITY_LEVEL_OPTIONS = ['Sedentário', 'Levemente ativo', 'Moderado', 'Muito ativo'];
const CHRONIC_CONDITION_OPTIONS = ['Hipertensão', 'Diabetes', 'Asma', 'Cardiopatia', 'Outra'];
const STRESS_LEVEL_OPTIONS = [1, 2, 3, 4, 5];

// ---- helpers de data (exibida como DD/MM/AAAA, salva como AAAA-MM-DD) ----
function isoToBr(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
function maskDateInput(text) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}
function brToIso(br) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((br || '').trim());
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

// Aceita altura digitada tanto em metros ("1,79" ou "1.79") quanto em
// centímetros ("179"). Se o número for menor que 3, assume que é metros
// (ninguém tem 2cm de altura) e converte pra cm antes de salvar.
function normalizeHeightToCm(value) {
  const parsed = parseFloat(String(value).replace(',', '.'));
  if (!parsed) return null;
  return parsed < 3 ? Math.round(parsed * 100) : Math.round(parsed);
}

// Pequeno "não informado" padrão pra qualquer campo vazio no modo visualização.
function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  return value;
}

// Card de campo somente-leitura, igual ao da tela de perfil do personal.
function FieldCard({ label, value }) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);

  // Dados pessoais
  const [name, setName] = useState('');
  const [birthDateBr, setBirthDateBr] = useState('');
  const [gender, setGender] = useState(null);

  // Contato
  const [phone, setPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Biometria / objetivo
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [goal, setGoal] = useState(null);
  const [activityLevel, setActivityLevel] = useState(null);

  // Anamnese física (PAR-Q)
  const [chronicConditions, setChronicConditions] = useState([]);
  const [otherChronicCondition, setOtherChronicCondition] = useState('');
  const [injurySurgeryHistory, setInjurySurgeryHistory] = useState(''); // health_restrictions
  const [frequentPain, setFrequentPain] = useState('');
  const [medications, setMedications] = useState('');
  const [otherHealthNotes, setOtherHealthNotes] = useState(''); // health_conditions
  const [sleepHours, setSleepHours] = useState('');
  const [stressLevel, setStressLevel] = useState(null);
  const [isSmoker, setIsSmoker] = useState(false);
  const [drinksAlcohol, setDrinksAlcohol] = useState(false);

  // Liberação médica
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [medicalClearanceUrl, setMedicalClearanceUrl] = useState(null);

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingClearance, setUploadingClearance] = useState(false);

  const loadFromProfile = () => {
    if (!profile) return;
    setName(profile.name || '');
    setBirthDateBr(isoToBr(profile.birth_date));
    setGender(profile.gender || null);

    setPhone(profile.phone || '');
    setEmergencyContactName(profile.emergency_contact_name || '');
    setEmergencyContactPhone(profile.emergency_contact_phone || '');

    setHeight(profile.height_cm ? String(profile.height_cm) : '');
    setWeight(profile.weight_kg ? String(profile.weight_kg) : '');
    setBodyFatPct(profile.body_fat_pct != null ? String(profile.body_fat_pct) : '');
    setGoal(profile.goal || null);
    setActivityLevel(profile.activity_level || null);

    setChronicConditions(profile.chronic_conditions || []);
    setOtherChronicCondition(profile.other_chronic_condition || '');
    setInjurySurgeryHistory(profile.health_restrictions || '');
    setFrequentPain(profile.frequent_pain || '');
    setMedications(profile.medications || '');
    setOtherHealthNotes(profile.health_conditions || '');
    setSleepHours(profile.sleep_hours != null ? String(profile.sleep_hours) : '');
    setStressLevel(profile.stress_level || null);
    setIsSmoker(!!profile.is_smoker);
    setDrinksAlcohol(!!profile.drinks_alcohol);

    setWaiverAccepted(!!profile.liability_waiver_accepted);
    setMedicalClearanceUrl(profile.medical_clearance_url || null);
  };

  useEffect(() => {
    loadFromProfile();
  }, [profile]);

  const toggleChronicCondition = (option) => {
    setChronicConditions((current) =>
      current.includes(option) ? current.filter((c) => c !== option) : [...current, option]
    );
  };

  const cancelEdit = () => {
    loadFromProfile();
    setEditing(false);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Informe seu nome.');
      return;
    }
    let birthDateIso = null;
    if (birthDateBr) {
      birthDateIso = brToIso(birthDateBr);
      if (!birthDateIso) {
        Alert.alert('Atenção', 'Data de nascimento inválida. Use o formato DD/MM/AAAA.');
        return;
      }
    }
    if (!waiverAccepted) {
      Alert.alert('Atenção', 'Você precisa aceitar o termo de responsabilidade para salvar o perfil.');
      return;
    }

    setSaving(true);
    const wasAccepted = !!profile?.liability_waiver_accepted;
    const { error } = await supabase
      .from('profiles')
      .update({
        name,
        birth_date: birthDateIso,
        gender,

        phone: phone || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,

        height_cm: height ? normalizeHeightToCm(height) : null,
        weight_kg: weight ? parseFloat(weight.replace(',', '.')) : null,
        body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct.replace(',', '.')) : null,
        goal,
        activity_level: activityLevel,

        chronic_conditions: chronicConditions,
        other_chronic_condition: chronicConditions.includes('Outra') ? otherChronicCondition || null : null,
        health_restrictions: injurySurgeryHistory || null,
        frequent_pain: frequentPain || null,
        medications: medications || null,
        health_conditions: otherHealthNotes || null,
        sleep_hours: sleepHours ? parseFloat(sleepHours.replace(',', '.')) : null,
        stress_level: stressLevel,
        is_smoker: isSmoker,
        drinks_alcohol: drinksAlcohol,

        liability_waiver_accepted: waiverAccepted,
        liability_waiver_accepted_at: waiverAccepted && !wasAccepted ? new Date().toISOString() : undefined,
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      await refreshProfile();
      setEditing(false);
      Alert.alert('Sucesso', 'Perfil atualizado!');
    }
  };

  const changePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos para continuar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;

    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const bytes = await new File(uri).bytes();
      const contentType = getImageContentType(uri);
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
      const path = `${session.user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Sem isso, a url fica em cache e a foto antiga continua aparecendo no app
      const cacheBustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: cacheBustedUrl })
        .eq('id', session.user.id);
      if (updateError) throw updateError;

      await refreshProfile();
    } catch (e) {
      Alert.alert('Erro ao atualizar foto', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Atestado médico / termo assinado: aceita foto (o app não lê PDF, mas o
  // aluno pode tirar foto do documento físico ou de uma tela com o PDF aberto).
  const uploadMedicalClearance = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos para continuar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    setUploadingClearance(true);
    try {
      const uri = result.assets[0].uri;
      const bytes = await new File(uri).bytes();
      const contentType = getImageContentType(uri);
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
      const path = `${session.user.id}/atestado.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('medical-documents')
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      // bucket é privado: guardamos o caminho e geramos uma URL assinada pra visualizar
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('medical-documents')
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedUrlError) throw signedUrlError;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ medical_clearance_url: path })
        .eq('id', session.user.id);
      if (updateError) throw updateError;

      setMedicalClearanceUrl(path);
      await refreshProfile();
      Alert.alert('Sucesso', 'Atestado/termo enviado com sucesso.');
      void signedUrlData;
    } catch (e) {
      Alert.alert('Erro ao enviar atestado', e.message);
    } finally {
      setUploadingClearance(false);
    }
  };

  // ==========================================================================
  // MODO VISUALIZAÇÃO — somente leitura, igual ao padrão da tela do personal.
  // ==========================================================================
  if (!editing) {
    const conditionsLabel = chronicConditions.length
      ? chronicConditions
          .map((c) => (c === 'Outra' && otherChronicCondition ? `Outra (${otherChronicCondition})` : c))
          .join(', ')
      : 'Nenhuma informada';
    const habitsLabel = [isSmoker && 'Fumante', drinksAlcohol && 'Consome álcool'].filter(Boolean).join(', ') || 'Nenhum';
    const clearanceLabel = medicalClearanceUrl
      ? 'Documento enviado ✓'
      : waiverAccepted
      ? 'Termo de responsabilidade aceito'
      : 'Pendente';

    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
        <Text style={styles.title}>Meu Perfil</Text>

        <View style={styles.profileCard}>
          <Avatar uri={profile?.avatar_url} size={84} />
          <Text style={styles.profileName}>{displayValue(name)}</Text>
          <Text style={styles.profileSub}>{session.user.email}</Text>
          <TouchableOpacity style={styles.editChip} onPress={() => setEditing(true)}>
            <Text style={styles.editChipText}>✎ Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.eyebrow}>Dados pessoais</Text>
        <FieldCard label="Data de nascimento" value={displayValue(birthDateBr)} />
        <FieldCard label="Gênero" value={displayValue(gender)} />

        <Text style={styles.eyebrow}>Contato</Text>
        <FieldCard label="Telefone" value={displayValue(phone)} />
        <FieldCard label="Contato de emergência" value={displayValue(emergencyContactName)} />
        <FieldCard label="Telefone de emergência" value={displayValue(emergencyContactPhone)} />

        <Text style={styles.eyebrow}>Biometria e objetivo</Text>
        <FieldCard label="Altura" value={height ? `${height} cm` : 'Não informado'} />
        <FieldCard label="Peso" value={weight ? `${weight} kg` : 'Não informado'} />
        <FieldCard label="Percentual de gordura" value={bodyFatPct ? `${bodyFatPct}%` : 'Não informado'} />
        <FieldCard label="Objetivo principal" value={displayValue(goal)} />
        <FieldCard label="Nível de atividade" value={displayValue(activityLevel)} />

        <Text style={styles.eyebrow}>Saúde (anamnese física)</Text>
        <FieldCard label="Doenças crônicas / condições" value={conditionsLabel} />
        <FieldCard label="Histórico de lesões e cirurgias" value={displayValue(injurySurgeryHistory)} />
        <FieldCard label="Dores frequentes" value={displayValue(frequentPain)} />
        <FieldCard label="Medicamentos de uso contínuo" value={displayValue(medications)} />
        <FieldCard label="Outras observações de saúde" value={displayValue(otherHealthNotes)} />
        <FieldCard label="Horas de sono (média)" value={sleepHours ? `${sleepHours}h` : 'Não informado'} />
        <FieldCard label="Nível de estresse" value={stressLevel ? `${stressLevel}/5` : 'Não informado'} />
        <FieldCard label="Hábitos" value={habitsLabel} />

        <Text style={styles.eyebrow}>Liberação médica</Text>
        <FieldCard label="Atestado / termo" value={clearanceLabel} />

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ==========================================================================
  // MODO EDIÇÃO — formulário completo, com Cancelar no topo.
  // ==========================================================================
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <View style={styles.editHeaderRow}>
        <TouchableOpacity onPress={cancelEdit}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Editar perfil</Text>
        <View style={{ width: 64 }} />
      </View>
      <Text style={styles.email}>{session.user.email}</Text>

      <View style={styles.photoRow}>
        <Avatar uri={profile?.avatar_url} size={84} />
        <TouchableOpacity onPress={changePhoto} disabled={uploadingPhoto} style={styles.photoButton}>
          {uploadingPhoto ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.photoButtonText}>Alterar foto</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ---- Dados pessoais ---- */}
      <Text style={styles.sectionTitle}>Dados pessoais</Text>

      <Text style={styles.label}>Nome completo</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textDim} />

      <Text style={styles.label}>Data de nascimento</Text>
      <TextInput
        style={styles.input}
        value={birthDateBr}
        onChangeText={(t) => setBirthDateBr(maskDateInput(t))}
        placeholder="DD/MM/AAAA"
        placeholderTextColor={colors.textDim}
        keyboardType="number-pad"
        maxLength={10}
      />

      <Text style={styles.label}>Gênero</Text>
      <View style={styles.chipsRow}>
        {GENDER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, gender === option && styles.chipSelected]}
            onPress={() => setGender(option)}
          >
            <Text style={[styles.chipText, gender === option && styles.chipTextSelected]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ---- Contato ---- */}
      <Text style={styles.sectionTitle}>Contato</Text>

      <Text style={styles.label}>Telefone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="(99) 99999-9999"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>Contato de emergência (nome)</Text>
      <TextInput
        style={styles.input}
        value={emergencyContactName}
        onChangeText={setEmergencyContactName}
        placeholder="Nome de um familiar"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>Contato de emergência (telefone)</Text>
      <TextInput
        style={styles.input}
        value={emergencyContactPhone}
        onChangeText={setEmergencyContactPhone}
        keyboardType="phone-pad"
        placeholder="(99) 99999-9999"
        placeholderTextColor={colors.textDim}
      />

      {/* ---- Biometria / objetivo ---- */}
      <Text style={styles.sectionTitle}>Biometria e objetivo</Text>

      <Text style={styles.label}>Altura (cm)</Text>
      <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="Ex: 179 ou 1,79" placeholderTextColor={colors.textDim} />

      <Text style={styles.label}>Peso (kg)</Text>
      <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Ex: 94,5" placeholderTextColor={colors.textDim} />

      <Text style={styles.label}>Percentual de gordura (%) — opcional</Text>
      <TextInput
        style={styles.input}
        value={bodyFatPct}
        onChangeText={setBodyFatPct}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>Objetivo principal</Text>
      <View style={styles.chipsRow}>
        {GOAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, goal === option && styles.chipSelected]}
            onPress={() => setGoal(option)}
          >
            <Text style={[styles.chipText, goal === option && styles.chipTextSelected]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Nível de atividade</Text>
      <View style={styles.chipsRow}>
        {ACTIVITY_LEVEL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, activityLevel === option && styles.chipSelected]}
            onPress={() => setActivityLevel(option)}
          >
            <Text style={[styles.chipText, activityLevel === option && styles.chipTextSelected]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ---- Anamnese física (PAR-Q) ---- */}
      <Text style={styles.sectionTitle}>Saúde (anamnese física)</Text>
      <Text style={styles.subtitle}>
        Essas informações ajudam seu Personal a montar um treino seguro pra você.
      </Text>

      <Text style={styles.label}>Doenças crônicas / condições</Text>
      <View style={styles.chipsRow}>
        {CHRONIC_CONDITION_OPTIONS.map((option) => {
          const selected = chronicConditions.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleChronicCondition(option)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {chronicConditions.includes('Outra') && (
        <>
          <Text style={styles.label}>Qual outra condição?</Text>
          <TextInput
            style={styles.input}
            value={otherChronicCondition}
            onChangeText={setOtherChronicCondition}
            placeholderTextColor={colors.textDim}
          />
        </>
      )}

      <Text style={styles.label}>Histórico de lesões e cirurgias</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Ex: lesão no joelho, cirurgia no ombro em 2023..."
        placeholderTextColor={colors.textDim}
        value={injurySurgeryHistory}
        onChangeText={setInjurySurgeryHistory}
        multiline
      />

      <Text style={styles.label}>Dores frequentes durante o esforço</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Ex: lombar, cervical, articulações..."
        placeholderTextColor={colors.textDim}
        value={frequentPain}
        onChangeText={setFrequentPain}
        multiline
      />

      <Text style={styles.label}>Uso contínuo de medicamentos</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Ex: betabloqueador, insulina, antidepressivo..."
        placeholderTextColor={colors.textDim}
        value={medications}
        onChangeText={setMedications}
        multiline
      />

      <Text style={styles.label}>Outras observações de saúde</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Qualquer outra informação relevante"
        placeholderTextColor={colors.textDim}
        value={otherHealthNotes}
        onChangeText={setOtherHealthNotes}
        multiline
      />

      <Text style={styles.label}>Horas de sono por noite (média)</Text>
      <TextInput
        style={styles.input}
        value={sleepHours}
        onChangeText={setSleepHours}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>Nível de estresse (1 = baixo, 5 = alto)</Text>
      <View style={styles.chipsRow}>
        {STRESS_LEVEL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, stressLevel === option && styles.chipSelected]}
            onPress={() => setStressLevel(option)}
          >
            <Text style={[styles.chipText, stressLevel === option && styles.chipTextSelected]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chipsRow}>
        <TouchableOpacity style={[styles.chip, isSmoker && styles.chipSelected]} onPress={() => setIsSmoker((v) => !v)}>
          <Text style={[styles.chipText, isSmoker && styles.chipTextSelected]}>Fumante</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, drinksAlcohol && styles.chipSelected]}
          onPress={() => setDrinksAlcohol((v) => !v)}
        >
          <Text style={[styles.chipText, drinksAlcohol && styles.chipTextSelected]}>Consome álcool</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Liberação médica ---- */}
      <Text style={styles.sectionTitle}>Liberação médica</Text>

      <Text style={styles.label}>Atestado médico ou termo assinado (foto)</Text>
      {medicalClearanceUrl && <Text style={styles.fileInfo}>Documento já enviado ✓</Text>}
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={uploadMedicalClearance}
        disabled={uploadingClearance}
      >
        {uploadingClearance ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text style={styles.uploadButtonText}>
            {medicalClearanceUrl ? 'Substituir arquivo' : 'Enviar foto do atestado'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setWaiverAccepted((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, waiverAccepted && styles.checkboxChecked]}>
          {waiverAccepted && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>
          Na ausência de atestado, aceito o termo de responsabilidade pelos riscos da atividade física
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },

  // ---- header do modo edição ----
  editHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cancelText: { color: colors.textDim, fontSize: 14, width: 64 },
  email: { color: colors.textDim, marginBottom: 24, marginTop: 4, textAlign: 'center' },

  // ---- card de topo do modo visualização ----
  profileCard: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    marginTop: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  profileName: { fontWeight: '700', fontSize: 19, color: colors.text, marginTop: 12 },
  profileSub: { fontSize: 12.5, color: colors.textDim, marginTop: 4 },
  editChip: {
    marginTop: 14,
    backgroundColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editChipText: { color: colors.accent, fontWeight: '700', fontSize: 12.5 },

  // ---- seções do modo visualização ----
  eyebrow: {
    color: colors.textDim2,
    fontWeight: '700',
    fontSize: 11.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 10,
  },
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

  // ---- modo edição (form) ----
  photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  photoButton: { marginLeft: 16 },
  photoButtonText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 12, marginBottom: 12 },
  subtitle: { color: colors.textDim, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  label: { color: colors.textDim, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  chipText: { color: colors.textDim, fontSize: 13 },
  chipTextSelected: { color: colors.accent, fontWeight: '600' },
  fileInfo: { color: colors.accent, fontSize: 13, marginBottom: 8 },
  uploadButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  uploadButtonText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxMark: { color: '#04170F', fontWeight: 'bold', fontSize: 14 },
  checkboxLabel: { color: colors.text, fontSize: 14, flex: 1 },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#04170F', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { padding: 16, alignItems: 'center', marginTop: 20 },
  logoutText: { color: colors.red, fontSize: 15, fontWeight: '700' },
});
