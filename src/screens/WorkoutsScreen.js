import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { getPendingCount, onQueueChange } from '../lib/syncManager';

function diasDesde(dateStr) {
  if (!dateStr) return 'hoje';
  const dias = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'há 1 dia';
  return `há ${dias} dias`;
}

// ─── Componente: card de bloco na lista (mesmo visual usado pelo personal,
// só que aqui é sempre somente leitura — o aluno só entra pra ver/executar) ──
function BlockCard({ block, onPress }) {
  const isActive = block.isActive;

  return (
    <TouchableOpacity style={styles.blockCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.blockCardContent}>
        <View style={styles.blockIcon}>
          <Feather name="layers" size={18} color={colors.accent} />
        </View>

        <View style={styles.blockInfo}>
          <View
            style={[
              styles.statusPill,
              isActive ? styles.statusPillAndamento : styles.statusPillConcluido,
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: isActive ? colors.amber : colors.textDim }]} />
            <Text style={[styles.statusText, { color: isActive ? colors.amber : colors.textDim }]}>
              {isActive ? 'Em andamento' : 'Concluído'}
            </Text>
          </View>
          <Text style={styles.blockTitle}>{[block.goal, block.level].filter(Boolean).join(' · ') || 'Treino'}</Text>
          <View style={styles.blockMeta}>
            <Text style={styles.blockMetaText}>
              {block.workouts.length} treino{block.workouts.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.metaDot} />
            <Text style={styles.blockMetaText}>criado {diasDesde(block.created_at)}</Text>
          </View>
        </View>

        <Feather name="chevron-right" size={16} color={colors.textDim2} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Tela principal ──────────────────────────────────────────────────────────
export default function WorkoutsScreen({ navigation }) {
  const { session } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [tab, setTab] = useState('ativos');

  useEffect(() => {
    getPendingCount().then(setPendingCount);
    const unsubscribe = onQueueChange(setPendingCount);
    return unsubscribe;
  }, []);

  const loadWorkouts = useCallback(async () => {
    const { data } = await supabase
      .from('workouts')
      .select('id, name, created_at, day_of_week, goal, level, period_start, period_end')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    setAllWorkouts(data || []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  // Agrupa treinos em "blocos" por período (period_start/period_end igual = mesmo bloco).
  // Treinos sem período definido (a maioria, no dia a dia) entram todos juntos
  // num único bloco "atual" — é o plano corrente do aluno, dividido por dia.
  const blocks = (() => {
    const map = {};
    allWorkouts.forEach((w) => {
      const key = w.period_start ? `${w.period_start}__${w.period_end}` : 'sem_periodo';
      if (!map[key]) {
        map[key] = {
          key,
          goal: w.goal,
          level: w.level,
          period_start: w.period_start,
          period_end: w.period_end,
          created_at: w.created_at,
          workouts: [],
          isActive: false,
        };
      }
      // Usa o goal/level/created_at mais recente do grupo pra representar o bloco
      if (new Date(w.created_at) > new Date(map[key].created_at)) {
        map[key].goal = w.goal || map[key].goal;
        map[key].level = w.level || map[key].level;
        map[key].created_at = w.created_at;
      }
      map[key].workouts.push(w);
    });

    const now = new Date();
    return Object.values(map).map((b) => {
      const end = b.period_end ? new Date(b.period_end) : null;
      b.isActive = !end || end >= now;
      return b;
    }).sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0)
      || new Date(b.created_at) - new Date(a.created_at));
  })();

  const visibleBlocks = blocks.filter((b) => (tab === 'ativos' ? b.isActive : !b.isActive));

  const openBlock = (block) => {
    navigation.navigate('BlockDays', {
      block: {
        workouts: block.workouts,
        goal: block.goal,
        level: block.level,
        periodStart: block.period_start,
        periodEnd: block.period_end,
      },
    });
  };

  return (
    <View style={styles.container}>
      {/* ── Topbar ── */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.eyebrow}>TREINOS</Text>
          <Text style={styles.title}>Meus Treinos</Text>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'ativos' && styles.tabButtonActive]}
          onPress={() => setTab('ativos')}
        >
          <Text style={[styles.tabText, tab === 'ativos' && styles.tabTextActive]}>Ativos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'finalizados' && styles.tabButtonActive]}
          onPress={() => setTab('finalizados')}
        >
          <Text style={[styles.tabText, tab === 'finalizados' && styles.tabTextActive]}>Finalizados</Text>
        </TouchableOpacity>
      </View>

      {/* ── Banner de sincronização ── */}
      {pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Feather name="upload-cloud" size={14} color={colors.accent} />
          <Text style={styles.syncBannerText}>
            {pendingCount} treino{pendingCount > 1 ? 's' : ''} salvo{pendingCount > 1 ? 's' : ''} no
            aparelho, aguardando internet pra enviar
          </Text>
        </View>
      )}

      {/* ── Conteúdo ── */}
      <ScrollView contentContainerStyle={styles.blocksList} showsVerticalScrollIndicator={false}>
        {visibleBlocks.length === 0 ? (
          <Text style={styles.empty}>
            {tab === 'finalizados'
              ? 'Nenhum treino finalizado ainda.'
              : 'Nenhum treino criado ainda. Peça pro seu personal montar seu primeiro plano.'}
          </Text>
        ) : (
          visibleBlocks.map((block) => (
            <BlockCard key={block.key} block={block} onPress={() => openBlock(block)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },

  // ── Topbar
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textDim2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },

  // ── Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line ?? colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabButtonActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#08110A' },

  // ── Sync banner
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGlow,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 18,
    marginTop: 14,
  },
  syncBannerText: { color: colors.accent, fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 16 },

  empty: {
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },

  // ── Blocks list
  blocksList: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 40,
  },
  blockCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line ?? colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  blockCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  blockIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  blockInfo: { flex: 1 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  statusPillAndamento: { backgroundColor: colors.amberGlow ?? 'rgba(253,180,78,0.14)' },
  statusPillConcluido: { backgroundColor: 'rgba(138,151,166,0.14)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  blockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line ?? colors.border,
  },
  blockMetaText: { fontSize: 11.5, color: colors.textDim },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textDim2 },
});
