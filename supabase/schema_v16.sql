-- ============================================================
-- SCHEMA V16
--   1. NOTIFICATIONS - a tela de notificações e o sininho já
--      existiam no app, mas nada gravava na tabela (ela nem
--      existia). Este script cria a tabela e os gatilhos que
--      geram notificações automaticamente:
--        - aluno concluiu um treino          -> avisa o personal
--        - aluno pulou o treino do dia        -> avisa o personal
--        - personal criou/atualizou um treino -> avisa o aluno
--   2. WORKOUT_EXERCISE_SUBSTITUTES - permite que o PERSONAL, ao
--      montar o treino, defina até 2 exercícios que o aluno pode
--      usar como substituto de cada exercício. O aluno, na hora
--      de treinar, só pode trocar por um desses (não escolhe
--      mais livremente de todo o catálogo).
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- É seguro rodar em cima do banco atual (não apaga nada).
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOTIFICATIONS
-- ------------------------------------------------------------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null default 'workout', -- 'workout' | 'alert' | 'message' | 'motivation'
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamp with time zone default now()
);

create index if not exists idx_notifications_user_id on notifications (user_id);

alter table notifications enable row level security;

drop policy if exists "Usuarios veem as proprias notificacoes" on notifications;
create policy "Usuarios veem as proprias notificacoes" on notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Usuarios marcam as proprias notificacoes como lidas" on notifications;
create policy "Usuarios marcam as proprias notificacoes como lidas" on notifications
  for update using (auth.uid() = user_id);

-- As notificações são criadas pelos gatilhos abaixo (security definer),
-- então não existe policy de insert para o cliente comum.

-- Gatilho: quando um workout_log é concluído ou marcado como pulado,
-- avisa o personal do aluno.
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

drop trigger if exists trg_notify_personal_on_workout_log on workout_logs;
create trigger trg_notify_personal_on_workout_log
  after update on workout_logs
  for each row
  execute function notify_personal_on_workout_log();

-- Gatilho: quando o personal cria um treino novo pra um aluno, avisa o aluno.
create or replace function notify_student_on_new_workout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null and new.created_by <> new.user_id then
    insert into notifications (user_id, type, title, body)
    values (
      new.user_id,
      'workout',
      'Novo treino disponível',
      'Seu personal cadastrou o treino "' || new.name || '" pra você.'
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
-- 2. WORKOUT_EXERCISE_SUBSTITUTES
--    Ligado ao item do treino (workout_exercises), não ao
--    exercício em si — assim o mesmo exercício pode ter
--    substitutos diferentes em treinos diferentes.
-- ------------------------------------------------------------

create table if not exists workout_exercise_substitutes (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid references workout_exercises(id) on delete cascade not null,
  substitute_exercise_id uuid references exercises(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique (workout_exercise_id, substitute_exercise_id)
);

alter table workout_exercise_substitutes enable row level security;

-- Aluno dono do treino e o personal que criou o treino podem ver os substitutos
drop policy if exists "Ve substitutos quem e dono ou personal do treino" on workout_exercise_substitutes;
create policy "Ve substitutos quem e dono ou personal do treino" on workout_exercise_substitutes
  for select using (
    exists (
      select 1
      from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and (w.user_id = auth.uid() or w.created_by = auth.uid())
    )
  );

-- Só o personal que criou o treino pode cadastrar/remover substitutos
drop policy if exists "Personal cadastra substitutos do proprio treino" on workout_exercise_substitutes;
create policy "Personal cadastra substitutos do proprio treino" on workout_exercise_substitutes
  for insert with check (
    exists (
      select 1
      from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and w.created_by = auth.uid()
    )
  );

drop policy if exists "Personal remove substitutos do proprio treino" on workout_exercise_substitutes;
create policy "Personal remove substitutos do proprio treino" on workout_exercise_substitutes
  for delete using (
    exists (
      select 1
      from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id
        and w.created_by = auth.uid()
    )
  );

-- ============================================================
-- FIM DO SCHEMA V16
-- ============================================================
