import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';

export default function AdminProfileScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || session?.user?.email || '');
      setWhatsapp(profile.whatsapp || '');
      setAge(profile.age ? String(profile.age) : '');
    }
  }, [profile]);

  const save = async () => {
    setSaving(true);

    // se o e-mail mudou, atualiza também na autenticação
    // (o Supabase pode pedir confirmação por e-mail dependendo da config do projeto)
    const emailChanged = email && email !== (profile?.email || session?.user?.email);
    if (emailChanged) {
      const { error: authError } = await supabase.auth.updateUser({ email });
      if (authError) {
        setSaving(false);
        Alert.alert('Erro ao trocar e-mail', authError.message);
        return;
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        name,
        email,
        whatsapp,
        age: age ? parseInt(age) : null,
      })
      .eq('id', session.user.id);

    setSaving(false);

    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }

    await refreshProfile();
    Alert.alert(
      'Sucesso',
      emailChanged
        ? 'Dados atualizados! Se o e-mail mudou, você pode precisar confirmar o novo endereço.'
        : 'Dados atualizados!'
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <Text style={styles.title}>Meu Perfil</Text>
      <Text style={styles.roleTag}>Administrador</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textDim2} />

      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={colors.textDim2}
      />

      <Text style={styles.label}>Número (WhatsApp)</Text>
      <TextInput
        style={styles.input}
        value={whatsapp}
        onChangeText={setWhatsapp}
        keyboardType="phone-pad"
        placeholder="(99) 99999-9999"
        placeholderTextColor={colors.textDim2}
      />

      <Text style={styles.label}>Idade</Text>
      <TextInput
        style={styles.input}
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
        placeholder="Ex: 34"
        placeholderTextColor={colors.textDim2}
      />

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving} activeOpacity={0.85}>
        <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  roleTag: { color: colors.accent, fontSize: 13, marginTop: 4, marginBottom: 24, fontWeight: '700' },
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
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#04170F', fontWeight: '700', fontSize: 16 },
  logoutButton: { padding: 16, alignItems: 'center', marginTop: 20 },
  logoutText: { color: colors.red, fontSize: 15, fontWeight: '700' },
});
