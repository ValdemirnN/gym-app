-- ============================================================
-- SCHEMA V11 - Corrige permissão pra anexar vídeo num exercício
-- Rode este script no SQL Editor do Supabase.
--
-- Sem isso, o update de video_id na tabela exercises era bloqueado
-- silenciosamente pelo RLS (não dava erro, mas também não salvava).
-- ============================================================

drop policy if exists "Autenticados atualizam video do exercicio" on exercises;

create policy "Autenticados atualizam video do exercicio" on exercises
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- FIM DO SCHEMA V11
-- ============================================================
