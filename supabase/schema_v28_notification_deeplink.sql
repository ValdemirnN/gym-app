-- ============================================================
-- SCHEMA V28 — Notificações clicáveis (deep link)
--
--   Adiciona uma coluna `data` (jsonb) na tabela `notifications`
--   guardando o que precisa pra navegar direto pro lugar certo
--   quando o usuário toca na notificação: { kind, workoutLogId,
--   workoutId, studentId, studentName }.
--
--   Este script SUBSTITUI a lógica das funções criadas na v16,
--   v25/v27 (se você já rodou a v27, pode rodar esta tranquilo —
--   é tudo idempotente e não apaga nada).
--
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- 1. Coluna de metadados pra navegação
alter table notifications add column if not exists data jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- 2. Personal: treino concluído / comentário / pulou o dia
-- ------------------------------------------------------------
create or replace function notify_personal_on_workout_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_personal_id uuid;
  v_student_name text;
  v_workout_name text;
begin
  select personal_id, name into v_personal_id, v_student_name
  from profiles where id = new.user_id;

  if v_personal_id is null then
    return new;
  end if;

  select name into v_workout_name from workouts where id = new.workout_id;

  -- Treino concluído agora (finished_at passou de null pra preenchido)
  if new.finished_at is not null and (old.finished_at is null) then
    insert into notifications (user_id, type, title, body, data)
    values (
      v_personal_id,
      'workout',
      coalesce(v_student_name, 'Aluno') || ' concluiu um treino',
      coalesce(v_workout_name, 'Treino') || ' foi finalizado.',
      jsonb_build_object(
        'kind', 'workout_finished',
        'workoutLogId', new.id,
        'workoutId', new.workout_id,
        'studentId', new.user_id,
        'studentName', v_student_name
      )
    );

    -- Notificação extra e específica quando tem comentário de feedback
    if new.feedback_comment is not null and length(trim(new.feedback_comment)) > 0 then
      insert into notifications (user_id, type, title, body, data)
      values (
        v_personal_id,
        'message',
        coalesce(v_student_name, 'Aluno') || ' deixou um comentário no treino',
        left(new.feedback_comment, 140),
        jsonb_build_object(
          'kind', 'workout_feedback',
          'workoutLogId', new.id,
          'workoutId', new.workout_id,
          'studentId', new.user_id,
          'studentName', v_student_name
        )
      );
    end if;
  end if;

  -- Treino do dia marcado como pulado agora
  if new.skipped = true and (old.skipped is distinct from true) then
    insert into notifications (user_id, type, title, body, data)
    values (
      v_personal_id,
      'alert',
      coalesce(v_student_name, 'Aluno') || ' não vai treinar hoje',
      coalesce(new.skip_reason, 'Nenhum motivo informado.'),
      jsonb_build_object(
        'kind', 'workout_skipped',
        'workoutLogId', new.id,
        'workoutId', new.workout_id,
        'studentId', new.user_id,
        'studentName', v_student_name
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_personal_on_workout_log on workout_logs;
create trigger trg_notify_personal_on_workout_log
  after update on workout_logs
  for each row
  execute function notify_personal_on_workout_log();

-- ------------------------------------------------------------
-- 3. Aluno: personal cadastrou um treino novo
-- ------------------------------------------------------------
create or replace function notify_student_on_new_workout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null and new.created_by <> new.user_id then
    insert into notifications (user_id, type, title, body, data)
    values (
      new.user_id,
      'workout',
      'Novo treino disponível',
      'Seu personal cadastrou o treino "' || new.name || '" pra você.',
      jsonb_build_object('kind', 'new_workout', 'workoutId', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_student_on_new_workout on workouts;
create trigger trg_notify_student_on_new_workout
  after insert on workouts
  for each row
  execute function notify_student_on_new_workout();

-- ------------------------------------------------------------
-- 4. Aluno: personal respondeu o feedback
-- ------------------------------------------------------------
create or replace function notify_student_on_personal_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_name text;
begin
  if new.personal_reply is not null
     and length(trim(new.personal_reply)) > 0
     and (old.personal_reply is distinct from new.personal_reply) then

    select name into v_workout_name from workouts where id = new.workout_id;

    insert into notifications (user_id, type, title, body, data)
    values (
      new.user_id,
      'message',
      'Seu personal respondeu seu treino',
      coalesce(v_workout_name, 'Treino') || ': ' || left(new.personal_reply, 140),
      jsonb_build_object('kind', 'personal_reply', 'workoutLogId', new.id, 'workoutId', new.workout_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_student_on_personal_reply on workout_logs;
create trigger trg_notify_student_on_personal_reply
  after update on workout_logs
  for each row
  execute function notify_student_on_personal_reply();

-- ============================================================
-- 5. DIAGNÓSTICO — notificação duplicada "Treino concluído! 💪"
--
--   Se você está vendo duas notificações diferentes pro mesmo
--   evento (uma "Treino concluído! 💪 ..." e outra "Fulano concluiu
--   um treino"), existe outro gatilho na tabela workout_logs além
--   do trg_notify_personal_on_workout_log — provavelmente criado
--   direto no SQL Editor em algum momento e nunca salvo num arquivo
--   de schema. Rode a consulta abaixo pra listar todos os gatilhos
--   de UPDATE em workout_logs e identificar o duplicado (você pode
--   então rodar `drop trigger nome_do_gatilho on workout_logs;`
--   pra remover o que não é mais usado):
--
--   select tgname, tgrelid::regclass, tgtype
--   from pg_trigger
--   where tgrelid = 'workout_logs'::regclass and not tgisinternal;
-- ============================================================

-- ============================================================
-- FIM DO SCHEMA V28
-- ============================================================
