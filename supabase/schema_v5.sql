-- ============================================================
-- SCHEMA V5 - Corrige recursão infinita nas políticas de profiles
-- Rode este script no SQL Editor do Supabase.
-- Erro que isso resolve: "infinite recursion detected in policy for relation profiles"
-- ============================================================

-- Funções auxiliares que rodam com privilégio elevado (ignoram RLS),
-- evitando que a política de profiles precise consultar profiles de novo.

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

-- Recria as políticas problemáticas usando as funções acima em vez de subquery direta

drop policy if exists "Cliente ve o proprio personal" on profiles;
create policy "Cliente ve o proprio personal" on profiles
  for select using (id = public.current_user_personal_id());

drop policy if exists "Admin ve todos os perfis" on profiles;
create policy "Admin ve todos os perfis" on profiles
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin edita qualquer perfil" on profiles;
create policy "Admin edita qualquer perfil" on profiles
  for update using (public.current_user_role() = 'admin');

-- ============================================================
-- FIM DO SCHEMA V5
-- ============================================================
