import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';
import { useAuth } from '../context/AuthContext';

export default function PendingApprovalScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  const isPersonal = profile?.role === 'personal';

  const handleRefresh = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{isPersonal ? '⏳' : '💳'}</Text>
      <Text style={styles.title}>{isPersonal ? 'Cadastro em análise' : 'Aguardando confirmação'}</Text>
      <Text style={styles.message}>
        {isPersonal
          ? 'Sua conta de Personal está pendente de aprovação do Admin. Assim que for aprovada, você poderá acessar seu painel.'
          : 'Assim que seu Personal confirmar o pagamento, seu acesso aos treinos será liberado automaticamente.'}
      </Text>

      <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} disabled={checking}>
        {checking ? <ActivityIndicator color="#111827" /> : <Text style={styles.refreshText}>Verificar novamente</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', padding: 32 },
  emoji: { fontSize: fs(54), marginBottom: vs(16) },
  title: { fontSize: fs(20), fontWeight: 'bold', color: '#fff', marginBottom: vs(12), textAlign: 'center' },
  message: { fontSize: fs(13), color: '#9CA3AF', textAlign: 'center', lineHeight: 22, marginBottom: vs(32) },
  refreshButton: { backgroundColor: '#22C55E', borderRadius: 10, paddingVertical: vs(14), paddingHorizontal: s(28) },
  refreshText: { color: '#111827', fontWeight: 'bold', fontSize: fs(13) },
  logoutButton: { marginTop: vs(20), padding: 12 },
  logoutText: { color: '#EF4444', fontSize: fs(12) },
});
