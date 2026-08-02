import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { colors, radius } from '../theme/theme';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentChallengeScreen({ navigation }) {
  const { session, profile } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [ranking, setRanking] = useState({});

  const load = useCallback(async () => {
    if (!profile?.personal_id) {
      setChallenges([]);
      return;
    }
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('personal_id', profile.personal_id)
      .order('start_date', { ascending: false })
      .limit(5);
    setChallenges(data || []);

    for (const c of data || []) {
      const { data: students } = await supabase.from('profiles').select('id, name, avatar_url').eq('personal_id', profile.personal_id).eq('is_excluded', false);
      const studentIds = (students || []).map((s) => s.id);
      let counts = {};
      if (studentIds.length > 0) {
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('user_id')
          .in('user_id', studentIds)
          .gte('started_at', c.start_date)
          .lte('started_at', c.end_date + 'T23:59:59')
          .not('finished_at', 'is', null)
          .is('skipped', false);
        (logs || []).forEach((l) => {
          counts[l.user_id] = (counts[l.user_id] || 0) + 1;
        });
      }
      const list = (students || []).map((s) => ({ ...s, count: counts[s.id] || 0 })).sort((a, b) => b.count - a.count);
      setRanking((prev) => ({ ...prev, [c.id]: list }));
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Desafios</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {challenges.length === 0 && (
          <Text style={styles.empty}>Seu personal ainda não criou nenhum desafio.</Text>
        )}
        {challenges.map((c) => {
          const isActive = todayISO() >= c.start_date && todayISO() <= c.end_date;
          const list = ranking[c.id] || [];
          const winner = list.find((s) => s.id === c.winner_id);
          const myPosition = list.findIndex((s) => s.id === session.user.id);
          return (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                {isActive && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Em andamento</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDates}>
                {formatDate(c.start_date)} até {formatDate(c.end_date)}
              </Text>
              {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
              {c.prize ? (
                <View style={styles.prizeBadge}>
                  <Feather name="award" size={13} color={colors.amber} />
                  <Text style={styles.prizeText}> Premiação: {c.prize}</Text>
                </View>
              ) : null}
              {c.winner_id && winner ? <Text style={styles.winnerText}>🏆 Vencedor: {winner.name}</Text> : null}

              {myPosition >= 0 && (
                <Text style={styles.myPosition}>
                  Você está em {myPosition + 1}º lugar, com {list[myPosition].count} treino
                  {list[myPosition].count === 1 ? '' : 's'} concluído{list[myPosition].count === 1 ? '' : 's'}
                </Text>
              )}

              <Text style={styles.rankingTitle}>Ranking</Text>
              {list.slice(0, 10).map((s, i) => (
                <View key={s.id} style={[styles.rankRow, s.id === session.user.id && styles.rankRowMe]}>
                  <Text style={styles.rankPosition}>{i + 1}º</Text>
                  <Avatar uri={s.avatar_url} size={28} />
                  <Text style={styles.rankName}>{s.name}</Text>
                  <Text style={styles.rankCount}>{s.count}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  empty: { color: colors.textDim, fontSize: 13, marginTop: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  activeBadge: { backgroundColor: colors.accentGlow, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  activeBadgeText: { color: colors.accent, fontSize: 10.5, fontWeight: '700' },
  cardDates: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  desc: { color: colors.textDim, fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  prizeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  prizeText: { color: colors.amber, fontSize: 12.5, fontWeight: '600' },
  winnerText: { color: colors.accent, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  myPosition: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 10, backgroundColor: colors.accentGlow, padding: 10, borderRadius: radius.sm },
  rankingTitle: { color: colors.textDim, fontSize: 11.5, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rankRowMe: { backgroundColor: colors.accentGlow, borderRadius: radius.sm, paddingHorizontal: 6 },
  rankPosition: { color: colors.textDim2, fontSize: 13, fontWeight: '700', width: 22 },
  rankName: { color: colors.text, fontSize: 13, flex: 1 },
  rankCount: { color: colors.accent, fontSize: 12.5, fontWeight: '700' },
});
