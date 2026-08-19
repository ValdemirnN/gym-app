-- ============================================================
-- MIGRAÇÃO: respostas de texto/número nas provas + limite de
-- 1 envio por dia para desafios de Foto e Vídeo.
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

-- Defensivo: garante que challenges tem type/config (caso o projeto
-- tenha essas colunas só no banco e não em migração versionada).
alter table challenges add column if not exists type text not null default 'FOTO';
alter table challenges add column if not exists config jsonb not null default '{}'::jsonb;

-- Guarda a resposta de desafios do tipo TEXTO e NUMERICO.
-- Sem isso, o envio de desafios de texto/número falha porque o app
-- tenta inserir em colunas que não existem.
alter table challenge_submissions add column if not exists text_response text;
alter table challenge_submissions add column if not exists numeric_response numeric;
alter table challenge_submissions add column if not exists numeric_unit text;

-- ------------------------------------------------------------
-- Limite de 1 envio por dia, só para desafios de FOTO e VIDEO.
-- Texto e Número podem ter mais de um envio por dia (o personal
-- decide o vencedor pela resposta/quantidade, não só pela contagem).
-- ------------------------------------------------------------
create or replace function public.check_challenge_daily_limit()
returns trigger as $$
declare
  challenge_type text;
begin
  select type into challenge_type from challenges where id = new.challenge_id;

  if challenge_type in ('FOTO', 'VIDEO') then
    if exists (
      select 1 from challenge_submissions
      where challenge_id = new.challenge_id
        and student_id = new.student_id
        and created_at::date = (now() at time zone 'utc')::date
    ) then
      raise exception 'Você já enviou a prova de hoje nesse desafio. Volte amanhã!';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_challenge_daily_limit on challenge_submissions;
create trigger trg_challenge_daily_limit
  before insert on challenge_submissions
  for each row execute function public.check_challenge_daily_limit();

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
