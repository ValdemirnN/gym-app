-- ============================================================
-- SCHEMA COMPLETO (RESET) - "Meu Treino" multi-tenant
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- Ele apaga as tabelas que existirem hoje e recria tudo do zero,
-- já 100% compatível com o app (telas de Aluno, Personal e Admin).
-- Só rode isso se você não tem dados de verdade no banco ainda
-- (apenas os cadastros de teste) — este script APAGA tudo.
-- ============================================================

-- ------------------------------------------------------------
-- 0. LIMPEZA: remove qualquer versão anterior/divergente
-- ------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists set_status_on_insert on profiles;

drop table if exists workout_log_sets cascade;
drop table if exists workout_logs cascade;
drop table if exists workout_exercises cascade;
drop table if exists workouts cascade;
drop table if exists messages cascade;
drop table if exists payments cascade;
drop table if exists exercises cascade;
drop table if exists profiles cascade;

drop function if exists public.handle_new_auth_user() cascade;
drop function if exists public.handle_new_user_role_status() cascade;
drop function if exists public.current_user_role() cascade;
drop function if exists public.current_user_personal_id() cascade;

drop type if exists user_role cascade;
drop type if exists approval_status cascade;
drop type if exists payment_status cascade;

-- ------------------------------------------------------------
-- 1. TIPOS
-- ------------------------------------------------------------

create type user_role as enum ('admin', 'personal', 'cliente');
create type approval_status as enum ('pendente', 'aprovado', 'recusado');
create type payment_status as enum ('pendente', 'confirmado', 'recusado');

-- ------------------------------------------------------------
-- 2. TABELAS
-- ------------------------------------------------------------

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  role user_role not null default 'cliente',
  status approval_status not null default 'aprovado',
  -- só para role = 'personal'
  pix_key text,
  whatsapp text,
  -- só para role = 'cliente'
  personal_id uuid references profiles(id) on delete set null,
  health_conditions text,
  health_restrictions text,
  height_cm numeric,
  weight_kg numeric,
  created_at timestamp with time zone default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text,
  created_at timestamp with time zone default now()
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  created_by uuid references profiles(id),
  name text not null,
  created_at timestamp with time zone default now()
);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts on delete cascade not null,
  exercise_id uuid references exercises on delete cascade not null,
  target_sets int not null default 3,
  target_reps int not null default 12,
  order_index int not null default 0
);

create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  workout_id uuid references workouts on delete set null,
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone
);

create table workout_log_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid references workout_logs on delete cascade not null,
  exercise_id uuid references exercises on delete cascade not null,
  set_number int not null,
  reps_done int,
  weight_kg numeric,
  created_at timestamp with time zone default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references profiles(id) on delete cascade not null,
  personal_id uuid references profiles(id) on delete cascade not null,
  reference_month date not null,
  amount numeric,
  status payment_status not null default 'pendente',
  reported_at timestamp with time zone default now(),
  confirmed_at timestamp with time zone,
  confirmed_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) on delete cascade not null,
  receiver_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  read boolean not null default false,
  created_at timestamp with time zone default now()
);

-- ------------------------------------------------------------
-- 3. FUNÇÕES E TRIGGERS
-- ------------------------------------------------------------

-- status inicial conforme o papel (roda ao inserir em profiles)
create or replace function public.handle_new_user_role_status()
returns trigger as $$
begin
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

create trigger set_status_on_insert
  before insert on profiles
  for each row execute function public.handle_new_user_role_status();

-- cria o profile automaticamente quando um usuário se cadastra (auth.users)
create or replace function public.handle_new_auth_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, email, role, personal_id, health_conditions, health_restrictions, pix_key, whatsapp
  )
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'cliente'),
    nullif(new.raw_user_meta_data->>'personal_id', '')::uuid,
    new.raw_user_meta_data->>'health_conditions',
    new.raw_user_meta_data->>'health_restrictions',
    new.raw_user_meta_data->>'pix_key',
    new.raw_user_meta_data->>'whatsapp'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- funções auxiliares (evitam recursão de RLS em profiles)
create or replace function public.current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.current_user_personal_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select personal_id from profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 4. RLS - PROFILES
-- ------------------------------------------------------------

alter table profiles enable row level security;

create policy "Ver o próprio perfil" on profiles
  for select using (auth.uid() = id);

create policy "Cliente ve o proprio personal" on profiles
  for select using (id = public.current_user_personal_id());

create policy "Personal ve seus clientes" on profiles
  for select using (personal_id = auth.uid());

create policy "Admin ve todos os perfis" on profiles
  for select using (public.current_user_role() = 'admin');

create policy "Usuários criam o próprio perfil" on profiles
  for insert with check (auth.uid() = id);

create policy "Usuários editam o próprio perfil" on profiles
  for update using (auth.uid() = id);

create policy "Admin edita qualquer perfil" on profiles
  for update using (public.current_user_role() = 'admin');

create policy "Personal edita seus clientes" on profiles
  for update using (personal_id = auth.uid());

-- ------------------------------------------------------------
-- 5. RLS - EXERCISES
-- ------------------------------------------------------------

alter table exercises enable row level security;

create policy "Todos podem ver exercícios" on exercises
  for select using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 6. RLS - WORKOUTS
-- ------------------------------------------------------------

alter table workouts enable row level security;

