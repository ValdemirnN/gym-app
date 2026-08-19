-- ============================================================
-- MIGRAÇÃO: cria a tabela challenge_submissions (faltava no banco).
-- Cada linha = 1 ponto de um aluno num desafio (não guarda foto).
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

create table if not exists challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(id) on delete cascade not null,
  student_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_challenge_submissions_challenge on challenge_submissions (challenge_id);
create index if not exists idx_challenge_submissions_student on challenge_submissions (student_id);

alter table challenge_submissions enable row level security;

-- Aluno registra a própria prova, só em desafio do próprio personal
drop policy if exists "Aluno registra a propria prova" on challenge_submissions;
create policy "Aluno registra a propria prova" on challenge_submissions
  for insert with check (
    student_id = auth.uid()
    and exists (
      select 1 from challenges c
      join profiles p on p.id = auth.uid()
      where c.id = challenge_submissions.challenge_id
        and p.personal_id = c.personal_id
    )
  );

-- Personal e alunos do mesmo personal veem as provas (pro ranking aparecer pra todo mundo)
drop policy if exists "Ve submissions dos desafios do proprio personal" on challenge_submissions;
create policy "Ve submissions dos desafios do proprio personal" on challenge_submissions
  for select using (
    exists (
      select 1 from challenges c
      left join profiles p on p.id = auth.uid()
      where c.id = challenge_submissions.challenge_id
        and (c.personal_id = auth.uid() or p.personal_id = c.personal_id)
    )
  );

-- Personal pode apagar provas erradas/suspeitas dos seus próprios desafios
drop policy if exists "Personal remove submissions dos proprios desafios" on challenge_submissions;
create policy "Personal remove submissions dos proprios desafios" on challenge_submissions
  for delete using (
    exists (
      select 1 from challenges c
      where c.id = challenge_submissions.challenge_id
        and c.personal_id = auth.uid()
    )
  );

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
