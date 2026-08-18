import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

export default function AdminPlaceholderScreen() {
  const { profile, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.iconChip}>
        <Feather name="tool" size={26} color={colors.accent} />
      </View>
      <Text style={styles.title}>Painel do Admin</Text>
      <Text style={styles.message}>
        Olá, {profile?.name}. As telas de aprovação de Personals ainda estão em construção — vêm na próxima etapa.
      </Text>
      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 32 },
  iconChip: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(18),
  },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, marginBottom: vs(12) },
  message: { fontSize: fs(13), color: colors.textDim, textAlign: 'center', lineHeight: 22, marginBottom: vs(32) },
  logoutButton: { marginTop: vs(20), padding: 12 },
  logoutText: { color: colors.red, fontSize: fs(12), fontWeight: '700' },
});
