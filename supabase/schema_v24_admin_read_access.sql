-- ============================================================
-- SCHEMA V24 - Acesso de leitura do Admin aos dados operacionais
--   Hoje o admin só tem policy em `profiles` (select/update) e
--   `payments` (select). Todo o resto (treinos, logs, avaliações,
--   metas, desafios, fotos, PAR-Q, notificações) não tem NENHUMA
--   policy de admin — mesmo com tela pronta, a query volta vazia.
--
--   Este script dá ao admin SOMENTE LEITURA nessas tabelas.
--   De propósito, admin não recebe UPDATE/DELETE aqui: ele pode
--   supervisionar, mas não deve editar/apagar conteúdo que é de
--   um personal ou aluno específico (isso evita um bug de UI virar
--   um "admin apagou o treino de alguém sem querer").
--
--   `messages` fica de fora por padrão — é uma decisão de
--   privacidade, não técnica (ver seção 4 comentada no fim).
--
-- Rode este script INTEIRO no SQL Editor do Supabase.
-- É seguro rodar em cima do banco atual (não apaga nada).
-- ============================================================

-- ------------------------------------------------------------
-- 1. TREINOS E EXECUÇÃO (workouts, workout_exercises, logs, sets,
--    status por exercício, cardio, substitutos)
-- ------------------------------------------------------------

drop policy if exists "Admin ve todos os treinos" on workouts;
create policy "Admin ve todos os treinos" on workouts
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve todos os exercicios de treino" on workout_exercises;
create policy "Admin ve todos os exercicios de treino" on workout_exercises
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve todos os logs de treino" on workout_logs;
create policy "Admin ve todos os logs de treino" on workout_logs
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve todos os sets registrados" on workout_log_sets;
create policy "Admin ve todos os sets registrados" on workout_log_sets
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve status de exercicios pulados/substituidos" on workout_log_exercise_status;
create policy "Admin ve status de exercicios pulados/substituidos" on workout_log_exercise_status
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve registros de cardio" on workout_log_cardio;
create policy "Admin ve registros de cardio" on workout_log_cardio
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve substitutos configurados" on workout_exercise_substitutes;
create policy "Admin ve substitutos configurados" on workout_exercise_substitutes
  for select using (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- 2. ACOMPANHAMENTO (avaliações, metas, desafios, fotos, PAR-Q)
-- ------------------------------------------------------------

drop policy if exists "Admin ve todas as avaliacoes fisicas" on evaluations;
create policy "Admin ve todas as avaliacoes fisicas" on evaluations
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve todas as metas" on goals;
create policy "Admin ve todas as metas" on goals
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve todos os desafios" on challenges;
create policy "Admin ve todos os desafios" on challenges
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve todas as fotos de progresso" on progress_photos;
create policy "Admin ve todas as fotos de progresso" on progress_photos
  for select using (public.current_user_role() = 'admin');

drop policy if exists "Admin ve todas as respostas de PARQ" on parq_responses;
create policy "Admin ve todas as respostas de PARQ" on parq_responses
  for select using (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- 3. NOTIFICAÇÕES (útil pra debugar "o aluno diz que não recebeu
--    aviso" sem precisar abrir o Supabase direto)
-- ------------------------------------------------------------

drop policy if exists "Admin ve todas as notificacoes" on notifications;
create policy "Admin ve todas as notificacoes" on notifications
  for select using (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- 4. MENSAGENS (chat aluno <-> personal) - DESATIVADO DE PROPÓSITO
--    Descomente só se o time decidir que o admin precisa disso
--    pra investigar uma denúncia. Se ativar, considere logar quem
--    acessou (auditoria), já que é conteúdo privado de terceiros.
-- ------------------------------------------------------------

-- drop policy if exists "Admin ve todas as mensagens" on messages;
-- create policy "Admin ve todas as mensagens" on messages
--   for select using (public.current_user_role() = 'admin');

-- ------------------------------------------------------------
-- 5. VIEW DE APOIO PRO DASHBOARD DO ADMIN
--    Pré-agrega os números que a próxima etapa (Dashboard
--    analítico) vai consumir, num único select. `security_invoker`
--    faz a view respeitar o RLS de quem chama — então só o admin
--    (que agora tem select nas tabelas acima) consegue ler.
-- ------------------------------------------------------------

drop view if exists admin_platform_overview;
create view admin_platform_overview
with (security_invoker = true) as
select
  -- pessoas
  (select count(*) from profiles where role = 'personal' and status = 'aprovado') as personals_ativos,
  (select count(*) from profiles where role = 'personal' and status = 'pendente') as personals_pendentes,
  (select count(*) from profiles where role = 'cliente' and coalesce(is_excluded, false) = false) as alunos_ativos,
  (select count(*) from profiles where role = 'cliente' and status = 'pendente') as alunos_pendentes,

  -- financeiro (mês corrente, referência = primeiro dia do mês)
  (select coalesce(sum(amount), 0) from payments
     where status = 'confirmado' and date_trunc('month', reference_month) = date_trunc('month', current_date)
  ) as receita_confirmada_mes,
  (select coalesce(sum(amount), 0) from payments
     where status = 'pendente' and date_trunc('month', reference_month) = date_trunc('month', current_date)
  ) as receita_pendente_mes,
  (select count(*) from payments
     where status = 'pendente' and date_trunc('month', reference_month) = date_trunc('month', current_date)
  ) as pagamentos_pendentes_mes,

  -- atividade (últimos 7 dias)
  (select count(*) from workout_logs
     where finished_at is not null and finished_at >= now() - interval '7 days'
  ) as treinos_concluidos_semana,
  (select count(*) from workout_logs
     where skipped = true and started_at >= now() - interval '7 days'
  ) as treinos_pulados_semana;

-- ============================================================
-- FIM DO SCHEMA V24
-- ============================================================
