-- Adiciona suporte a repetições diferentes por série (ex: 12, 10, 8)
-- Guardado como texto separado por vírgula, ex: "12,10,8"
-- Quando NULL, o app usa target_reps (valor único) pra todas as séries — comportamento antigo preservado.

alter table workout_exercises
  add column if not exists target_reps_detail text;
