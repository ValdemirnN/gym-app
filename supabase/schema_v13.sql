-- ============================================================
-- SCHEMA V13 - Perfil completo do Personal Trainer
-- Rode este script no SQL Editor do Supabase.
-- ============================================================

alter table profiles
  -- Dados Pessoais Básico
  add column if not exists birth_date date,
  add column if not exists gender text,
  -- Contato
  add column if not exists instagram_url text,
  add column if not exists linkedin_url text,
  -- Credenciamento Obrigatório
  add column if not exists cref_number text,
  add column if not exists cref_state text,
  -- Atuação Profissional
  add column if not exists specialties text[],
  add column if not exists bio text,
  -- Comercial e Operacional
  add column if not exists consultation_price numeric,
  add column if not exists available_plans text,
  add column if not exists attends_online boolean not null default false,
  add column if not exists attends_in_person boolean not null default false,
  add column if not exists in_person_location text,
  add column if not exists availability_hours text;

-- ============================================================
-- FIM DO SCHEMA V13
-- ============================================================
