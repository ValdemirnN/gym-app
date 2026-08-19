-- ============================================================
-- MIGRAÇÃO: adiciona finished_at em challenges (para "Finalizar desafio").
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

alter table challenges add column if not exists finished_at timestamp with time zone;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
