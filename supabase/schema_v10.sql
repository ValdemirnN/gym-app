-- ============================================================
-- SCHEMA V10 - Vídeos de demonstração guardados dentro do app
-- Rode este script no SQL Editor do Supabase.
-- ============================================================

-- Biblioteca de vídeos (nome pesquisável + arquivo no Storage)
create table if not exists exercise_videos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  owner_id uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_exercise_videos_name_lower on exercise_videos (lower(name));

alter table exercise_videos enable row level security;

drop policy if exists "Autenticados veem a biblioteca de videos" on exercise_videos;
create policy "Autenticados veem a biblioteca de videos" on exercise_videos
  for select using (auth.role() = 'authenticated');

drop policy if exists "Autenticados enviam videos" on exercise_videos;
create policy "Autenticados enviam videos" on exercise_videos
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Donos apagam seus proprios videos" on exercise_videos;
create policy "Donos apagam seus proprios videos" on exercise_videos
  for delete using (auth.uid() = owner_id);

-- Liga o exercício a um vídeo da biblioteca interna (substitui o link externo)
alter table exercises
  add column if not exists video_id uuid references exercise_videos(id) on delete set null;

-- Bucket de Storage para os arquivos de vídeo em si
insert into storage.buckets (id, name, public)
values ('exercise-videos', 'exercise-videos', true)
on conflict (id) do nothing;

drop policy if exists "Autenticados enviam arquivos de video" on storage.objects;
create policy "Autenticados enviam arquivos de video" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exercise-videos');

drop policy if exists "Qualquer um le arquivos de video" on storage.objects;
create policy "Qualquer um le arquivos de video" on storage.objects
  for select using (bucket_id = 'exercise-videos');

-- ============================================================
-- FIM DO SCHEMA V10
-- ============================================================
