import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';

const STATUS_LABEL = {
  aprovado: { text: 'Ativo', color: colors.accent, glow: colors.accentGlow },
  pendente: { text: 'Pendente', color: colors.amber, glow: colors.amberGlow },
  recusado: { text: 'Recusado', color: colors.red, glow: colors.redGlow },
};

export default function PersonalStudentsListScreen({ navigation }) {
  const { session } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, status, created_at, access_expires_at, access_blocked, avatar_url')
      .eq('personal_id', session.user.id)
      .order('name');
    setStudents(data || []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const getBadge = (item) => {
    if (item.status !== 'aprovado') return STATUS_LABEL[item.status] || STATUS_LABEL.pendente;
    if (item.access_blocked) return { text: 'Bloqueado', color: colors.red, glow: colors.redGlow };
    if (item.access_expires_at && new Date(item.access_expires_at) < new Date()) {
      return { text: 'Expirado', color: colors.red, glow: colors.redGlow };
    }
    return { text: 'Ativo', color: colors.accent, glow: colors.accentGlow };
  };

  const filtered = students.filter((s) => (s.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meus Alunos</Text>

      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.textDim2} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Buscar aluno..."
          placeholderTextColor={colors.textDim2}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nenhum aluno vinculado ainda. Compartilhe seu app com seus clientes — ao se cadastrarem, eles escolhem
            você como Personal.
          </Text>
        }
        renderItem={({ item }) => {
          const status = getBadge(item);
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('StudentDetail', { studentId: item.id, studentName: item.name })}
            >
              <Avatar uri={item.avatar_url} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name || 'Aluno sem nome'}</Text>
                <Text style={styles.cardSubtitle}>{item.email}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: status.glow }]}>
                <Text style={[styles.badgeText, { color: status.color }]}>{status.text}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textDim2} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  search: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 15 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
