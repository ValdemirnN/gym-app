-- ============================================================
--  MIGRAÇÃO: Adicionar suporte a Aquecimento no workout_exercises
--  Execute este script no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Adiciona a coluna is_warmup (default false, nunca nulo)
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN NOT NULL DEFAULT false;

-- 2. Índice para buscar rapidamente só os aquecimentos de um treino
CREATE INDEX IF NOT EXISTS idx_workout_exercises_warmup
  ON workout_exercises (workout_id, is_warmup)
  WHERE is_warmup = true;

-- ============================================================
--  PRONTO — nenhuma outra tabela precisa ser alterada.
--  O aquecimento usa a mesma tabela de exercises e herda:
--    • video_id  (vídeo de demonstração)
--    • name / instructions / tip (descrição)
--    • target_sets / target_reps / target_duration_minutes
--  A flag is_warmup = true separa o aquecimento dos exercícios.
-- ============================================================
