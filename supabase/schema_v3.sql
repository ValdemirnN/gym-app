-- ============================================================
-- SCHEMA V3 - Criação automática de profile via trigger
-- Rode este script no SQL Editor do Supabase.
-- Resolve o erro "new row violates row-level security policy for table profiles"
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, role, personal_id, health_conditions, health_restrictions, pix_key, whatsapp
  )
  values (
    new.id,
    new.raw_user_meta_data->>'name',
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================
-- FIM DO SCHEMA V3
-- ============================================================
