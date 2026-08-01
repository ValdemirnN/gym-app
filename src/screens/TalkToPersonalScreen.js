import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';

// Monta o link do WhatsApp a partir de um número em qualquer formato,
// assumindo Brasil (55) quando o número não trouxer o código do país.
function buildWhatsAppUrl(rawNumber, message) {
  const digits = (rawNumber || '').replace(/\D/g, '');
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${withCountry}${text ? `?text=${text}` : ''}`;
}

export default function TalkToPersonalScreen({ navigation }) {
  const { profile } = useAuth();
  const [personal, setPersonal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.personal_id) {
      setPersonal(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, whatsapp, avatar_url')
      .eq('id', profile.personal_id)
      .maybeSingle();
    setPersonal(data);
    setLoading(false);
  }, [profile?.personal_id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openWhatsApp = async () => {
    const url = buildWhatsAppUrl(
      personal?.whatsapp,
      `Olá ${personal?.name || ''}, tudo bem? Aqui é ${profile?.name || 'seu aluno'}.`
    );
    if (!url) {
      Alert.alert('Sem WhatsApp cadastrado', 'Seu personal ainda não cadastrou um número de WhatsApp.');
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Não foi possível abrir o WhatsApp', 'Verifique se o WhatsApp está instalado no seu aparelho.');
      return;
    }
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={20} color={colors.text} />
          <Text style={styles.back}>Voltar</Text>
        </TouchableOpacity>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Falar com o personal</Text>

      {!personal ? (
        <Text style={styles.empty}>
          Você ainda não tem um personal vinculado à sua conta. Fale com a academia para vincular seu cadastro.
        </Text>
      ) : (
        <>
          <View style={styles.card}>
            <Avatar uri={personal.avatar_url} name={personal.name} size={64} />
            <Text style={styles.personalName}>{personal.name || 'Seu personal'}</Text>
          </View>

          <TouchableOpacity
            style={styles.optionButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Chat', { otherUserId: personal.id, otherUserName: personal.name })}
          >
            <View style={styles.optionIcon}>
              <Feather name="message-circle" size={19} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Chat no app</Text>
              <Text style={styles.optionDesc}>Converse direto por aqui, fica salvo no seu histórico.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textDim2} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionButton, styles.whatsappButton]} activeOpacity={0.8} onPress={openWhatsApp}>
            <View style={[styles.optionIcon, styles.optionIconWhatsapp]}>
              <Feather name="phone" size={19} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Chamar no WhatsApp</Text>
              <Text style={styles.optionDesc}>Abre uma conversa direta no WhatsApp do seu personal.</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textDim2} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  empty: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginTop: 20 },
  card: { alignItems: 'center', marginBottom: 28 },
  personalName: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 10 },
  optionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  whatsappButton: { borderColor: colors.accent },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconWhatsapp: {},
  optionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  optionDesc: { color: colors.textDim, fontSize: 12, marginTop: 3 },
});
