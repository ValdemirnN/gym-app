-- ============================================================
-- SCHEMA V19 - Valor mensal combinado com o aluno
--   Só um campo novo, pra tela de Assinatura mostrar informação
--   de verdade (quanto o aluno paga por mês, total recebido, etc.)
-- Rode este script no SQL Editor do Supabase.
-- ============================================================

alter table profiles add column if not exists monthly_fee numeric(8,2);

-- ============================================================
-- FIM DO SCHEMA V19
-- ============================================================
