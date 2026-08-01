import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';

// Lista todos os alunos do personal, mostrando a última mensagem trocada
// (se houver) e quantas mensagens não lidas existem em cada conversa.
export default function PersonalChatListScreen({ navigation }) {
  const { session } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const myId = session.user.id;
    setLoading(true);

    const { data: students } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('personal_id', myId)
      .order('name');

    const studentIds = (students || []).map((s) => s.id);
    const infoByStudent = {};

    if (studentIds.length > 0) {
      const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, read, created_at')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false });

      (messages || []).forEach((m) => {
        const otherId = m.sender_id === myId ? m.receiver_id : m.sender_id;
        if (!studentIds.includes(otherId)) return;
        if (!infoByStudent[otherId]) {
          infoByStudent[otherId] = { last: m, unread: 0 };
        }
        if (m.receiver_id === myId && !m.read) {
          infoByStudent[otherId].unread += 1;
        }
      });
    }

    const list = (students || []).map((s) => ({
      ...s,
      lastMessage: infoByStudent[s.id]?.last || null,
      unread: infoByStudent[s.id]?.unread || 0,
    }));

    list.sort((a, b) => {
      const dateA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const dateB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return dateB - dateA;
    });

    setConversations(list);
    setLoading(false);
  }, [session]);

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
            Nenhum aluno vinculado ainda. Assim que alguém escolher você como personal, as conversas aparecem aqui.
          </Text>
        }
        renderItem={({ item }) => (
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
              <Text style={styles.cardTitle}>{item.name || 'Aluno sem nome'}</Text>
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
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md + 2,
    padding: 12,
    marginBottom: 10,
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
  cardTitle: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  cardPreview: { color: colors.textDim, fontSize: 12.5, marginTop: 3 },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: { color: '#04170F', fontSize: 12, fontWeight: 'bold' },
});
