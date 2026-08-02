import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';
import { Feather, Ionicons } from '@expo/vector-icons'; 

export default function HomeScreen({ navigation }) {
  const { session } = useAuth();
  const [recentLogs, setRecentLogs] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = useCallback(async () => {
    const userId = session.user.id;

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .single();
    if (profileRow) {
      setProfileName(profileRow.name);
      setAvatarUrl(profileRow.avatar_url);
    }

    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id, started_at, finished_at, skipped, skip_reason, workouts(name)')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(10);
    setRecentLogs(logs || []);

    const { count: unread } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);
    setUnreadCount(unread || 0);

  }, [session]);
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={recentLogs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              {/* Agrupamos a foto e o texto para ficarem juntos na esquerda */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar uri={avatarUrl} size={48} />
                <Text style={styles.greeting}> Olá, {profileName || 'atleta'} 👋</Text>
              </View>

              {/* Novo botão de notificações na direita */}
              <TouchableOpacity 
                style={styles.bellIconContainer} 
                onPress={() => navigation.navigate('NotificationsScreen')}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={24} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.ctaCard} onPress={() => navigation.navigate('TalkToPersonal')} activeOpacity={0.85}>
              <View style={styles.ctaIcon}>
                <Feather name="message-circle" size={20} color="#04170F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Falar com seu personal</Text>
                <Text style={styles.ctaSub}>Dúvidas, ajustes e feedback do treino</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#04170F" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ctaCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => navigation.navigate('StudentChallenge')}
              activeOpacity={0.85}
            >
              <View style={[styles.ctaIcon, { backgroundColor: colors.accentGlow }]}>
                <Feather name="award" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: colors.text }]}>Desafios</Text>
                <Text style={[styles.ctaSub, { color: colors.textDim }]}>Veja o ranking e a premiação</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textDim2} />
            </TouchableOpacity>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Últimos treinos</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Você ainda não registrou nenhum treino. Vá até a aba "Treinos" para começar!</Text>
        }
        renderItem={({ item }) => {
          const status = item.skipped ? 'blocked' : item.finished_at ? 'done' : 'pending';
          return (
            <View style={styles.card}>
              <Avatar uri={avatarUrl} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.workouts?.name || 'Treino'}</Text>
                <Text style={styles.cardDate}>
                  {new Date(item.started_at).toLocaleDateString('pt-BR')} às{' '}
                  {new Date(item.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.skipped && item.skip_reason ? (
                  <Text style={styles.cardReason}>Motivo: {item.skip_reason}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.badge,
                  status === 'done' && styles.badgeDone,
                  status === 'pending' && styles.badgePending,
                  status === 'blocked' && styles.badgeBlocked,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    status === 'done' && styles.badgeTextDone,
                    status === 'pending' && styles.badgeTextPending,
                    status === 'blocked' && styles.badgeTextBlocked,
                  ]}
                >
                  {status === 'done' ? 'Concluído' : status === 'pending' ? 'Em andamento' : 'Não treinou'}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },

  bellIconContainer: {
    position: 'relative',
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  greeting: { fontSize: 18, fontWeight: '800', color: colors.text },

  ctaCard: {
    backgroundColor: colors.accentDark,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: colors.accentDark,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { fontWeight: '700', fontSize: 15, color: '#04170F' },
  ctaSub: { fontSize: 11.5, color: 'rgba(4,23,15,0.75)', marginTop: 1 },

  sectionHead: { marginBottom: 12 },
  sectionTitle: { fontSize: 16.5, fontWeight: '700', color: colors.text },

  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  cardTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  cardDate: { color: colors.textDim, fontSize: 11.5, marginTop: 2 },
  cardReason: { color: colors.textDim, fontSize: 11.5, marginTop: 2, fontStyle: 'italic' },

  badge: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeDone: { backgroundColor: colors.accentGlow },
  badgeTextDone: { color: colors.accent },
  badgePending: { backgroundColor: colors.amberGlow },
  badgeTextPending: { color: colors.amber },
  badgeBlocked: { backgroundColor: colors.redGlow },
  badgeTextBlocked: { color: colors.red },
});