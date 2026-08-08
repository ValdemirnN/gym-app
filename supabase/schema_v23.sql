-- v23: campo de progressão manual por exercício (ex: "12,10,8 reps / 20,25,30kg")
-- O personal escreve livremente como quer que as séries evoluam (reps decrescentes,
-- carga crescente, etc). Fica visível pro aluno na tela do treino e durante a execução.

alter table workout_exercises add column if not exists progression_note text;
