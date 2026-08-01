-- ============================================================
-- SCHEMA DO APP "MEU TREINO"
-- Rode este script inteiro em: Supabase -> SQL Editor -> New query
-- ============================================================

-- Perfil do usuário (complementa a tabela auth.users do Supabase)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  height_cm numeric,
  weight_kg numeric,
  created_at timestamp with time zone default now()
);

-- Catálogo de exercícios (pode ser global, todos usuários enxergam)
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text,
  created_at timestamp with time zone default now()
);

-- Planos de treino criados pelo usuário (ex: "Treino A - Peito e Tríceps")
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default now()
);

-- Exercícios dentro de um plano de treino, com séries/reps alvo
create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts on delete cascade not null,
  exercise_id uuid references exercises on delete cascade not null,
  target_sets int not null default 3,
  target_reps int not null default 12,
  order_index int not null default 0
);

-- Registro de uma sessão de treino realizada (quando o usuário treina de fato)
create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  workout_id uuid references workouts on delete set null,
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone
);

-- Séries realizadas dentro de uma sessão (peso e reps reais feitos)
create table if not exists workout_log_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid references workout_logs on delete cascade not null,
  exercise_id uuid references exercises on delete cascade not null,
  set_number int not null,
  reps_done int,
  weight_kg numeric,
  created_at timestamp with time zone default now()
);

-- ============================================================
-- SEGURANÇA (Row Level Security) - cada usuário só vê seus dados
-- ============================================================

alter table profiles enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table workout_logs enable row level security;
alter table workout_log_sets enable row level security;
alter table exercises enable row level security;

-- profiles: usuário só vê/edita o próprio perfil
create policy "Usuários veem o próprio perfil" on profiles
  for select using (auth.uid() = id);
create policy "Usuários editam o próprio perfil" on profiles
  for update using (auth.uid() = id);
create policy "Usuários criam o próprio perfil" on profiles
  for insert with check (auth.uid() = id);

-- exercises: catálogo é visível para todos os usuários logados
create policy "Todos podem ver exercícios" on exercises
  for select using (auth.role() = 'authenticated');

-- workouts: usuário só vê/edita/apaga seus próprios planos
create policy "Usuários veem seus treinos" on workouts
  for select using (auth.uid() = user_id);
create policy "Usuários criam seus treinos" on workouts
  for insert with check (auth.uid() = user_id);
create policy "Usuários editam seus treinos" on workouts
  for update using (auth.uid() = user_id);
create policy "Usuários apagam seus treinos" on workouts
  for delete using (auth.uid() = user_id);

-- workout_exercises: acesso via o treino relacionado pertencer ao usuário
create policy "Usuários veem exercícios do seu treino" on workout_exercises
  for select using (
    exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
  );
create policy "Usuários adicionam exercícios ao seu treino" on workout_exercises
  for insert with check (
    exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
  );
create policy "Usuários apagam exercícios do seu treino" on workout_exercises
  for delete using (
    exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

-- workout_logs: usuário só vê/cria seus próprios registros
create policy "Usuários veem seus registros" on workout_logs
  for select using (auth.uid() = user_id);
create policy "Usuários criam seus registros" on workout_logs
  for insert with check (auth.uid() = user_id);
create policy "Usuários atualizam seus registros" on workout_logs
  for update using (auth.uid() = user_id);

-- workout_log_sets: acesso via o log relacionado pertencer ao usuário
create policy "Usuários veem suas séries" on workout_log_sets
  for select using (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );
create policy "Usuários criam suas séries" on workout_log_sets
  for insert with check (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );

-- ============================================================
-- DADOS INICIAIS: catálogo básico de exercícios
-- ============================================================
insert into exercises (name, muscle_group) values
  ('Supino reto', 'Peito'),
  ('Supino inclinado', 'Peito'),
  ('Crucifixo', 'Peito'),
  ('Puxada frente', 'Costas'),
  ('Remada curvada', 'Costas'),
  ('Levantamento terra', 'Costas'),
  ('Agachamento livre', 'Pernas'),
  ('Leg press', 'Pernas'),
  ('Cadeira extensora', 'Pernas'),
  ('Cadeira flexora', 'Pernas'),
  ('Rosca direta', 'Bíceps'),
  ('Rosca alternada', 'Bíceps'),
  ('Tríceps corda', 'Tríceps'),
  ('Tríceps testa', 'Tríceps'),
  ('Desenvolvimento ombro', 'Ombros'),
  ('Elevação lateral', 'Ombros'),
  ('Abdominal supra', 'Abdômen'),
  ('Prancha', 'Abdômen')
on conflict do nothing;
