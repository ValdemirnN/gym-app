import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

const IMAGE_MIME_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
function getImageContentType(uri) {
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  return IMAGE_MIME_TYPES[ext] || 'image/jpeg';
}

const GENDER_OPTIONS = ['Masculino', 'Feminino', 'Outro', 'Prefiro não informar'];
const SPECIALTY_OPTIONS = [
  'Hipertrofia',
  'Emagrecimento',
  'Reabilitação',
  'Terceira idade',
  'Condicionamento físico',
  'Treinamento funcional',
];

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

// Pequeno "não informado" padrão pra qualquer campo vazio no modo visualização.
function displayValue(value) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  return value;
}

// Card de campo somente-leitura, igual ao .field-card do protótipo.
function FieldCard({ label, value }) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function PersonalProfileScreen() {
  const navigation = useNavigation();
  const { session, profile, signOut, refreshProfile } = useAuth();

  const [editing, setEditing] = useState(false);

  // Dados pessoais básicos
  const [name, setName] = useState('');
  const [birthDateBr, setBirthDateBr] = useState('');
  const [gender, setGender] = useState(null);

  // Contato
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');

  // Credenciamento obrigatório
  const [crefNumber, setCrefNumber] = useState('');
  const [crefState, setCrefState] = useState('');

  // Atuação profissional
  const [specialties, setSpecialties] = useState([]);
  const [bio, setBio] = useState('');

  // Comercial e operacional
  const [consultationPrice, setConsultationPrice] = useState('');
  const [availablePlans, setAvailablePlans] = useState('');
  const [attendsOnline, setAttendsOnline] = useState(false);
  const [attendsInPerson, setAttendsInPerson] = useState(false);
  const [inPersonLocation, setInPersonLocation] = useState('');
  const [availabilityHours, setAvailabilityHours] = useState('');

  // Pix
  const [pixKey, setPixKey] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadFromProfile = () => {
    if (!profile) return;
    setName(profile.name || '');
    setBirthDateBr(isoToBr(profile.birth_date));
    setGender(profile.gender || null);

    setWhatsapp(profile.whatsapp || '');
    setInstagram(profile.instagram_url || '');
    setLinkedin(profile.linkedin_url || '');

    setCrefNumber(profile.cref_number || '');
    setCrefState(profile.cref_state || '');

    setSpecialties(profile.specialties || []);
    setBio(profile.bio || '');

    setConsultationPrice(profile.consultation_price != null ? String(profile.consultation_price) : '');
    setAvailablePlans(profile.available_plans || '');
    setAttendsOnline(!!profile.attends_online);
    setAttendsInPerson(!!profile.attends_in_person);
    setInPersonLocation(profile.in_person_location || '');
    setAvailabilityHours(profile.availability_hours || '');

    setPixKey(profile.pix_key || '');
  };

  useEffect(() => {
    loadFromProfile();
  }, [profile]);

  const toggleSpecialty = (option) => {
    setSpecialties((current) =>
      current.includes(option) ? current.filter((s) => s !== option) : [...current, option]
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
    if (!crefNumber.trim() || !crefState.trim()) {
      Alert.alert('Atenção', 'Informe o número do CREF e o estado de atuação — é obrigatório.');
      return;
    }
    let priceValue = null;
    if (consultationPrice) {
      priceValue = parseFloat(consultationPrice.replace(',', '.'));
      if (Number.isNaN(priceValue)) {
        Alert.alert('Atenção', 'Valor da consultoria inválido.');
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name,
        birth_date: birthDateIso,
        gender,
        pix_key: pixKey,
        whatsapp,
        instagram_url: instagram || null,
        linkedin_url: linkedin || null,
        cref_number: crefNumber,
        cref_state: crefState.toUpperCase(),
        specialties,
        bio: bio || null,
        consultation_price: priceValue,
        available_plans: availablePlans || null,
        attends_online: attendsOnline,
        attends_in_person: attendsInPerson,
        in_person_location: attendsInPerson ? inPersonLocation || null : null,
        availability_hours: availabilityHours || null,
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

  // ==========================================================================
  // MODO VISUALIZAÇÃO — somente leitura, igual à tela #perfil do protótipo.
  // ==========================================================================
  if (!editing) {
    const specialtiesLabel = specialties.length ? specialties.join(', ') : 'Não informado';
    const locationLabel = [attendsOnline && 'Online', attendsInPerson && 'Presencial']
      .filter(Boolean)
      .join(' + ') || 'Não informado';

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
        <FieldCard label="WhatsApp" value={displayValue(whatsapp)} />
        <FieldCard label="Instagram" value={displayValue(instagram)} />
        <FieldCard label="LinkedIn" value={displayValue(linkedin)} />

        <Text style={styles.eyebrow}>Credenciamento</Text>
        <FieldCard
          label="CREF"
          value={crefNumber ? `${crefNumber} / ${crefState}` : 'Não informado'}
        />

        <Text style={styles.eyebrow}>Atuação profissional</Text>
        <FieldCard label="Especialidades" value={specialtiesLabel} />
        <FieldCard label="Bio" value={displayValue(bio)} />

        <Text style={styles.eyebrow}>Comercial e operacional</Text>
        <FieldCard
          label="Valor da consultoria"
          value={consultationPrice ? `R$ ${consultationPrice}` : 'Não informado'}
        />
        <FieldCard label="Planos disponíveis" value={displayValue(availablePlans)} />
        <FieldCard label="Local de atendimento" value={locationLabel} />
        {attendsInPerson ? (
          <FieldCard label="Endereço presencial" value={displayValue(inPersonLocation)} />
        ) : null}
        <FieldCard label="Horários de disponibilidade" value={displayValue(availabilityHours)} />
        <FieldCard label="Chave Pix" value={displayValue(pixKey)} />

        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => navigation.navigate('PersonalDashboard', { screen: 'Faq', params: { role: 'personal' } })}
        >
          <Text style={styles.helpButtonText}>Dúvidas e suporte</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ==========================================================================
  // MODO EDIÇÃO — formulário completo, com Salvar/Cancelar no topo.
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

      {/* ---- Dados pessoais básico ---- */}
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

      <Text style={styles.label}>WhatsApp</Text>
      <TextInput
        style={styles.input}
        value={whatsapp}
        onChangeText={setWhatsapp}
        keyboardType="phone-pad"
        placeholder="(99) 99999-9999"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>Instagram</Text>
      <TextInput
        style={styles.input}
        value={instagram}
        onChangeText={setInstagram}
        placeholder="@seu.perfil ou link completo"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
      />

      <Text style={styles.label}>LinkedIn</Text>
      <TextInput
        style={styles.input}
        value={linkedin}
        onChangeText={setLinkedin}
        placeholder="Link do seu perfil"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
      />

      {/* ---- Credenciamento obrigatório ---- */}
      <Text style={styles.sectionTitle}>Credenciamento (obrigatório)</Text>

      <Text style={styles.label}>Número do registro no CREF</Text>
      <TextInput
        style={styles.input}
        value={crefNumber}
        onChangeText={setCrefNumber}
        placeholder="Ex: 123456-G/SP"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>Estado de atuação (UF)</Text>
      <TextInput
        style={styles.input}
        value={crefState}
        onChangeText={(t) => setCrefState(t.toUpperCase())}
        placeholder="Ex: SP"
        placeholderTextColor={colors.textDim}
        maxLength={2}
        autoCapitalize="characters"
      />

      {/* ---- Atuação profissional ---- */}
      <Text style={styles.sectionTitle}>Atuação profissional</Text>

      <Text style={styles.label}>Especialidades</Text>
      <View style={styles.chipsRow}>
        {SPECIALTY_OPTIONS.map((option) => {
          const selected = specialties.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleSpecialty(option)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Bio (resumo da sua experiência)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={bio}
        onChangeText={setBio}
        placeholder="Conte resumidamente sua experiência, formação e diferenciais..."
        placeholderTextColor={colors.textDim}
        multiline
      />

      {/* ---- Comercial e operacional ---- */}
      <Text style={styles.sectionTitle}>Comercial e operacional</Text>

      <Text style={styles.label}>Valor da consultoria (R$)</Text>
      <TextInput
        style={styles.input}
        value={consultationPrice}
        onChangeText={setConsultationPrice}
        placeholder="Ex: 250"
        placeholderTextColor={colors.textDim}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Planos disponíveis</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={availablePlans}
        onChangeText={setAvailablePlans}
        placeholder="Ex: Mensal, Trimestral, Semestral..."
        placeholderTextColor={colors.textDim}
        multiline
      />

      <Text style={styles.label}>Local de atendimento</Text>
      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.chip, attendsOnline && styles.chipSelected]}
          onPress={() => setAttendsOnline((v) => !v)}
        >
          <Text style={[styles.chipText, attendsOnline && styles.chipTextSelected]}>Online</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, attendsInPerson && styles.chipSelected]}
          onPress={() => setAttendsInPerson((v) => !v)}
        >
          <Text style={[styles.chipText, attendsInPerson && styles.chipTextSelected]}>Presencial</Text>
        </TouchableOpacity>
      </View>

      {attendsInPerson && (
        <>
          <Text style={styles.label}>Endereço / local do atendimento presencial</Text>
          <TextInput
            style={styles.input}
            value={inPersonLocation}
            onChangeText={setInPersonLocation}
            placeholder="Ex: Academia X, Bairro Y"
            placeholderTextColor={colors.textDim}
          />
        </>
      )}

      <Text style={styles.label}>Horários de disponibilidade</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={availabilityHours}
        onChangeText={setAvailabilityHours}
        placeholder="Ex: Seg a Sex, das 6h às 21h"
        placeholderTextColor={colors.textDim}
        multiline
      />

      <Text style={styles.label}>Chave Pix (para receber dos alunos)</Text>
      <TextInput style={styles.input} value={pixKey} onChangeText={setPixKey} placeholderTextColor={colors.textDim} />

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text },

  // ---- header do modo edição ----
  editHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(4) },
  cancelText: { color: colors.textDim, fontSize: fs(12), width: 64 },
  email: { color: colors.textDim, marginBottom: vs(24), marginTop: vs(4), textAlign: 'center' },

  // ---- card de topo do modo visualização ----
  profileCard: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
    marginTop: vs(16),
    marginBottom: vs(20),
    alignItems: 'center',
  },
  profileName: { fontFamily: undefined, fontWeight: '700', fontSize: fs(17), color: colors.text, marginTop: vs(12) },
  profileSub: { fontSize: fs(10.5), color: colors.textDim, marginTop: vs(4) },
  editChip: {
    marginTop: vs(14),
    backgroundColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingVertical: vs(8),
    paddingHorizontal: s(16),
  },
  editChipText: { color: colors.accent, fontWeight: '700', fontSize: fs(10.5) },

  // ---- seções do modo visualização ----
  eyebrow: {
    color: colors.textDim2,
    fontWeight: '700',
    fontSize: fs(9.5),
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: vs(18),
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

  // ---- modo edição (form) ----
  photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: vs(28) },
  photoButton: { marginLeft: 16 },
  photoButtonText: { color: colors.accent, fontWeight: '600', fontSize: fs(12) },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: fs(14), marginTop: vs(12), marginBottom: vs(12) },
  label: { color: colors.textDim, marginBottom: vs(6), fontSize: fs(11) },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: vs(16),
    fontSize: fs(14),
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: vs(16), gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: vs(8),
    paddingHorizontal: s(14),
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: vs(8),
  },
  chipSelected: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  chipText: { color: colors.textDim, fontSize: fs(11) },
  chipTextSelected: { color: colors.accent, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center', marginTop: vs(8) },
  saveButtonText: { color: '#04170F', fontWeight: 'bold', fontSize: fs(14) },
  logoutButton: { padding: 16, alignItems: 'center', marginTop: vs(20) },
  logoutText: { color: colors.red, fontSize: fs(13), fontWeight: '700' },
  helpButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: vs(24),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  helpButtonText: { color: colors.text, fontSize: fs(12), fontWeight: '600' },
});
