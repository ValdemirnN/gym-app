import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme/theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao entrar', error.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.logoChip}>
        <Feather name="activity" size={26} color={colors.accent} />
      </View>
      <Text style={styles.title}>Meu Treino</Text>
      <Text style={styles.subtitle}>Entre na sua conta</Text>

      <View style={styles.inputWrap}>
        <Feather name="mail" size={16} color={colors.textDim2} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor={colors.textDim2}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <View style={styles.inputWrap}>
        <Feather name="lock" size={16} color={colors.textDim2} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor={colors.textDim2}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.forgotLink}>Esqueceu a senha? Clique aqui</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
        <Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.link}>Não tem conta? Cadastre-se</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: spacing.xl },

  logoChip: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14.5, color: colors.textDim, textAlign: 'center', marginBottom: 32 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: colors.text, paddingVertical: 14, fontSize: 15.5 },

  forgotLink: { color: colors.accent, textAlign: 'right', marginBottom: 22, fontSize: 13, fontWeight: '600' },

  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: colors.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonText: { color: '#04170F', fontWeight: '700', fontSize: 16 },

  link: { color: colors.accent, textAlign: 'center', marginTop: 22, fontSize: 14, fontWeight: '600' },
});
