-- Adiciona 2º e 3º lugar aos desafios (antes só existia winner_id = 1º lugar).
-- Rode esse arquivo no SQL editor do Supabase.

alter table challenges
  add column if not exists winner_2nd_id uuid references profiles(id),
  add column if not exists winner_3rd_id uuid references profiles(id);
