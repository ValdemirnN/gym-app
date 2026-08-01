-- ============================================================
-- SCHEMA V6 - Adiciona campo de idade ao profile
-- Rode este script no SQL Editor do Supabase.
-- ============================================================

alter table profiles add column if not exists age integer;

-- ============================================================
-- FIM DO SCHEMA V6
-- ============================================================
