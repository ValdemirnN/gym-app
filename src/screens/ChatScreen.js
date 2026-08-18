import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

export default function ChatScreen({ route, navigation }) {
  const { otherUserId, otherUserName } = route.params;
  const { session } = useAuth();
  const myId = session.user.id;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, read, created_at')
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`
      )
      .order('created_at', { ascending: true });
    setMessages(data || []);

    // marca como lidas as mensagens que o outro me enviou
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', myId)
      .eq('read', false);
  }, [myId, otherUserId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Atualiza em tempo real quando chega mensagem nova dessa conversa
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${myId}-${otherUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new;
          const belongsHere =
            (m.sender_id === myId && m.receiver_id === otherUserId) ||
            (m.sender_id === otherUserId && m.receiver_id === myId);
          if (!belongsHere) return;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id === otherUserId) {
            supabase.from('messages').update({ read: true }).eq('id', m.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, otherUserId]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: myId, receiver_id: otherUserId, content })
      .select()
      .single();
    setSending(false);
    if (error) {
      setText(content);
      return;
    }
    setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>{otherUserName || 'Conversa'}</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhuma mensagem ainda. Diga oi! 👋</Text>
        }
        renderItem={({ item }) => {
          const mine = item.sender_id === myId;
          return (
            <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.content}</Text>
                <Text style={mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs}>
                  {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escreva uma mensagem..."
          placeholderTextColor={colors.textDim2}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={send} disabled={sending || !text.trim()} activeOpacity={0.85}>
          <Feather name="send" size={17} color="#04170F" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: screenPaddingTop, paddingHorizontal: s(20) },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(12), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), fontWeight: '700', marginLeft: 2 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(40), fontSize: fs(12) },
  bubbleRow: { flexDirection: 'row', marginBottom: vs(8) },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.md, paddingHorizontal: s(14), paddingVertical: vs(10) },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: '#04170F', fontSize: fs(13) },
  bubbleTextTheirs: { color: colors.text, fontSize: fs(13) },
  bubbleTimeMine: { fontSize: fs(9), color: 'rgba(4,23,15,0.6)', marginTop: vs(4), alignSelf: 'flex-end' },
  bubbleTimeTheirs: { fontSize: fs(9), color: colors.textDim2, marginTop: vs(4), alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: vs(12),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: s(16),
    paddingVertical: vs(10),
    maxHeight: 100,
    fontSize: fs(13),
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: colors.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
