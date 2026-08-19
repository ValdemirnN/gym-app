-- ============================================================
-- SCHEMA V30 — Backfill complementar: "Seu personal respondeu
-- seu treino" (kind = personal_reply)
--
--   A v29 esqueceu esse caso. Este script é independente — pode
--   rodar mesmo sem ter rodado a v29 de novo, e é seguro rodar
--   mais de uma vez (só mexe em notificações sem "kind").
--
--   Rode DEPOIS do schema_v28_notification_deeplink.sql.
-- ============================================================

create temporary table _notif_backfill_reply on commit drop as
select
  n.id as notification_id,
  n.user_id as recipient_id, -- aqui o destinatário É o aluno
  n.created_at,
  case
    when n.body ~ '^(.+): '
      then trim(substring(n.body from '^(.+): '))
    else null
  end as workout_name_guess,
  case
    when n.body ~ ': (.+)$'
      then trim(substring(n.body from ': (.+)$'))
    else null
  end as reply_text_guess
from notifications n
where n.title = 'Seu personal respondeu seu treino'
  and (n.data is null or n.data = '{}'::jsonb or (n.data->>'kind') is null);

update notifications n
set data = jsonb_build_object(
  'kind', 'personal_reply',
  'workoutLogId', match.log_id,
  'workoutId', match.workout_id
)
from _notif_backfill_reply b
join lateral (
  select wl.id as log_id, wl.workout_id, wl.finished_at
  from workout_logs wl
  left join workouts w on w.id = wl.workout_id
  where wl.user_id = b.recipient_id
    and wl.personal_reply is not null
    and (b.workout_name_guess is null or w.name ilike b.workout_name_guess)
    and (b.reply_text_guess is null or wl.personal_reply ilike ('%' || left(b.reply_text_guess, 50) || '%'))
  order by abs(extract(epoch from (wl.finished_at - b.created_at)))
  limit 1
) match on true
where n.id = b.notification_id
  and match.log_id is not null;

-- Conferir se sobrou alguma sem match:
-- select id, title, body, created_at from notifications
-- where title = 'Seu personal respondeu seu treino' and (data->>'kind') is null;

-- ============================================================
-- FIM DO SCHEMA V30
-- ============================================================
