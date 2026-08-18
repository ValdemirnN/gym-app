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
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';
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
    marginBottom: vs(24),
  },

  heading: {
    fontSize: fs(24),
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: vs(10),
  },
  reason: {
    fontSize: fs(12),
    color: colors.textDim,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: vs(20),
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: vs(10),
    paddingHorizontal: s(14),
    marginBottom: vs(8),
    alignSelf: 'stretch',
  },
  infoText: { color: colors.textDim, fontSize: fs(11) },

  pixCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginTop: vs(4),
    marginBottom: vs(4),
    alignSelf: 'stretch',
  },
  pixLabel: { color: colors.textDim, fontSize: fs(10), marginBottom: vs(8) },
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
  pixKey: { color: colors.textDim, fontSize: fs(11), flex: 1 },
  pixCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pixCopyText: { color: colors.accent, fontSize: fs(10), fontWeight: '600' },
  pixNote: { color: colors.textFaint, fontSize: fs(9), marginTop: vs(8) },

  orientacao: {
    fontSize: fs(10),
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: vs(16),
    marginBottom: vs(28),
    paddingHorizontal: s(8),
  },

  btnFaturas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: vs(14),
    paddingHorizontal: s(32),
    alignSelf: 'stretch',
    marginBottom: vs(12),
  },
  btnFaturasText: {
    color: '#04170F',
    fontSize: fs(14),
    fontWeight: '800',
  },

  btnSair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: vs(10),
  },
  btnSairText: { color: colors.textDim, fontSize: fs(12) },
});
