-- ============================================================
-- SCHEMA V2 - MULTI-TENANT (Admin / Personal / Cliente)
-- Rode este script INTEIRO em: Supabase -> SQL Editor -> New query
-- Ele estende o schema.sql original, não apaga nada que já existe.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PAPÉIS E STATUS NO PERFIL
-- ------------------------------------------------------------

do $$ begin
  create type user_role as enum ('admin', 'personal', 'cliente');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type approval_status as enum ('pendente', 'aprovado', 'recusado');
exception
  when duplicate_object then null;
end $$;

alter table profiles
  add column if not exists role user_role not null default 'cliente',
  add column if not exists status approval_status not null default 'aprovado',
  -- só preenchido quando role = 'personal'
  add column if not exists pix_key text,
  add column if not exists whatsapp text,
  -- só preenchido quando role = 'cliente': qual personal escolheu
  add column if not exists personal_id uuid references profiles(id) on delete set null,
  -- dados de saúde do cliente
  add column if not exists health_conditions text,
  add column if not exists health_restrictions text;

-- clientes (role='cliente') entram como 'pendente' até o personal confirmar pagamento
-- personals (role='personal') entram como 'pendente' até o admin aprovar
-- admins são sempre 'aprovado'
-- (o default do trigger abaixo cuida disso automaticamente no cadastro)

-- ------------------------------------------------------------
-- 2. PAGAMENTOS
-- ------------------------------------------------------------

do $$ begin
  create type payment_status as enum ('pendente', 'confirmado', 'recusado');
exception
  when duplicate_object then null;
end $$;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references profiles(id) on delete cascade not null,
  personal_id uuid references profiles(id) on delete cascade not null,
  reference_month date not null, -- ex: 2026-07-01 (mês de referência do pagamento)
  amount numeric,
  status payment_status not null default 'pendente',
  reported_at timestamp with time zone default now(), -- quando o cliente tocou em "já paguei"
  confirmed_at timestamp with time zone,
  confirmed_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- ------------------------------------------------------------
-- 3. CHAT INTERNO CLIENTE <-> PERSONAL
-- ------------------------------------------------------------

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  read boolean not null default false,
  created_at timestamp with time zone default now()
);

-- ------------------------------------------------------------
-- 4. VINCULAR TREINOS AO PERSONAL QUE MONTOU
-- ------------------------------------------------------------

alter table workouts
  add column if not exists created_by uuid references profiles(id);
-- created_by = personal que montou o treino (null = o próprio usuário montou, modo antigo)

-- ------------------------------------------------------------
-- 5. FUNÇÃO/TRIGGER: criar profile automaticamente no signup
-- com o status correto conforme o papel escolhido
-- ------------------------------------------------------------

create or replace function public.handle_new_user_role_status()
returns trigger as $$
begin
  -- status inicial conforme o papel:
  -- cliente -> pendente (até pagar/personal confirmar)
  -- personal -> pendente (até admin aprovar)
  -- admin -> aprovado (não se cadastra admin pelo app; só promovido manualmente)
  if new.role = 'cliente' then
    new.status := 'pendente';
  elsif new.role = 'personal' then
    new.status := 'pendente';
  else
    new.status := 'aprovado';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_status_on_insert on profiles;
create trigger set_status_on_insert
  before insert on profiles
  for each row execute function public.handle_new_user_role_status();

-- ------------------------------------------------------------
-- 6. RLS - PROFILES (substitui as policies antigas, mais permissivas
--    para o fluxo de personal/admin enxergarem clientes)
-- ------------------------------------------------------------

drop policy if exists "Usuários veem o próprio perfil" on profiles;
drop policy if exists "Usuários editam o próprio perfil" on profiles;
drop policy if exists "Usuários criam o próprio perfil" on profiles;

-- todo mundo autenticado pode ver o próprio perfil
create policy "Ver o próprio perfil" on profiles
  for select using (auth.uid() = id);

-- cliente também pode ver o perfil do seu personal (pra tela de chat/pix)
create policy "Cliente ve o proprio personal" on profiles
  for select using (
    id = (select personal_id from profiles where profiles.id = auth.uid())
  );

-- personal ve os perfis dos clientes vinculados a ele
create policy "Personal ve seus clientes" on profiles
  for select using (
    personal_id = auth.uid()
  );

-- admin ve todo mundo
create policy "Admin ve todos os perfis" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Usuários criam o próprio perfil" on profiles
  for insert with check (auth.uid() = id);

create policy "Usuários editam o próprio perfil" on profiles
  for update using (auth.uid() = id);

-- admin pode editar qualquer perfil (aprovar personal, etc)
create policy "Admin edita qualquer perfil" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- personal pode editar o status/perfil dos seus clientes (ex: aprovar pagamento)
create policy "Personal edita seus clientes" on profiles
  for update using (
    personal_id = auth.uid()
  );

-- ------------------------------------------------------------
-- 7. RLS - PAYMENTS
-- ------------------------------------------------------------

alter table payments enable row level security;

create policy "Cliente ve seus pagamentos" on payments
  for select using (cliente_id = auth.uid());

create policy "Personal ve pagamentos dos seus clientes" on payments
  for select using (personal_id = auth.uid());

create policy "Admin ve todos pagamentos" on payments
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Cliente reporta pagamento" on payments
  for insert with check (cliente_id = auth.uid());

create policy "Personal confirma pagamento" on payments
  for update using (personal_id = auth.uid());

-- ------------------------------------------------------------
-- 8. RLS - MESSAGES
-- ------------------------------------------------------------

alter table messages enable row level security;

create policy "Ve mensagens que enviou ou recebeu" on messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Envia mensagem" on messages
  for insert with check (sender_id = auth.uid());

create policy "Marca mensagem como lida" on messages
  for update using (receiver_id = auth.uid());

-- ------------------------------------------------------------
-- 9. RLS - WORKOUTS (atualizada: personal pode montar treino pro cliente)
-- ------------------------------------------------------------

drop policy if exists "Usuários criam seus treinos" on workouts;
drop policy if exists "Usuários editam seus treinos" on workouts;

create policy "Usuários criam seus treinos" on workouts
  for insert with check (auth.uid() = user_id or auth.uid() = created_by);

create policy "Personal cria treino pro cliente" on workouts
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from profiles c where c.id = user_id and c.personal_id = auth.uid())
  );

create policy "Usuários editam seus treinos" on workouts
  for update using (auth.uid() = user_id or auth.uid() = created_by);

-- ============================================================
-- FIM DO SCHEMA V2
-- ============================================================
