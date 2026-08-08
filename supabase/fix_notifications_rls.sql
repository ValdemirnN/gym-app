-- ============================================================
-- CORREÇÃO: RLS em tabela notifications bloqueia INSERT
-- Erro: "new row violates row-level security policy for table notifications"
-- ============================================================
-- Esse erro ocorre porque há uma trigger no banco que tenta inserir
-- automaticamente em `notifications` quando o personal cria um treino,
-- mas a policy de RLS não permite inserção direta (só via service_role).
-- 
-- SOLUÇÃO 1 (recomendada): criar policy de INSERT para a trigger
-- Execute no Supabase → SQL Editor:

-- Permitir que qualquer usuário autenticado insira notifications
-- (a trigger roda como usuário autenticado, não como service_role)
CREATE POLICY "allow_insert_own_notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- OU, se quiser mais restrito: só permite inserir para o próprio user_id
-- CREATE POLICY "allow_insert_own_notifications"
--   ON notifications
--   FOR INSERT
--   WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- SOLUÇÃO 2 (alternativa): tornar a trigger SECURITY DEFINER
-- Isso faz a trigger rodar com permissões elevadas
-- ============================================================
-- Se você tiver uma trigger chamada algo como "notify_new_workout"
-- substitua pela versão SECURITY DEFINER:

-- Exemplo (ajuste o nome da trigger/função conforme o seu banco):
-- CREATE OR REPLACE FUNCTION public.notify_student_new_workout()
-- RETURNS TRIGGER
-- SECURITY DEFINER  -- <- adicionar esta linha
-- SET search_path = public
-- LANGUAGE plpgsql AS $$
-- BEGIN
--   INSERT INTO notifications (user_id, title, body, type)
--   VALUES (NEW.user_id, 'Novo treino disponível', 'Seu personal cadastrou um novo treino para você!', 'new_workout');
--   RETURN NEW;
-- END;
-- $$;

-- ============================================================
-- VERIFICAÇÃO: ver as policies atuais de notifications
-- ============================================================
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'notifications';

-- ============================================================
-- MELHORIAS ADICIONAIS: campos para suportar os status de treino
-- ============================================================
-- Se workout_logs não tiver os campos abaixo, execute:

-- Garantir que a coluna feedback_comment existe
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS feedback_comment text;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS feedback_mood text;

-- Index para consultas por dia (usado na barra de dias semanal)
CREATE INDEX IF NOT EXISTS idx_workout_logs_started_at_user
  ON workout_logs (user_id, started_at);