create policy "Usuários veem seus treinos" on workouts
  for select using (auth.uid() = user_id);

create policy "Personal ve treinos dos seus clientes" on workouts
  for select using (
    exists (select 1 from profiles c where c.id = user_id and c.personal_id = auth.uid())
  );

create policy "Usuários criam seus treinos" on workouts
  for insert with check (auth.uid() = user_id or auth.uid() = created_by);

create policy "Personal cria treino pro cliente" on workouts
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from profiles c where c.id = user_id and c.personal_id = auth.uid())
  );

create policy "Usuários editam seus treinos" on workouts
  for update using (auth.uid() = user_id or auth.uid() = created_by);

create policy "Usuários apagam seus treinos" on workouts
  for delete using (auth.uid() = user_id or auth.uid() = created_by);

-- ------------------------------------------------------------
-- 7. RLS - WORKOUT_EXERCISES
-- ------------------------------------------------------------

alter table workout_exercises enable row level security;

create policy "Usuários veem exercícios do seu treino" on workout_exercises
  for select using (
    exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create policy "Personal ve exercicios dos treinos dos clientes" on workout_exercises
  for select using (
    exists (
      select 1 from workouts w
      join profiles c on c.id = w.user_id
      where w.id = workout_id and c.personal_id = auth.uid()
    )
  );

create policy "Usuários adicionam exercícios ao seu treino" on workout_exercises
  for insert with check (
    exists (select 1 from workouts w where w.id = workout_id and (w.user_id = auth.uid() or w.created_by = auth.uid()))
  );

create policy "Usuários apagam exercícios do seu treino" on workout_exercises
  for delete using (
    exists (select 1 from workouts w where w.id = workout_id and (w.user_id = auth.uid() or w.created_by = auth.uid()))
  );

-- ------------------------------------------------------------
-- 8. RLS - WORKOUT_LOGS
-- ------------------------------------------------------------

alter table workout_logs enable row level security;

create policy "Usuários veem seus registros" on workout_logs
  for select using (auth.uid() = user_id);

create policy "Personal ve logs dos seus clientes" on workout_logs
  for select using (
    exists (select 1 from profiles c where c.id = user_id and c.personal_id = auth.uid())
  );

create policy "Usuários criam seus registros" on workout_logs
  for insert with check (auth.uid() = user_id);

create policy "Usuários atualizam seus registros" on workout_logs
  for update using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9. RLS - WORKOUT_LOG_SETS
-- ------------------------------------------------------------

alter table workout_log_sets enable row level security;

create policy "Usuários veem suas séries" on workout_log_sets
  for select using (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );

create policy "Personal ve sets dos logs dos seus clientes" on workout_log_sets
  for select using (
    exists (
      select 1 from workout_logs l
      join profiles c on c.id = l.user_id
      where l.id = workout_log_id and c.personal_id = auth.uid()
    )
  );

create policy "Usuários criam suas séries" on workout_log_sets
  for insert with check (
    exists (select 1 from workout_logs l where l.id = workout_log_id and l.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 10. RLS - PAYMENTS
-- ------------------------------------------------------------

alter table payments enable row level security;

create policy "Cliente ve seus pagamentos" on payments
  for select using (cliente_id = auth.uid());

create policy "Personal ve pagamentos dos seus clientes" on payments
  for select using (personal_id = auth.uid());

create policy "Admin ve todos pagamentos" on payments
  for select using (public.current_user_role() = 'admin');

create policy "Cliente reporta pagamento" on payments
  for insert with check (cliente_id = auth.uid());

create policy "Personal confirma pagamento" on payments
  for insert with check (personal_id = auth.uid());

create policy "Personal atualiza pagamento" on payments
  for update using (personal_id = auth.uid());

-- ------------------------------------------------------------
-- 11. RLS - MESSAGES
-- ------------------------------------------------------------

alter table messages enable row level security;

create policy "Ve mensagens que enviou ou recebeu" on messages
  for select using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "Envia mensagem" on messages
  for insert with check (sender_id = auth.uid());

create policy "Marca mensagem como lida" on messages
  for update using (receiver_id = auth.uid());

-- ------------------------------------------------------------
-- 12. CATÁLOGO INICIAL DE EXERCÍCIOS
-- ------------------------------------------------------------

insert into exercises (name, muscle_group) values
  ('Supino reto', 'Peito'),
  ('Supino inclinado', 'Peito'),
  ('Crucifixo', 'Peito'),
  ('Puxada frente', 'Costas'),
  ('Remada curvada', 'Costas'),
  ('Levantamento terra', 'Costas'),
  ('Agachamento livre', 'Pernas'),
  ('Leg press', 'Pernas'),
  ('Cadeira extensora', 'Pernas'),
  ('Cadeira flexora', 'Pernas'),
  ('Rosca direta', 'Bíceps'),
  ('Rosca alternada', 'Bíceps'),
  ('Tríceps corda', 'Tríceps'),
  ('Tríceps testa', 'Tríceps'),
  ('Desenvolvimento ombro', 'Ombros'),
  ('Elevação lateral', 'Ombros'),
  ('Abdominal supra', 'Abdômen'),
  ('Prancha', 'Abdômen');

-- ============================================================
-- FIM - banco pronto e 100% alinhado com o app
-- ============================================================
