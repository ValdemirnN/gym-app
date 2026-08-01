-- ============================================================
-- SCHEMA V12 - Foto de perfil (avatar) do usuário
-- Rode este script no SQL Editor do Supabase.
-- ============================================================

-- Coluna com a URL pública da foto de perfil
alter table profiles
  add column if not exists avatar_url text;

-- Bucket de Storage para as fotos de perfil
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Autenticados enviam a propria foto" on storage.objects;
create policy "Autenticados enviam a propria foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Autenticados atualizam a propria foto" on storage.objects;
create policy "Autenticados atualizam a propria foto" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Qualquer um le as fotos de perfil" on storage.objects;
create policy "Qualquer um le as fotos de perfil" on storage.objects
  for select using (bucket_id = 'avatars');

-- ============================================================
-- FIM DO SCHEMA V12
-- ============================================================
