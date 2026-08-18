-- ============================================================
-- SCHEMA V25 - Suspensão de personals + auditoria de aprovações
--
--   Problemas que isso resolve:
--   1. O enum `approval_status` só tem pendente/aprovado/recusado.
--      Não existe como suspender um personal já ativo sem "recusá-lo",
--      o que mistura o fluxo de onboarding com o de moderação.
--   2. Nenhuma ação de aprovação/recusa/suspensão é auditada —
--      não se sabe quem fez o quê, quando, nem por qual motivo.
--
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- É seguro rodar em cima do banco atual (não apaga nada).
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOVO STATUS: 'suspenso'
--    Adiciona o valor ao enum existente.
-- ------------------------------------------------------------

do $$ begin
  alter type approval_status add value if not exists 'suspenso';
exception
  when others then null; -- já existe
end $$;

-- ------------------------------------------------------------
-- 2. TABELA DE AUDITORIA DE PERSONALS
--    Grava um registro a cada mudança de status de um personal
--    (pendente → aprovado, aprovado → suspenso, etc.).
--    O admin_id é quem agiu; reason é obrigatório só pra
--    recusa e suspensão (enforced no app, não no banco pra não
--    quebrar fluxos antigos).
-- ------------------------------------------------------------

create table if not exists personal_status_audit (
  id           uuid primary key default gen_random_uuid(),
  personal_id  uuid references profiles(id) on delete cascade not null,
  admin_id     uuid references profiles(id) on delete set null,
  old_status   text,                      -- status anterior (pode ser null no primeiro registro)
  new_status   text not null,             -- status novo
  reason       text,                      -- motivo (obrigatório no app pra recusa/suspensão)
  created_at   timestamp with time zone default now()
);

create index if not exists idx_personal_audit_personal on personal_status_audit (personal_id, created_at desc);
create index if not exists idx_personal_audit_admin    on personal_status_audit (admin_id, created_at desc);

alter table personal_status_audit enable row level security;

-- Só admin lê e insere nessa tabela
drop policy if exists "Admin le o historico de personals" on personal_status_audit;
create policy "Admin le o historico de personals" on personal_status_audit
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin registra mudancas de status" on personal_status_audit;
create policy "Admin registra mudancas de status" on personal_status_audit
  for insert with check (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- 3. RPC: admin_set_personal_status
--    Função que o app chama em vez de fazer UPDATE diretamente.
--    Garante que o registro de auditoria seja sempre criado
--    junto com a mudança de status, de forma atômica.
--    Qualquer erro em uma das duas operações reverte tudo.
-- ------------------------------------------------------------

create or replace function public.admin_set_personal_status(
  p_personal_id uuid,
  p_new_status  text,   -- 'aprovado' | 'recusado' | 'suspenso' | 'pendente'
  p_reason      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
begin
  -- Só admin pode chamar
  if public.current_user_role() <> 'admin' then
    raise exception 'Sem permissão';
  end if;

  -- Pega o status atual pra gravar no histórico
  select status::text into v_old_status from profiles where id = p_personal_id;

  if not found then
    raise exception 'Personal não encontrado';
  end if;

  -- Atualiza o status
  update profiles
  set status = p_new_status::approval_status
  where id = p_personal_id;

  -- Grava o registro de auditoria
  insert into personal_status_audit (personal_id, admin_id, old_status, new_status, reason)
  values (p_personal_id, auth.uid(), v_old_status, p_new_status, p_reason);
end;
$$;

-- ============================================================
-- FIM DO SCHEMA V25
-- ============================================================
