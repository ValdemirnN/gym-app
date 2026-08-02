-- ============================================================
-- SCHEMA V17
--   1. Aluno "excluído" (soft delete, sem perder o cadastro)
--   2. Avaliações físicas (medidas) + histórico + metas
--   3. Desafios do personal + ranking + premiação
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ALUNO EXCLUÍDO (sem apagar o cadastro de verdade)
-- ------------------------------------------------------------
alter table profiles add column if not exists is_excluded boolean not null default false;
alter table profiles add column if not exists excluded_at timestamp with time zone;

-- ------------------------------------------------------------
-- 2. AVALIAÇÕES FÍSICAS (medidas) + METAS
-- ------------------------------------------------------------
create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  personal_id uuid references profiles(id) on delete cascade not null,
  evaluation_date date not null default current_date,
  weight_kg numeric(5,2),
  body_fat_pct numeric(4,1),
  -- medidas em cm, tudo opcional: peito, cintura, quadril, braço, coxa, panturrilha...
  measurements jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_evaluations_student on evaluations (student_id, evaluation_date desc);

alter table evaluations enable row level security;

drop policy if exists "Personal gerencia avaliacoes dos seus alunos" on evaluations;
create policy "Personal gerencia avaliacoes dos seus alunos" on evaluations
  for all using (personal_id = auth.uid()) with check (personal_id = auth.uid());

drop policy if exists "Aluno ve as proprias avaliacoes" on evaluations;
create policy "Aluno ve as proprias avaliacoes" on evaluations
  for select using (student_id = auth.uid());

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  personal_id uuid references profiles(id) on delete cascade not null,
  description text not null,
  target_date date,
  achieved boolean not null default false,
  achieved_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table goals enable row level security;

drop policy if exists "Personal gerencia metas dos seus alunos" on goals;
create policy "Personal gerencia metas dos seus alunos" on goals
  for all using (personal_id = auth.uid()) with check (personal_id = auth.uid());

drop policy if exists "Aluno ve as proprias metas" on goals;
create policy "Aluno ve as proprias metas" on goals
  for select using (student_id = auth.uid());

-- ------------------------------------------------------------
-- 3. DESAFIOS + RANKING + PREMIAÇÃO
-- ------------------------------------------------------------
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  prize text,
  start_date date not null,
  end_date date not null,
  winner_id uuid references profiles(id),
  created_at timestamp with time zone default now()
);

alter table challenges enable row level security;

drop policy if exists "Personal gerencia os proprios desafios" on challenges;
create policy "Personal gerencia os proprios desafios" on challenges
  for all using (personal_id = auth.uid()) with check (personal_id = auth.uid());

drop policy if exists "Alunos veem os desafios do proprio personal" on challenges;
create policy "Alunos veem os desafios do proprio personal" on challenges
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.personal_id = challenges.personal_id)
  );

-- ============================================================
-- FIM DO SCHEMA V17
-- ============================================================
