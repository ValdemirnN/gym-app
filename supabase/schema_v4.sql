-- ============================================================
-- SCHEMA V4 - Acesso do Personal aos dados dos alunos
-- Rode este script no SQL Editor do Supabase.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Guardar o e-mail no profile (pra tela de "dados cadastrais")
-- ------------------------------------------------------------

alter table profiles add column if not exists email text;

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

-- preenche o e-mail de quem já se cadastrou antes desta migration
update profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ------------------------------------------------------------
-- 2. WORKOUTS - Personal enxerga/edita treinos dos seus alunos
-- ------------------------------------------------------------

drop policy if exists "Personal ve treinos dos seus clientes" on workouts;
create policy "Personal ve treinos dos seus clientes" on workouts
  for select using (
    exists (select 1 from profiles c where c.id = user_id and c.personal_id = auth.uid())
  );

drop policy if exists "Personal edita treinos que criou" on workouts;
create policy "Personal edita treinos que criou" on workouts
  for update using (created_by = auth.uid());

drop policy if exists "Personal apaga treinos que criou" on workouts;
create policy "Personal apaga treinos que criou" on workouts
  for delete using (created_by = auth.uid());

-- ------------------------------------------------------------
-- 3. WORKOUT_EXERCISES - idem, via o treino
-- ------------------------------------------------------------

drop policy if exists "Personal ve exercicios dos treinos dos clientes" on workout_exercises;
create policy "Personal ve exercicios dos treinos dos clientes" on workout_exercises
  for select using (
    exists (
      select 1 from workouts w
      join profiles c on c.id = w.user_id
      where w.id = workout_id and c.personal_id = auth.uid()
    )
  );

drop policy if exists "Personal adiciona exercicios ao treino que criou" on workout_exercises;
create policy "Personal adiciona exercicios ao treino que criou" on workout_exercises
  for insert with check (
    exists (select 1 from workouts w where w.id = workout_id and w.created_by = auth.uid())
  );

drop policy if exists "Personal apaga exercicios do treino que criou" on workout_exercises;
create policy "Personal apaga exercicios do treino que criou" on workout_exercises
  for delete using (
    exists (select 1 from workouts w where w.id = workout_id and w.created_by = auth.uid())
  );

-- ------------------------------------------------------------
-- 4. WORKOUT_LOGS - Personal ve historico de treino dos alunos
-- ------------------------------------------------------------

drop policy if exists "Personal ve logs dos seus clientes" on workout_logs;
create policy "Personal ve logs dos seus clientes" on workout_logs
  for select using (
    exists (select 1 from profiles c where c.id = user_id and c.personal_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 5. WORKOUT_LOG_SETS - idem, via o log
-- ------------------------------------------------------------

drop policy if exists "Personal ve sets dos logs dos seus clientes" on workout_log_sets;
create policy "Personal ve sets dos logs dos seus clientes" on workout_log_sets
  for select using (
    exists (
      select 1 from workout_logs l
      join profiles c on c.id = l.user_id
      where l.id = workout_log_id and c.personal_id = auth.uid()
    )
  );

-- ============================================================
-- FIM DO SCHEMA V4
-- ============================================================
