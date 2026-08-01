-- ============================================================
-- SCHEMA V14 - Flexibilidade para o aluno no dia a dia:
--   1. Pular treino do dia (com justificativa)
--   2. Pular exercício específico dentro do treino (com justificativa)
--   3. Substituir um exercício por outro na hora de treinar
--   4. Trocar o dia em que o treino é feito (com justificativa)
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- É seguro rodar em cima do banco atual (não apaga nada, só adiciona).
-- ============================================================

-- ------------------------------------------------------------
-- 1. WORKOUT_LOGS - sessão pode ser marcada como "pulada" (o aluno
--    optou por não treinar naquele dia) e/ou ter uma justificativa
--    de troca de dia (fez o treino de outro dia da semana).
-- ------------------------------------------------------------

alter table workout_logs
  add column if not exists skipped boolean not null default false,
  add column if not exists skip_reason text,
  add column if not exists day_change_reason text;

-- ------------------------------------------------------------
-- 2. WORKOUT_LOG_EXERCISE_STATUS - registra, por exercício, quando o
--    aluno pulou o exercício específico ou o substituiu por outro.
--    Se não houver linha aqui pra um exercício, ele foi feito normalmente.
-- ------------------------------------------------------------

do $$ begin
  create type exercise_log_status as enum ('pulado', 'substituido');
exception
  when duplicate_object then null;
end $$;

create table if not exists workout_log_exercise_status (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid references workout_logs(id) on delete cascade not null,
  exercise_id uuid references exercises(id) on delete cascade not null, -- exercício originalmente planejado
  status exercise_log_status not null,
  substitute_exercise_id uuid references exercises(id) on delete set null, -- preenchido só quando status = 'substituido'
  reason text,
  created_at timestamp with time zone default now(),
  unique (workout_log_id, exercise_id)
);

alter table workout_log_exercise_status enable row level security;

-- aluno vê/insere status dos seus próprios logs
create policy "Usuários veem status dos seus exercícios" on workout_log_exercise_status
  for select using (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );

create policy "Usuários registram status dos seus exercícios" on workout_log_exercise_status
  for insert with check (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );

-- personal vê o status dos exercícios dos seus alunos (mesmo padrão do schema_v4)
create policy "Personal ve status dos exercicios dos seus clientes" on workout_log_exercise_status
  for select using (
    exists (
      select 1 from workout_logs l
      join profiles c on c.id = l.user_id
      where l.id = workout_log_id and c.personal_id = auth.uid()
    )
  );

-- ============================================================
-- FIM DO SCHEMA V14
-- ============================================================
