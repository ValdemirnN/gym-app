// supabase/functions/daily-reminder/index.ts
//
// Roda uma vez por dia (agendado via pg_cron, ver schema_v21.sql).
// Pra cada aluno que tem um treino previsto pra HOJE (pelo dia da
// semana cadastrado em `workouts.day_of_week`) e que ainda não fez
// nenhum treino hoje, cria uma notificação "Hoje é dia de treino!" —
// que por sua vez já dispara o push de verdade (reaproveita o
// gatilho trg_send_push_on_notification do schema_v21.sql).
//
// DEPLOY: mesmo processo do send-push, mas com o nome "daily-reminder":
//   supabase functions deploy daily-reminder

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DAY_NAMES = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date();
  const todayName = DAY_NAMES[today.getDay()];
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  // Treinos previstos pra hoje
  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, name, user_id')
    .eq('day_of_week', todayName);

  if (!workouts || workouts.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'nenhum treino previsto pra hoje' }), { status: 200 });
  }

  const studentIds = [...new Set(workouts.map((w) => w.user_id))];

  // Quem já treinou hoje não recebe o lembrete
  const { data: doneToday } = await supabase
    .from('workout_logs')
    .select('user_id')
    .in('user_id', studentIds)
    .gte('started_at', startOfDay.toISOString());

  const alreadyDone = new Set((doneToday || []).map((l) => l.user_id));

  const notifications = workouts
    .filter((w) => !alreadyDone.has(w.user_id))
    .map((w) => ({
      user_id: w.user_id,
      type: 'workout',
      title: 'Hoje é dia de treino! 💪',
      body: `Não esquece do "${w.name}" hoje.`,
    }));

  // Um aluno pode ter mais de um treino no mesmo dia — manda só 1 lembrete
  const seen = new Set();
  const uniqueNotifications = notifications.filter((n) => {
    if (seen.has(n.user_id)) return false;
    seen.add(n.user_id);
    return true;
  });

  if (uniqueNotifications.length > 0) {
    await supabase.from('notifications').insert(uniqueNotifications);
  }

  return new Response(JSON.stringify({ sent: uniqueNotifications.length }), { status: 200 });
});
