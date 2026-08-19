-- ============================================================
-- SCHEMA V27 — Notificações completas do ciclo de feedback
--
--   1. Quando o aluno finaliza um treino E deixa um comentário
--      (feedback_comment), o personal recebe uma notificação
--      ESPECÍFICA de feedback (além da de "treino concluído" que
--      já existia desde a v16) — assim fica claro que tem um
--      comentário esperando resposta.
--   2. Quando o personal responde o feedback (personal_reply),
--      o aluno recebe uma notificação avisando que teve resposta.
--
--   Obs: apagar Metas e apagar Avaliações físicas NÃO precisam de
--   migração — a policy "Personal gerencia avaliacoes/metas dos
--   seus alunos" (schema_v17) já usa `for all`, que inclui delete.
--   Faltava só o botão no app (feito no StudentEvaluationsScreen).
--
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- É seguro rodar em cima do banco atual (não apaga nada).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Personal recebe notificação quando o aluno comenta o treino
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
    insert into notifications (user_id, type, title, body)
    values (
      v_personal_id,
      'workout',
      coalesce(v_student_name, 'Aluno') || ' concluiu um treino',
      coalesce(v_workout_name, 'Treino') || ' foi finalizado.'
    );

    -- Notificação extra e específica quando tem comentário de feedback,
    -- pra ficar claro que tem algo esperando resposta do personal.
    if new.feedback_comment is not null and length(trim(new.feedback_comment)) > 0 then
      insert into notifications (user_id, type, title, body)
      values (
        v_personal_id,
        'message',
        coalesce(v_student_name, 'Aluno') || ' deixou um comentário no treino',
        left(new.feedback_comment, 140)
      );
    end if;
  end if;

  -- Treino do dia marcado como pulado agora
  if new.skipped = true and (old.skipped is distinct from true) then
    insert into notifications (user_id, type, title, body)
    values (
      v_personal_id,
      'alert',
      coalesce(v_student_name, 'Aluno') || ' não vai treinar hoje',
      coalesce(new.skip_reason, 'Nenhum motivo informado.')
    );
  end if;

  return new;
end;
$$;

-- (trigger já existe desde a v16, só garantindo que aponta pra função atualizada)
drop trigger if exists trg_notify_personal_on_workout_log on workout_logs;
create trigger trg_notify_personal_on_workout_log
  after update on workout_logs
  for each row
  execute function notify_personal_on_workout_log();

-- ------------------------------------------------------------
-- 2. Aluno recebe notificação quando o personal responde o feedback
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

    insert into notifications (user_id, type, title, body)
    values (
      new.user_id,
      'message',
      'Seu personal respondeu seu treino',
      coalesce(v_workout_name, 'Treino') || ': ' || left(new.personal_reply, 140)
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
-- FIM DO SCHEMA V27
-- ============================================================
