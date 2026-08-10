import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Clipboard, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import StudentOwnSubscriptionScreen from './StudentOwnSubscriptionScreen';

const BlockedStack = createNativeStackNavigator();

// ─── Tela de parede (wall) ────────────────────────────────────────────────────
function BlockedWallScreen({ navigation }) {
  const { session, profile, signOut } = useAuth();
  const [pixKey, setPixKey] = useState(null);
  const [accessInfo, setAccessInfo] = useState(null);

  const load = useCallback(async () => {
    const { data: acc } = await supabase
      .from('profiles')
      .select('access_expires_at, access_blocked, monthly_fee, personal_id')
      .eq('id', session.user.id)
      .single();
    setAccessInfo(acc);

    if (acc?.personal_id) {
      const { data: personal } = await supabase
        .from('profiles')
        .select('pix_key, name')
        .eq('id', acc.personal_id)
        .single();
      setPixKey(personal);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const copiarPix = () => {
    if (pixKey?.pix_key) {
      Clipboard.setString(pixKey.pix_key);
      Alert.alert('Copiado!', 'Chave Pix copiada para a área de transferência.');
    }
  };

  const now = new Date();
  const accessExpired = accessInfo?.access_expires_at && new Date(accessInfo.access_expires_at) < now;
  const manualBlock = accessInfo?.access_blocked;
  const neverPaid = !accessInfo?.access_expires_at;

  const reason = manualBlock
    ? 'Seu acesso foi suspenso pelo seu personal.'
    : accessExpired
    ? 'Seu acesso expirou por falta de pagamento confirmado.'
    : 'Nenhum pagamento foi confirmado ainda para liberar seu acesso.';

  return (
    <View style={styles.container}>
      {/* Ícone central */}
      <View style={styles.iconWrap}>
        <Feather name="lock" size={48} color={colors.red} />
      </View>

      {/* Título */}
      <Text style={styles.heading}>Acesso suspenso</Text>
      <Text style={styles.reason}>{reason}</Text>

      {/* Info de quando expirou */}
      {accessExpired && accessInfo?.access_expires_at && (
        <View style={styles.infoBox}>
          <Feather name="calendar" size={14} color={colors.textDim} />
          <Text style={styles.infoText}>
            Expirou em {new Date(accessInfo.access_expires_at).toLocaleDateString('pt-BR')}
          </Text>
        </View>
      )}

      {/* Mensalidade */}
      {accessInfo?.monthly_fee && (
        <View style={styles.infoBox}>
          <Feather name="tag" size={14} color={colors.textDim} />
          <Text style={styles.infoText}>
            Mensalidade: R$ {Number(accessInfo.monthly_fee).toFixed(2)} / mês
          </Text>
        </View>
      )}

      {/* Chave pix */}
      {pixKey?.pix_key && (
        <View style={styles.pixCard}>
          <Text style={styles.pixLabel}>Chave Pix do personal</Text>
          <TouchableOpacity style={styles.pixRow} onPress={copiarPix} activeOpacity={0.7}>
            <Text style={styles.pixKey} numberOfLines={1}>{pixKey.pix_key}</Text>
            <View style={styles.pixCopyBtn}>
              <Feather name="copy" size={14} color={colors.accent} />
              <Text style={styles.pixCopyText}>Copiar</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.pixNote}>Após pagar, avise seu personal para confirmar.</Text>
        </View>
      )}

      {/* Orientação */}
      <Text style={styles.orientacao}>
        Para recuperar o acesso, realize o pagamento e peça ao seu personal que confirme no app.
      </Text>

      {/* Botão principal: ir para Faturas */}
      <TouchableOpacity
        style={styles.btnFaturas}
        onPress={() => navigation.navigate('FaturasBlocked')}
        activeOpacity={0.85}
      >
        <Feather name="credit-card" size={18} color="#04170F" />
        <Text style={styles.btnFaturasText}>Ver faturas</Text>
      </TouchableOpacity>

      {/* Sair */}
      <TouchableOpacity style={styles.btnSair} onPress={signOut} activeOpacity={0.7}>
        <Feather name="log-out" size={15} color={colors.textDim} />
        <Text style={styles.btnSairText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Stack restrito: apenas wall + tela de faturas ───────────────────────────
export default function AccessBlockedScreen() {
  return (
    <BlockedStack.Navigator screenOptions={{ headerShown: false }}>
      <BlockedStack.Screen name="BlockedWall" component={BlockedWallScreen} />
      <BlockedStack.Screen name="FaturasBlocked" component={StudentOwnSubscriptionScreen} />
    </BlockedStack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },

  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,90,122,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,122,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  reason: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  infoText: { color: colors.textDim, fontSize: 13 },

  pixCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 4,
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  pixLabel: { color: colors.textDim, fontSize: 12, marginBottom: 8 },
  pixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 4,
    padding: 10,
    gap: 8,
  },
  pixKey: { color: colors.textDim, fontSize: 13, flex: 1 },
  pixCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pixCopyText: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  pixNote: { color: colors.textFaint, fontSize: 11, marginTop: 8 },

  orientacao: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  btnFaturas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  btnFaturasText: {
    color: '#04170F',
    fontSize: 16,
    fontWeight: '800',
  },

  btnSair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  btnSairText: { color: colors.textDim, fontSize: 14 },
});
