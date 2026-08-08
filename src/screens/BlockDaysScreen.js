import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

const DAY_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const DAY_LABEL = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo',
};
const DAY_SHORT = {
  segunda: 'SEG',
  terca: 'TER',
  quarta: 'QUA',
  quinta: 'QUI',
  sexta: 'SEX',
  sabado: 'SAB',
  domingo: 'DOM',
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}
function formatDateTime(d) {
  return new Date(d).toLocaleDateString('pt-BR');
}

// Tela do aluno: mesma estrutura visual usada pelo personal (dia + card por treino),
// só que 100% somente-leitura — sem "Adicionar treino", sem editar, sem excluir.
// Tocar num treino abre ele direto pra ver/executar.
export default function BlockDaysScreen({ route, navigation }) {
  const { block } = route.params;
  const [execStats, setExecStats] = useState({}); // workoutId -> { count, last }

  const today = new Date().toISOString().slice(0, 10);
  const isCurrent = !block.periodEnd || block.periodEnd >= today;

  const load = useCallback(async () => {
    const workoutIds = block.workouts.map((w) => w.id);
    if (workoutIds.length === 0) return;
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('workout_id, started_at, finished_at, skipped')
      .in('workout_id', workoutIds)
      .not('finished_at', 'is', null)
      .is('skipped', false)
      .order('started_at', { ascending: false });

    const stats = {};
    (logs || []).forEach((l) => {
      if (!stats[l.workout_id]) stats[l.workout_id] = { count: 0, last: null };
      stats[l.workout_id].count += 1;
      if (!stats[l.workout_id].last) stats[l.workout_id].last = l.started_at;
    });
    setExecStats(stats);
  }, [block]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Agrupa os treinos do bloco por dia da semana
  const dayGroups = DAY_ORDER.map((day) => ({
    day,
    workouts: block.workouts.filter((w) => w.day_of_week === day),
  })).filter((g) => g.workouts.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={18} color={colors.textDim} />
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>PLANO SELECIONADO</Text>
          <Text style={styles.title}>Treinos por dia</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, isCurrent && styles.summaryCardCurrent]}>
          <View style={[styles.statusPill, isCurrent ? styles.statusPillCurrent : styles.statusPillPast]}>
            <View style={[styles.statusDot, { backgroundColor: isCurrent ? colors.amber : colors.textDim }]} />
            <Text style={[styles.statusPillText, { color: isCurrent ? colors.amber : colors.textDim }]}>
              {isCurrent ? 'Em andamento' : 'Concluído'}
            </Text>
          </View>
          <Text style={styles.summaryTitle}>{[block.goal, block.level].filter(Boolean).join(' · ') || 'Treino'}</Text>
          {(block.periodStart || block.periodEnd) && (
            <Text style={styles.summaryMeta}>
              {formatDate(block.periodStart)} – {formatDate(block.periodEnd)}
            </Text>
          )}
        </View>

        {dayGroups.map((g) => (
          <View key={g.day}>
            <Text style={styles.sectionHeader}>{DAY_LABEL[g.day].toUpperCase()}</Text>

            {g.workouts.map((w) => {
              const stat = execStats[w.id];
              return (
                <TouchableOpacity
                  key={w.id}
                  style={styles.workoutCard}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('WorkoutDetail', {
                      workoutId: w.id,
                      workoutName: w.name,
                      dayOfWeek: g.day,
                    })
                  }
                >
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{DAY_SHORT[g.day]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayLabel}>{DAY_LABEL[g.day]}</Text>
                    <Text style={styles.workoutName}>{w.name}</Text>
                    {stat?.count ? (
                      <Text style={styles.workoutExec}>
                        Executado {stat.count}x{stat.last ? ` · última em ${formatDateTime(stat.last)}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textDim2} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, marginBottom: 4 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  eyebrow: { color: colors.textDim2, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 2 },
  summaryCard: {
    marginHorizontal: 18,
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCardCurrent: { borderColor: 'rgba(51,226,139,.35)' },
  summaryTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  summaryMeta: { color: colors.textDim, fontSize: 12, marginTop: 6 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
    marginBottom: 6,
  },
  statusPillCurrent: { backgroundColor: colors.amberGlow ?? 'rgba(253,180,78,0.14)' },
  statusPillPast: { backgroundColor: 'rgba(141,150,166,.14)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  sectionHeader: {
    color: colors.textDim2,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
    marginHorizontal: 18,
  },

  // Um card por treino do dia — mesmo desenho do dayCard que o personal usa
  // (badge do dia + nome + seta), só que aqui sempre navega direto pra ver/executar.
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 18,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 15,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dayBadgeText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  dayLabel: { color: colors.textDim2, fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase' },
  workoutName: { color: colors.text, fontSize: 14.5, fontWeight: '700', marginTop: 2 },
  workoutExec: { color: colors.textDim2, fontSize: 11, marginTop: 4 },
});
