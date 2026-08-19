-- ============================================================
-- SCHEMA V29 — Backfill: torna clicáveis as notificações
-- ANTIGAS (criadas antes da v28, que não tinham a coluna `data`).
--
--   Roda DEPOIS do schema_v28_notification_deeplink.sql.
--   É um script de ajuste único (não precisa rodar de novo depois
--   — mas se rodar, não tem problema: só mexe em notificações que
--   ainda não têm "kind" preenchido).
--
--   Reconhece os formatos de título/corpo que já existem no banco,
--   inclusive o duplicado com emoji "Treino concluído! 💪 /
--   Fulano acabou de finalizar o treino: X" que não vem de nenhum
--   arquivo de schema salvo (gatilho criado direto no SQL Editor
--   em algum momento).
--
--   O "match" é por aproximação: acha o aluno pelo nome citado no
--   texto (dentre os alunos daquele personal) e o treino/log mais
--   próximo em horário da data da notificação. Pode errar em casos
--   raros (dois alunos com nomes muito parecidos, dois treinos no
--   mesmo minuto etc.) — se sobrar alguma notificação sem link
--   depois disso, é porque não deu pra confirmar o match com
--   segurança, e ela simplesmente continua sem seta de navegação
--   (não quebra nada).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extrai nome do aluno / nome do treino / tipo, a partir do
--    texto de cada notificação ainda sem metadados.
-- ------------------------------------------------------------
create temporary table _notif_backfill on commit drop as
select
  n.id as notification_id,
  n.user_id as recipient_id,
  n.created_at,
  case
    when n.title ~ '^(.+) concluiu um treino$'
      then trim(substring(n.title from '^(.+) concluiu um treino$'))
    when n.title like 'Treino concluído!%' and n.body ~ '^(.+) acabou de finalizar o treino: '
      then trim(substring(n.body from '^(.+) acabou de finalizar o treino: '))
    when n.title ~ '^(.+) não vai treinar hoje$'
      then trim(substring(n.title from '^(.+) não vai treinar hoje$'))
    when n.title ~ '^(.+) deixou um comentário no treino$'
      then trim(substring(n.title from '^(.+) deixou um comentário no treino$'))
    else null
  end as student_name_guess,
  case
    when n.title like 'Treino concluído!%' and n.body ~ ': (.+)$'
      then trim(substring(n.body from ': ([^:]+)$'))
    when n.title ~ '^(.+) concluiu um treino$' and n.body ~ '^(.+) foi finalizado\.?$'
      then trim(substring(n.body from '^(.+) foi finalizado\.?$'))
    when n.title = 'Novo treino disponível' and n.body ~ 'cadastrou o treino "(.+)" pra você'
      then trim(substring(n.body from 'cadastrou o treino "(.+)" pra você'))
    else null
  end as workout_name_guess,
  case
    when n.title ~ '^(.+) concluiu um treino$' then 'workout_finished'
    when n.title like 'Treino concluído!%' then 'workout_finished'
    when n.title ~ '^(.+) não vai treinar hoje$' then 'workout_skipped'
    when n.title ~ '^(.+) deixou um comentário no treino$' then 'workout_feedback'
    when n.title = 'Novo treino disponível' then 'new_workout'
    else null
  end as kind_guess
from notifications n
where (n.data is null or n.data = '{}'::jsonb or (n.data->>'kind') is null);

-- ------------------------------------------------------------
-- 2. workout_finished / workout_feedback (personal recebeu):
--    acha o aluno pelo nome (entre os alunos DAQUELE personal) e
--    o log de treino concluído mais próximo em horário.
-- ------------------------------------------------------------
update notifications n
set data = jsonb_build_object(
  'kind', b.kind_guess,
  'workoutLogId', match.log_id,
  'workoutId', match.workout_id,
  'studentId', match.student_id,
  'studentName', match.student_name
)
from _notif_backfill b
join lateral (
  select p.id as student_id, p.name as student_name, wl.id as log_id, wl.workout_id as workout_id
  from profiles p
  join lateral (
    select wl.id, wl.workout_id, wl.finished_at
    from workout_logs wl
    left join workouts w on w.id = wl.workout_id
    where wl.user_id = p.id
      and wl.finished_at is not null
      and (b.kind_guess <> 'workout_feedback' or (wl.feedback_comment is not null and length(trim(wl.feedback_comment)) > 0))
      and (b.workout_name_guess is null or w.name ilike b.workout_name_guess)
    order by abs(extract(epoch from (wl.finished_at - b.created_at)))
    limit 1
  ) wl on true
  where p.personal_id = b.recipient_id
    and p.name ilike ('%' || b.student_name_guess || '%')
  order by (p.name = b.student_name_guess) desc, abs(extract(epoch from (wl.finished_at - b.created_at)))
  limit 1
) match on true
where n.id = b.notification_id
  and b.kind_guess in ('workout_finished', 'workout_feedback')
  and b.student_name_guess is not null
  and match.log_id is not null;

-- ------------------------------------------------------------
-- 3. workout_skipped (personal recebeu): mesma ideia, mas usando
--    o log marcado como "pulado" mais próximo em horário.
-- ------------------------------------------------------------
update notifications n
set data = jsonb_build_object(
  'kind', 'workout_skipped',
  'workoutLogId', match.log_id,
  'workoutId', match.workout_id,
  'studentId', match.student_id,
  'studentName', match.student_name
)
from _notif_backfill b
join lateral (
  select p.id as student_id, p.name as student_name, wl.id as log_id, wl.workout_id as workout_id
  from profiles p
  join lateral (
    select wl.id, wl.workout_id, wl.started_at
    from workout_logs wl
    where wl.user_id = p.id
      and wl.skipped = true
    order by abs(extract(epoch from (wl.started_at - b.created_at)))
    limit 1
  ) wl on true
  where p.personal_id = b.recipient_id
    and p.name ilike ('%' || b.student_name_guess || '%')
  order by (p.name = b.student_name_guess) desc, abs(extract(epoch from (wl.started_at - b.created_at)))
  limit 1
) match on true
where n.id = b.notification_id
  and b.kind_guess = 'workout_skipped'
  and b.student_name_guess is not null
  and match.log_id is not null;

-- ------------------------------------------------------------
-- 4. new_workout (aluno recebeu): o próprio destinatário é o
--    aluno, então só precisa achar o treino pelo nome mais
--    próximo em horário de criação.
-- ------------------------------------------------------------
update notifications n
set data = jsonb_build_object('kind', 'new_workout', 'workoutId', match.workout_id)
from _notif_backfill b
join lateral (
  select w.id as workout_id
  from workouts w
  where w.user_id = b.recipient_id
    and (b.workout_name_guess is null or w.name ilike b.workout_name_guess)
  order by abs(extract(epoch from (w.created_at - b.created_at)))
  limit 1
) match on true
where n.id = b.notification_id
  and b.kind_guess = 'new_workout'
  and match.workout_id is not null;

-- ------------------------------------------------------------
-- 5. Conferir o resultado (quantas notificações antigas ficaram
--    sem match e continuam sem link de navegação):
-- ------------------------------------------------------------
-- select count(*) from notifications where data is null or data = '{}'::jsonb or data->>'kind' is null;

-- ============================================================
-- FIM DO SCHEMA V29
-- ============================================================
