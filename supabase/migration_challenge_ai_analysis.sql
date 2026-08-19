-- ============================================================
-- MIGRAÇÃO: Desafios agora não guardam mais a foto no Storage.
-- A foto é analisada na hora pela IA e descartada; só o veredito
-- (aprovado/reprovado + motivo) fica salvo no banco.
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- storage_path deixa de ser obrigatório (não vamos mais fazer upload)
alter table challenge_submissions alter column storage_path drop not null;

-- guarda o resultado da análise da IA, pra você poder auditar depois se quiser
alter table challenge_submissions add column if not exists ai_approved boolean not null default true;
alter table challenge_submissions add column if not exists ai_reason text;

-- ============================================================
-- OPCIONAL: se você não for mais usar o bucket 'challenge-photos'
-- de jeito nenhum, pode apagá-lo em Storage > challenge-photos > ... > Delete bucket
-- direto no painel do Supabase (não precisa fazer isso por SQL).
-- ============================================================
