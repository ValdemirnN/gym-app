-- ============================================================
-- SCHEMA V21
--   1. Fotos de progresso (antes/depois), ligadas à avaliação física
--   2. Questionário PAR-Q digital (liberação de saúde antes do 1º treino)
--   3. Token de push notification por usuário + gatilho que dispara
--      a notificação push de verdade sempre que uma linha nova
--      entra na tabela `notifications` (a mesma que já existe desde
--      o schema_v16)
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FOTOS DE PROGRESSO
-- ------------------------------------------------------------
create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  personal_id uuid references profiles(id) on delete cascade not null,
  evaluation_id uuid references evaluations(id) on delete set null,
  photo_date date not null default current_date,
  storage_path text not null,
  notes text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_progress_photos_student on progress_photos (student_id, photo_date desc);

alter table progress_photos enable row level security;

drop policy if exists "Personal gerencia fotos de progresso dos seus alunos" on progress_photos;
create policy "Personal gerencia fotos de progresso dos seus alunos" on progress_photos
  for all using (personal_id = auth.uid()) with check (personal_id = auth.uid());

drop policy if exists "Aluno ve e envia as proprias fotos de progresso" on progress_photos;
create policy "Aluno ve e envia as proprias fotos de progresso" on progress_photos
  for select using (student_id = auth.uid());

drop policy if exists "Aluno envia a propria foto de progresso" on progress_photos;
create policy "Aluno envia a propria foto de progresso" on progress_photos
  for insert with check (
    student_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.personal_id = progress_photos.personal_id)
  );

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

drop policy if exists "Autenticados enviam fotos de progresso" on storage.objects;
create policy "Autenticados enviam fotos de progresso" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos');

drop policy if exists "Qualquer um le fotos de progresso" on storage.objects;
create policy "Qualquer um le fotos de progresso" on storage.objects
  for select using (bucket_id = 'progress-photos');

drop policy if exists "Autenticados apagam fotos de progresso" on storage.objects;
create policy "Autenticados apagam fotos de progresso" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos');

-- ------------------------------------------------------------
-- 2. PAR-Q DIGITAL (questionário de liberação de saúde)
-- ------------------------------------------------------------
create table if not exists parq_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references profiles(id) on delete cascade not null,
  personal_id uuid references profiles(id) on delete cascade not null,
  answers jsonb not null default '{}'::jsonb, -- { q1: 'sim'|'nao', q2: ..., ... }
  has_risk boolean not null default false,     -- true se alguma resposta foi "sim" (recomenda avaliação médica)
  full_name_signature text not null,           -- "assinatura" digital = nome completo digitado
  signed_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create index if not exists idx_parq_student on parq_responses (student_id, signed_at desc);

alter table parq_responses enable row level security;

drop policy if exists "Aluno ve e assina o proprio PAR-Q" on parq_responses;
create policy "Aluno ve e assina o proprio PAR-Q" on parq_responses
  for select using (student_id = auth.uid());

drop policy if exists "Aluno assina o proprio PAR-Q" on parq_responses;
create policy "Aluno assina o proprio PAR-Q" on parq_responses
  for insert with check (student_id = auth.uid());

drop policy if exists "Personal ve o PAR-Q dos seus alunos" on parq_responses;
create policy "Personal ve o PAR-Q dos seus alunos" on parq_responses
  for select using (personal_id = auth.uid());

-- ------------------------------------------------------------
-- 3. PUSH NOTIFICATIONS DE VERDADE
-- ------------------------------------------------------------
alter table profiles add column if not exists expo_push_token text;

-- Precisa da extensão pg_net pra conseguir chamar uma URL de fora do banco
-- (a Edge Function que efetivamente manda o push pro celular).
create extension if not exists pg_net;

-- IMPORTANTE: troque a URL abaixo pela URL real da sua Edge Function depois
-- de fazer o deploy dela (veja instruções no arquivo supabase/functions/send-push/index.ts).
-- Formato: https://SEU-PROJETO.supabase.co/functions/v1/send-push
create or replace function trigger_send_push()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', new.title,
      'body', new.body
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_send_push_on_notification on notifications;
create trigger trg_send_push_on_notification
  after insert on notifications
  for each row
  execute function trigger_send_push();

-- Lembrete diário "hoje é dia de treino" — precisa da extensão pg_cron
-- (Database > Extensions > pg_cron, no painel do Supabase) e da Edge
-- Function 'daily-reminder' já publicada (ver supabase/functions/daily-reminder).
-- Troque a URL abaixo pela URL real depois do deploy.
create extension if not exists pg_cron;

select cron.schedule(
  'lembrete-diario-treino',
  '0 10 * * *', -- 10:00 UTC = 07:00 no horário de Brasília (ajuste se precisar)
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/daily-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  $$
);

-- ============================================================
-- FIM DO SCHEMA V21
-- ============================================================
