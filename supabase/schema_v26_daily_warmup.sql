-- ============================================================
-- SCHEMA V26 - Aquecimento Diário (Daily Warmup)
--
-- Regras de negócio:
--   1. O aquecimento é vinculado ao DIA DO TREINO (ex: 'segunda'),
--      não a um exercício ou grupo muscular.
--   2. Um personal pode ter múltiplos alunos, cada aluno tem o
--      seu conjunto de treinos — o aquecimento pertence ao
--      contexto {personal_id, day_of_week}, pois é o mesmo
--      programa para todos os alunos desse personal naquele dia.
--      Se quiser aquecimento por aluno específico, basta usar o
--      campo student_id (nullable) para sobrescrever o padrão.
--   3. Personal: cria, edita e remove.
--   4. Aluno: só lê.
--
-- Rode INTEIRO no SQL Editor do Supabase. Seguro rodar em cima
-- do banco atual (não apaga nada existente).
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABELA principal
-- ------------------------------------------------------------

create table if not exists daily_warmups (
  id              uuid primary key default gen_random_uuid(),

  -- Quem criou (personal)
  personal_id     uuid references profiles(id) on delete cascade not null,

  -- Para qual dia da semana se aplica (mesma convenção já usada no app)
  day_of_week     text not null
    check (day_of_week in ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),

  -- Sobrescrita por aluno (null = vale para todos os alunos desse personal nesse dia)
  student_id      uuid references profiles(id) on delete cascade,

  -- Conteúdo do aquecimento (estrutura idêntica a um exercício)
  title           text not null default 'Aquecimento',
  instructions    text,               -- descrição/orientações
  duration_minutes int,               -- tempo estimado
  reps_detail     text,               -- ex: "3x10 polichinelos + 2 min esteira"
  video_id        uuid references exercise_videos(id) on delete set null,

  created_at      timestamp with time zone default now(),
  updated_at      timestamp with time zone default now(),

  -- Garante no máximo 1 aquecimento por {personal, dia, aluno}
  unique (personal_id, day_of_week, student_id)
);

-- Índices de leitura rápida
create index if not exists idx_warmup_personal_day
  on daily_warmups (personal_id, day_of_week);

create index if not exists idx_warmup_student
  on daily_warmups (student_id, day_of_week);

-- Atualiza updated_at automaticamente
create or replace function public.touch_warmup_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_warmup_updated_at on daily_warmups;
create trigger trg_warmup_updated_at
  before update on daily_warmups
  for each row execute function public.touch_warmup_updated_at();

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------

alter table daily_warmups enable row level security;

-- ── Leitura ──────────────────────────────────────────────────

-- Personal vê seus próprios aquecimentos
drop policy if exists "Personal ve seus aquecimentos" on daily_warmups;
create policy "Personal ve seus aquecimentos" on daily_warmups
  for select using (personal_id = auth.uid());

-- Aluno vê o aquecimento do seu personal (genérico ou específico pra ele)
drop policy if exists "Aluno ve aquecimento do seu personal" on daily_warmups;
create policy "Aluno ve aquecimento do seu personal" on daily_warmups
  for select using (
    personal_id = public.current_user_personal_id()
    and (
      student_id is null          -- aquecimento genérico do personal
      or student_id = auth.uid()  -- aquecimento específico para este aluno
    )
  );

-- ── Escrita (somente personal) ───────────────────────────────

drop policy if exists "Personal cria aquecimento" on daily_warmups;
create policy "Personal cria aquecimento" on daily_warmups
  for insert with check (
    personal_id = auth.uid()
    and public.current_user_role() = 'personal'
  );

drop policy if exists "Personal edita aquecimento" on daily_warmups;
create policy "Personal edita aquecimento" on daily_warmups
  for update using (
    personal_id = auth.uid()
    and public.current_user_role() = 'personal'
  );

drop policy if exists "Personal remove aquecimento" on daily_warmups;
create policy "Personal remove aquecimento" on daily_warmups
  for delete using (
    personal_id = auth.uid()
    and public.current_user_role() = 'personal'
  );

-- ============================================================
-- FIM DO SCHEMA V26
-- ============================================================
