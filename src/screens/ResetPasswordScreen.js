import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { PASSWORD_RULES, isPasswordValid } from '../utils/passwordValidation';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { updatePassword, signOut } = useAuth();

  const passwordOk = isPasswordValid(password);
  const matches = password.length > 0 && password === confirmPassword;
  const canSubmit = passwordOk && matches && !saving;

  const handleSave = async () => {
    if (!passwordOk) {
      Alert.alert('Senha inválida', 'Sua nova senha precisa atender a todos os requisitos abaixo.');
      return;
    }
    if (!matches) {
      Alert.alert('Atenção', 'As senhas não coincidem.');
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      Alert.alert('Erro ao redefinir senha', error.message);
      return;
    }
    Alert.alert('Pronto!', 'Sua senha foi redefinida com sucesso.');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>🔒 Nova senha</Text>
      <Text style={styles.subtitle}>Crie uma nova senha para acessar sua conta.</Text>

      <TextInput
        style={styles.input}
        placeholder="Nova senha"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirmar nova senha"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <View style={styles.rulesBox}>
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <Text key={rule.key} style={[styles.ruleText, met && styles.ruleTextMet]}>
              {met ? '✓' : '•'} {rule.label}
            </Text>
          );
        })}
        {confirmPassword.length > 0 && (
          <Text style={[styles.ruleText, matches && styles.ruleTextMet]}>
            {matches ? '✓' : '•'} As senhas coincidem
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={!canSubmit}
      >
        <Text style={styles.buttonText}>{saving ? 'Salvando...' : 'Salvar nova senha'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut}>
        <Text style={styles.link}>Cancelar e sair</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginBottom: 24, lineHeight: 21 },
  input: {
    backgroundColor: '#1F2937',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  rulesBox: { marginTop: 4, marginBottom: 20 },
  ruleText: { color: '#9CA3AF', fontSize: 13, marginBottom: 6 },
  ruleTextMet: { color: '#22C55E' },
  button: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#111827', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#EF4444', textAlign: 'center', marginTop: 22, fontSize: 14 },
});
