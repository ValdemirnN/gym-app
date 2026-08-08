-- Permite que o exercício substituto tenha suas próprias séries/repetições
-- (em vez de sempre herdar as mesmas do exercício principal).
-- Quando essas colunas ficam NULL, o app usa target_sets/target_reps do
-- exercício principal como valor padrão — comportamento antigo preservado.

alter table workout_exercise_substitutes
  add column if not exists target_sets int,
  add column if not exists target_reps int,
  add column if not exists target_reps_detail text;
