-- ============================================================
-- SCHEMA V15 - Perfil completo do aluno (anamnese física)
-- A nova tela de perfil do aluno (ProfileScreen.js) usa esses campos.
-- Sem essa migração, o "Salvar" do aluno falha porque essas colunas
-- ainda não existem na tabela profiles.
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- É seguro rodar em cima do banco atual (não apaga nada, só adiciona).
-- ============================================================

alter table profiles
  -- Contato
  add column if not exists phone text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  -- Biometria e objetivo
  add column if not exists body_fat_pct numeric,
  add column if not exists goal text,
  add column if not exists activity_level text,
  -- Anamnese física (PAR-Q)
  add column if not exists chronic_conditions text[],
  add column if not exists other_chronic_condition text,
  add column if not exists frequent_pain text,
  add column if not exists medications text,
  add column if not exists sleep_hours numeric,
  add column if not exists stress_level int,
  add column if not exists is_smoker boolean not null default false,
  add column if not exists drinks_alcohol boolean not null default false,
  -- Liberação médica
  add column if not exists liability_waiver_accepted boolean not null default false,
  add column if not exists liability_waiver_accepted_at timestamp with time zone,
  add column if not exists medical_clearance_url text;

-- ------------------------------------------------------------
-- Bucket de Storage para o atestado médico / termo assinado.
-- PRIVADO (diferente do de avatars): só o próprio aluno e o
-- personal dele podem ler; o app usa uma signed URL pra exibir.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('medical-documents', 'medical-documents', false)
on conflict (id) do nothing;

drop policy if exists "Aluno envia o proprio atestado" on storage.objects;
create policy "Aluno envia o proprio atestado" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Aluno atualiza o proprio atestado" on storage.objects;
create policy "Aluno atualiza o proprio atestado" on storage.objects
  for update to authenticated
  using (bucket_id = 'medical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Aluno le o proprio atestado" on storage.objects;
create policy "Aluno le o proprio atestado" on storage.objects
  for select to authenticated
  using (bucket_id = 'medical-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Personal le atestado dos seus alunos" on storage.objects;
create policy "Personal le atestado dos seus alunos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-documents'
    and exists (
      select 1 from profiles c
      where c.id::text = (storage.foldername(name))[1]
        and c.personal_id = auth.uid()
    )
  );

-- ============================================================
-- FIM DO SCHEMA V15
-- ============================================================

