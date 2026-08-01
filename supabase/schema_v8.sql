-- ============================================================
-- SCHEMA V8 - Exercícios customizados + Acesso mensal automático
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- É seguro rodar em cima do banco atual (não apaga nada, só adiciona).
-- ============================================================

-- ------------------------------------------------------------
-- 1. EXERCÍCIOS CUSTOMIZADOS
-- ------------------------------------------------------------

-- Dono do exercício (null = catálogo padrão, visível pra todo mundo)
alter table exercises
  add column if not exists owner_id uuid references profiles(id) on delete cascade;

-- Índice para busca rápida ignorando maiúscula/minúscula por nome e grupo
create index if not exists idx_exercises_name_lower on exercises (lower(name));
create index if not exists idx_exercises_muscle_lower on exercises (lower(muscle_group));

-- Ajusta o SELECT: catálogo padrão (owner_id null) + os próprios do usuário
-- + (se for personal) os exercícios que os clientes dele cadastraram
drop policy if exists "Todos podem ver exercícios" on exercises;

create policy "Ve catalogo e proprios exercicios" on exercises
  for select using (
    owner_id is null
    or owner_id = auth.uid()
    or owner_id in (select id from profiles where personal_id = auth.uid())
    or owner_id in (select personal_id from profiles where id = auth.uid())
  );

create policy "Usuario cria exercicio proprio" on exercises
  for insert with check (owner_id = auth.uid() or owner_id is null);

-- ------------------------------------------------------------
-- 2. ACESSO MENSAL AUTOMÁTICO
-- ------------------------------------------------------------

alter table profiles
  add column if not exists approved_at timestamp with time zone,
  add column if not exists access_expires_at timestamp with time zone,
  add column if not exists access_blocked boolean not null default false;

-- Quando o status vira 'aprovado', grava a data e calcula +1 mês de acesso
create or replace function public.handle_profile_approval()
returns trigger as $$
begin
  if new.status = 'aprovado' and (old.status is distinct from new.status) then
    new.approved_at := now();
    new.access_expires_at := now() + interval '1 month';
    new.access_blocked := false;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_approval_dates on profiles;
create trigger set_approval_dates
  before update on profiles
  for each row execute function public.handle_profile_approval();

-- Função que calcula o status atual de acesso do aluno (chame do app via RPC
-- ou selecione direto o resultado numa query)
create or replace function public.client_access_status(p_id uuid)
returns text
language sql
stable
as $$
  select case
    when access_blocked then 'bloqueado'
    when access_expires_at is null then 'sem_acesso'
    when access_expires_at < now() then 'expirado'
    else 'ativo'
  end
  from profiles where id = p_id;
$$;

-- RPC pra liberar (bloqueado -> ativo, renova por +1 mês a partir de hoje)
create or replace function public.liberar_acesso_cliente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where id = p_cliente_id and personal_id = auth.uid()
  ) then
    raise exception 'Sem permissão para liberar este cliente';
  end if;

  update profiles
  set access_blocked = false,
      access_expires_at = now() + interval '1 month'
  where id = p_cliente_id;
end;
$$;

-- RPC pra bloquear manualmente
create or replace function public.bloquear_acesso_cliente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where id = p_cliente_id and personal_id = auth.uid()
  ) then
    raise exception 'Sem permissão para bloquear este cliente';
  end if;

  update profiles
  set access_blocked = true
  where id = p_cliente_id;
end;
$$;

-- ============================================================
-- FIM DO SCHEMA V8
-- ============================================================
