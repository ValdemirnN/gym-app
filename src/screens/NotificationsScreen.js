import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

export default function NotificationsScreen({ navigation }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'alert': return { icon: 'warning-outline', color: '#F59E0B', bg: '#FFFBEB' };
      case 'message': return { icon: 'chatbubble-ellipses-outline', color: '#3B82F6', bg: '#EFF6FF' };
      case 'workout': return { icon: 'barbell-outline', color: '#10B981', bg: '#ECFDF5' };
      case 'motivation': return { icon: 'flame-outline', color: '#EF4444', bg: '#FEF2F2' };
      default: return { icon: 'notifications-outline', color: '#9CA3AF', bg: '#F3F4F6' };
    }
  };

  const renderItem = ({ item }) => {
    const { icon, color } = getNotificationStyle(item.type);
    const isUnread = !item.is_read;

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isUnread && styles.unreadCard]}
        activeOpacity={0.7}
        onPress={() => markAsRead(item.id)}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, isUnread && styles.unreadText]}>{item.title}</Text>
          <Text style={styles.description} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>
            {new Date(item.created_at).toLocaleDateString('pt-BR')}
          </Text>
        </View>
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificações</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#22c440" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhuma notificação no momento.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#1C1C1E' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  listContainer: { padding: 20 },
  notificationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', padding: 16, borderRadius: 16, marginBottom: 12 },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#22c440' },
  iconContainer: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  textContainer: { flex: 1 },
  title: { color: '#E5E5E5', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  unreadText: { color: '#FFFFFF', fontWeight: 'bold' },
  description: { color: '#A1A1AA', fontSize: 14, lineHeight: 20 },
  time: { color: '#52525B', fontSize: 12, marginTop: 8 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c440', marginLeft: 10 },
  emptyText: { color: '#A1A1AA', textAlign: 'center', marginTop: 40, fontSize: 16 },
});