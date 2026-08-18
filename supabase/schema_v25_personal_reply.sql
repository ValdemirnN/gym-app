-- ============================================================
-- SCHEMA V25 — Resposta do Personal aos Feedbacks de Treino
-- Adiciona a coluna `personal_reply` na tabela workout_logs,
-- que permite ao personal responder o comentário do aluno
-- após cada treino concluído.
-- ============================================================

-- 1. Coluna de resposta do personal
alter table workout_logs
  add column if not exists personal_reply text;

-- 2. Índice para buscar treinos sem resposta pendente (painel do personal)
create index if not exists idx_workout_logs_no_reply
  on workout_logs (user_id)
  where personal_reply is null
    and finished_at is not null
    and feedback_comment is not null;

-- 3. RLS: o personal do aluno pode escrever a resposta
-- Certifica que o update só vale para personal_id correto

-- Política de UPDATE para personal responder (adicionar se não existir)
drop policy if exists "Personal pode responder feedback" on workout_logs;

create policy "Personal pode responder feedback" on workout_logs
  for update
  using (
    -- O user_id do log pertence a um aluno cujo personal é quem está editando
    user_id in (
      select id from profiles
      where personal_id = auth.uid()
    )
  )
  with check (
    user_id in (
      select id from profiles
      where personal_id = auth.uid()
    )
  );

-- 4. Aluno vê somente os próprios logs (política já existente, garantindo)
-- (só adiciona se não existir uma similar)
drop policy if exists "Aluno ve proprios logs" on workout_logs;

create policy "Aluno ve proprios logs" on workout_logs
  for select
  using (user_id = auth.uid());

-- ============================================================
-- COMO USAR NO APP (personal responde via supabase):
--
--   await supabase
--     .from('workout_logs')
--     .update({ personal_reply: 'Ótimo treino! Continue assim 💪' })
--     .eq('id', logId);
--
-- O aluno lê personal_reply na WorkoutFeedbackHistoryScreen.
-- ============================================================
