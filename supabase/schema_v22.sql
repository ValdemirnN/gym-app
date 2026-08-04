-- ============================================================
-- SCHEMA V22
--   1. Instruções por exercício (texto explicando como executar)
--   2. Exercícios combinados / bi-set (agrupados por letra, o
--      aluno alterna entre eles)
--   3. Nível e objetivo do bloco de treino (ex: "Hipertrofia | Avançado")
--   4. Feedback do aluno ao finalizar o treino (humor + comentário)
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- ============================================================

alter table exercises add column if not exists instructions text;

alter table workout_exercises add column if not exists combo_group text; -- 'A', 'B', 'C'... null = exercício normal

alter table workouts add column if not exists level text;   -- 'iniciante' | 'intermediario' | 'avancado'
alter table workouts add column if not exists goal text;    -- texto livre, ex: 'Hipertrofia'
alter table workouts add column if not exists period_start date;
alter table workouts add column if not exists period_end date;

alter table workout_logs add column if not exists feedback_mood text;    -- ex: 'leve' | 'moderado' | 'dificil' | 'exaustao'
alter table workout_logs add column if not exists feedback_comment text;
alter table workout_logs add column if not exists duration_seconds int;

-- ============================================================
-- FIM DO SCHEMA V22
-- ============================================================
