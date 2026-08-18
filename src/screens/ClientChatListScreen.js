import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

// Tela de conversas do aluno: mostra o personal dele em destaque e, logo
// abaixo, os outros personals aprovados no app — caso o dele não esteja
// disponível, o aluno consegue chamar outro profissional.
export default function ClientChatListScreen({ navigation }) {
  const { session, profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const myId = session.user.id;
    setLoading(true);

    const { data: personals } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('role', 'personal')
      .eq('status', 'aprovado')
      .order('name');

    const list = (personals || [])
      .filter((p) => p.id !== profile?.personal_id)
      .map((p) => ({ ...p, isPrimary: false }));

    let primary = null;
    if (profile?.personal_id) {
      primary = (personals || []).find((p) => p.id === profile.personal_id) || null;
      if (!primary) {
        // Personal vinculado ainda não tinha vindo na lista de aprovados (ex: acabou de
        // sair da aprovação) — busca separado pra não sumir o card do "seu personal".
        const { data: p } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .eq('id', profile.personal_id)
          .maybeSingle();
        primary = p;
      }
    }

    const personalIds = [primary, ...list].filter(Boolean).map((p) => p.id);
    const infoById = {};

    if (personalIds.length > 0) {
      const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, read, created_at')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false });

      (messages || []).forEach((m) => {
        const otherId = m.sender_id === myId ? m.receiver_id : m.sender_id;
        if (!personalIds.includes(otherId)) return;
        if (!infoById[otherId]) infoById[otherId] = { last: m, unread: 0 };
        if (m.receiver_id === myId && !m.read) infoById[otherId].unread += 1;
      });
    }

    const others = list
      .map((p) => ({ ...p, lastMessage: infoById[p.id]?.last || null, unread: infoById[p.id]?.unread || 0 }))
      .sort((a, b) => {
        const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return dateB - dateA;
      });

    const finalList = [];
    if (primary) {
      finalList.push({
        ...primary,
        isPrimary: true,
        lastMessage: infoById[primary.id]?.last || null,
        unread: infoById[primary.id]?.unread || 0,
      });
    }
    finalList.push(...others);

    setConversations(finalList);
    setLoading(false);
  }, [session, profile?.personal_id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversas</Text>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nenhum personal disponível no momento. Fale com a academia para vincular seu cadastro.
          </Text>
        }
        renderItem={({ item, index }) => {
          // Título de seção simples antes do primeiro "outro profissional"
          const showOthersHeader = !item.isPrimary && (index === 0 || conversations[index - 1].isPrimary);
          return (
            <>
              {showOthersHeader ? (
                <Text style={styles.sectionHeader}>
                  {conversations.some((c) => c.isPrimary) ? 'Seu personal não respondeu? Fale com outro profissional' : 'Profissionais disponíveis'}
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('ChatConversation', { otherUserId: item.id, otherUserName: item.name })
                }
              >
                {item.unread > 0 ? <View style={styles.unreadDot} /> : null}
                <Avatar uri={item.avatar_url} size={48} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardTitle}>{item.name || 'Personal'}</Text>
                    {item.isPrimary ? (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Seu personal</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardPreview} numberOfLines={1}>
                    {item.lastMessage ? item.lastMessage.content : 'Nenhuma mensagem ainda'}
                  </Text>
                </View>
                {item.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: s(20), paddingTop: screenPaddingTop },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, marginBottom: vs(16) },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(40), fontSize: fs(12), lineHeight: 20 },
  sectionHeader: {
    color: colors.textDim,
    fontSize: fs(9.5),
    marginTop: vs(8),
    marginBottom: vs(8),
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    padding: 12,
    marginBottom: vs(10),
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  cardTitle: { color: colors.text, fontSize: fs(12.5), fontWeight: '700' },
  cardPreview: { color: colors.textDim, fontSize: fs(10.5), marginTop: vs(3) },
  primaryBadge: {
    backgroundColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingHorizontal: s(8),
    paddingVertical: vs(2),
  },
  primaryBadgeText: { color: colors.accent, fontSize: fs(9), fontWeight: '700' },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: s(6),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: { color: '#04170F', fontSize: fs(10), fontWeight: 'bold' },
});
