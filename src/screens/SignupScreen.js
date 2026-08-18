import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isPasswordValid } from '../utils/passwordValidation';

export default function SignupScreen({ navigation }) {
  const { signUp } = useAuth();

  // dados básicos
  const [role, setRole] = useState(null); // 'cliente' | 'personal'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // dados de cliente
  const [personals, setPersonals] = useState([]);
  const [loadingPersonals, setLoadingPersonals] = useState(false);
  const [selectedPersonalId, setSelectedPersonalId] = useState(null);
  const [healthConditions, setHealthConditions] = useState('');
  const [healthRestrictions, setHealthRestrictions] = useState('');

  // dados de personal
  const [pixKey, setPixKey] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    if (role === 'cliente') {
      loadPersonals();
    }
  }, [role]);

  const loadPersonals = async () => {
    setLoadingPersonals(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'personal')
      .eq('status', 'aprovado')
      .order('name');
    if (!error) setPersonals(data || []);
    setLoadingPersonals(false);
  };

  const validate = () => {
    if (!name || !email || !password) {
      Alert.alert('Atenção', 'Preencha nome, e-mail e senha.');
      return false;
    }
    if (!isPasswordValid(password)) {
      Alert.alert(
        'Senha fraca',
        'A senha precisa ter no mínimo 7 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.'
      );
      return false;
    }
    if (role === 'cliente' && !selectedPersonalId) {
      Alert.alert('Atenção', 'Escolha o seu Personal.');
      return false;
    }
    if (role === 'personal' && !pixKey) {
      Alert.alert('Atenção', 'Informe sua chave Pix para receber pagamentos.');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signUp(email, password, {
      name,
      role,
      personal_id: role === 'cliente' ? selectedPersonalId : null,
      health_conditions: role === 'cliente' ? healthConditions : null,
      health_restrictions: role === 'cliente' ? healthRestrictions : null,
      pix_key: role === 'personal' ? pixKey : null,
      whatsapp: role === 'personal' ? whatsapp : null,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao cadastrar', error.message);
      return;
    }
    if (role === 'cliente') {
      Alert.alert(
        'Conta criada!',
        'Seu cadastro foi enviado. Você poderá treinar assim que seu Personal confirmar o pagamento.'
      );
    } else {
      Alert.alert(
        'Conta criada!',
        'Seu cadastro de Personal está pendente. Você poderá usar o app assim que o Admin aprovar.'
      );
    }
    navigation.navigate('Login');
  };

  // ---------- Etapa 1: escolher o papel ----------
  if (!role) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>Você é...</Text>

        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('cliente')}>
          <Text style={styles.roleEmoji}>🏋️</Text>
          <Text style={styles.roleTitle}>Aluno</Text>
          <Text style={styles.roleDesc}>Quero treinar com acompanhamento de um Personal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.roleCard} onPress={() => setRole('personal')}>
          <Text style={styles.roleEmoji}>💪</Text>
          <Text style={styles.roleTitle}>Personal Trainer</Text>
          <Text style={styles.roleDesc}>Quero gerenciar meus próprios alunos no app</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Já tem conta? Entrar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Etapa 2: formulário ----------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setRole(null)}>
          <Text style={styles.back}>‹ Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{role === 'cliente' ? 'Cadastro de Aluno' : 'Cadastro de Personal'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Senha (mín. 7 caracteres, 1 maiúscula, 1 número, 1 especial)"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {role === 'cliente' && (
          <>
            <Text style={styles.sectionTitle}>Escolha seu Personal</Text>
            {loadingPersonals ? (
              <ActivityIndicator color="#22C55E" style={{ marginVertical: 12 }} />
            ) : personals.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum Personal disponível ainda. Peça pro seu Personal se cadastrar primeiro.
              </Text>
            ) : (
              personals.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.personalOption, selectedPersonalId === p.id && styles.personalOptionSelected]}
                  onPress={() => setSelectedPersonalId(p.id)}
                >
                  <Text
                    style={[
                      styles.personalOptionText,
                      selectedPersonalId === p.id && styles.personalOptionTextSelected,
                    ]}
                  >
                    {p.name || 'Personal sem nome'}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.sectionTitle}>Dados de saúde</Text>
            <Text style={styles.label}>Condições de saúde (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ex: hipertensão, diabetes, cirurgias recentes..."
              placeholderTextColor="#9CA3AF"
              value={healthConditions}
              onChangeText={setHealthConditions}
              multiline
            />
            <Text style={styles.label}>Restrições / lesões (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ex: dor no joelho direito, hérnia de disco..."
              placeholderTextColor="#9CA3AF"
              value={healthRestrictions}
              onChangeText={setHealthRestrictions}
              multiline
            />
          </>
        )}

        {role === 'personal' && (
          <>
            <Text style={styles.sectionTitle}>Dados para recebimento</Text>
            <Text style={styles.label}>Chave Pix</Text>
            <TextInput
              style={styles.input}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              placeholderTextColor="#9CA3AF"
              value={pixKey}
              onChangeText={setPixKey}
            />
            <Text style={styles.label}>WhatsApp (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="(99) 99999-9999"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={whatsapp}
              onChangeText={setWhatsapp}
            />
            <Text style={styles.emptyText}>
              Sua conta de Personal precisa ser aprovada pelo Admin antes de aparecer para os alunos.
            </Text>
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Criando...' : 'Cadastrar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Já tem conta? Entrar</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 24, paddingTop: screenPaddingTop },
  title: { fontSize: fs(24), fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: vs(8) },
  subtitle: { fontSize: fs(13), color: '#9CA3AF', textAlign: 'center', marginBottom: vs(24) },
  back: { color: '#22C55E', fontSize: fs(13), marginBottom: vs(12) },
  sectionTitle: { color: '#fff', fontWeight: '600', fontSize: fs(13), marginTop: vs(20), marginBottom: vs(10) },
  label: { color: '#9CA3AF', marginBottom: vs(6), fontSize: fs(11) },
  emptyText: { color: '#9CA3AF', fontSize: fs(11), marginTop: vs(4), marginBottom: vs(8), lineHeight: 18 },
  input: {
    backgroundColor: '#1F2937',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: vs(12),
    fontSize: fs(14),
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#22C55E',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: vs(16),
  },
  buttonText: { color: '#111827', fontWeight: 'bold', fontSize: fs(14) },
  link: { color: '#22C55E', textAlign: 'center', marginTop: vs(20), fontSize: fs(12) },

  roleCard: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    padding: 20,
    marginBottom: vs(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  roleEmoji: { fontSize: fs(30), marginBottom: vs(8) },
  roleTitle: { color: '#fff', fontSize: fs(16), fontWeight: 'bold', marginBottom: vs(4) },
  roleDesc: { color: '#9CA3AF', fontSize: fs(11), textAlign: 'center' },

  personalOption: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    padding: 14,
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: '#374151',
  },
  personalOptionSelected: { borderColor: '#22C55E', backgroundColor: '#14532D' },
  personalOptionText: { color: '#fff', fontSize: fs(13) },
  personalOptionTextSelected: { color: '#22C55E', fontWeight: '600' },
});
