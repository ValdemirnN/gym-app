-- ============================================================
-- MIGRAÇÃO: suporte a múltiplos tipos de desafio.
-- Tipos: FOTO (o que já existia), TEXTO, VIDEO, NUMERICO.
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- 1. Tipo do desafio + config específica de cada tipo, guardada em JSON
--    pra não precisar de uma coluna nova a cada tipo novo no futuro.
alter table challenges add column if not exists type text not null default 'FOTO';
alter table challenges add constraint challenges_type_check
  check (type in ('FOTO', 'TEXTO', 'VIDEO', 'NUMERICO'));

-- config: guarda os detalhes que só fazem sentido pra um tipo específico.
--   TEXTO     -> { "question": "Quantas refeições você fez hoje?" }
--   NUMERICO  -> { "label": "Carga no supino (kg)", "unit": "kg" }
--   VIDEO     -> { "max_duration_seconds": 30 }
--   FOTO      -> {} (não precisa de nada extra)
alter table challenges add column if not exists config jsonb not null default '{}'::jsonb;

-- 2. A submission agora carrega a resposta do aluno de acordo com o tipo.
--    storage_path continua existindo (FOTO e VIDEO usam), e ganha as colunas
--    novas pra TEXTO e NUMERICO.
alter table challenge_submissions add column if not exists text_response text;
alter table challenge_submissions add column if not exists numeric_response numeric;
alter table challenge_submissions add column if not exists numeric_unit text;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
