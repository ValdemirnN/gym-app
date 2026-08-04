-- ============================================================
-- SCHEMA V20 - Exercícios AERÓBICOS / CARDIO
--   Até agora todo exercício era "força" (séries x repetições).
--   Agora dá pra cadastrar exercícios do tipo CARDIO (esteira,
--   bike, corrida, elíptico, pular corda...), com meta de tempo,
--   distância e intensidade — e o aluno registra o que realmente
--   fez, separado das séries de musculação.
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- Tipo do exercício: força (padrão, como já era) ou cardio
alter table exercises add column if not exists exercise_type text not null default 'forca';
alter table exercises drop constraint if exists exercises_exercise_type_check;
alter table exercises add constraint exercises_exercise_type_check check (exercise_type in ('forca', 'cardio'));

-- Metas específicas de cardio no item do treino (fica null pra exercícios de força)
alter table workout_exercises add column if not exists target_duration_minutes int;
alter table workout_exercises add column if not exists target_distance_km numeric(5,2);
alter table workout_exercises add column if not exists target_intensity text; -- 'leve' | 'moderada' | 'intensa'

-- O que o aluno realmente fez no cardio daquele treino
create table if not exists workout_log_cardio (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid references workout_logs(id) on delete cascade not null,
  exercise_id uuid references exercises(id) on delete set null,
  duration_minutes numeric(5,1),
  distance_km numeric(5,2),
  intensity text,
  created_at timestamp with time zone default now()
);

alter table workout_log_cardio enable row level security;

drop policy if exists "Usuarios veem seu proprio cardio" on workout_log_cardio;
create policy "Usuarios veem seu proprio cardio" on workout_log_cardio
  for select using (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );

drop policy if exists "Personal ve cardio dos logs dos seus clientes" on workout_log_cardio;
create policy "Personal ve cardio dos logs dos seus clientes" on workout_log_cardio
  for select using (
    exists (
      select 1 from workout_logs l
      join profiles c on c.id = l.user_id
      where l.id = workout_log_id and c.personal_id = auth.uid()
    )
  );

drop policy if exists "Usuarios registram seu proprio cardio" on workout_log_cardio;
create policy "Usuarios registram seu proprio cardio" on workout_log_cardio
  for insert with check (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );

-- ============================================================
-- FIM DO SCHEMA V20
-- ============================================================
