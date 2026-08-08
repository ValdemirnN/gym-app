import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

// Precisa bater com o "scheme" configurado no app.json e com a URL de
// redirecionamento cadastrada em Supabase -> Authentication -> URL Configuration -> Redirect URLs.
export const PASSWORD_RESET_REDIRECT_URL = 'meutreino://reset-password';

const ERROR_MESSAGES = {
  'User already registered': 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'E-mail ainda não confirmado. Tente novamente em instantes.',
};

function translateAuthError(message) {
  return ERROR_MESSAGES[message] || message;
}

// Extrai os parâmetros de um deep link do tipo
// meutreino://reset-password#access_token=...&refresh_token=...&type=recovery
// ou meutreino://reset-password?code=...&type=recovery (fluxo PKCE)
function extractUrlParams(url) {
  if (!url) return {};
  const raw = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
  if (!raw) return {};
  const params = {};
  raw.split('&').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  });
  return params;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  // true quando o usuário chegou no app através do link de "Esqueci minha senha"
  // e ainda precisa cadastrar uma nova senha antes de usar o resto do app.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const handlingRecoveryLink = useRef(false);

  const loadProfile = async (userId, authUser) => {
    if (!userId) {
      setProfile(null);
      setProfileMissing(false);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      console.error('Erro ao carregar profile:', error.message);
      setProfile(null);
      setProfileMissing(false);
      return;
    }

    if (data) {
      setProfile(data);
      setProfileMissing(false);
      return;
    }

    // Conta existe em auth.users mas não tem registro em profiles (conta órfã de
    // um cadastro anterior que falhou no meio do caminho). Tenta recriar agora
    // usando os metadados salvos no signUp, em vez de deixar o usuário travado.
    const meta = authUser?.user_metadata || {};
    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        name: meta.name || null,
        email: authUser?.email || null,
        role: meta.role || 'cliente',
        personal_id: meta.personal_id || null,
        health_conditions: meta.health_conditions || null,
        health_restrictions: meta.health_restrictions || null,
        pix_key: meta.pix_key || null,
        whatsapp: meta.whatsapp || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Erro ao recriar profile órfão:', createError.message);
      setProfile(null);
      setProfileMissing(true);
      return;
    }

    setProfile(created);
    setProfileMissing(false);
  };

  const refreshProfile = async () => {
    if (session?.user?.id) await loadProfile(session.user.id, session.user);
  };

  // Processa o link recebido por e-mail para redefinição de senha.
  const handleAuthDeepLink = async (url) => {
    const params = extractUrlParams(url);
    if (params.type !== 'recovery') return;

    handlingRecoveryLink.current = true;
    try {
      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) throw error;
      } else if (params.access_token && params.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) throw error;
      } else {
        return;
      }
      setIsPasswordRecovery(true);
    } catch (e) {
      console.error('Erro ao processar link de redefinição de senha:', e.message);
    } finally {
      handlingRecoveryLink.current = false;
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Se JWT está inválido (issued at future, etc), faz logout e limpa
        if (error) {
          console.warn('Erro ao restaurar sessão:', error.message);
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        await loadProfile(session?.user?.id, session?.user);
      } catch (err) {
        console.error('Erro crítico ao restaurar sessão:', err);
        setSession(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Enquanto estamos processando o deep link de recuperação, o próprio
      // setSession() já dispara esse evento — ignora pra não sobrescrever o estado.
      if (handlingRecoveryLink.current) return;
      setSession(session);
      await loadProfile(session?.user?.id, session?.user);
    });

    // App aberto a partir de um link (app fechado / em background)
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url));

    return () => {
      listener.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  // extra = { name, role, personal_id, health_conditions, health_restrictions, pix_key, whatsapp }
  // O profile é criado automaticamente por um trigger no banco (ver supabase/schema_v3.sql),
  // por isso mandamos os dados extras em options.data em vez de inserir manualmente aqui.
  // Isso evita depender de sessão ativa logo após o signUp (ex: quando "confirmar e-mail" está ligado).
  const signUp = async (email, password, extra) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: extra.name,
          role: extra.role,
          personal_id: extra.personal_id || null,
          health_conditions: extra.health_conditions || null,
          health_restrictions: extra.health_restrictions || null,
          pix_key: extra.pix_key || null,
          whatsapp: extra.whatsapp || null,
        },
      },
    });
    if (error) return { error: { message: translateAuthError(error.message) } };

    // Supabase, por segurança, não avisa quando o e-mail já existe — ele retorna
    // "sucesso" mas sem criar nada de verdade (pra não revelar e-mails cadastrados).
    // Detectamos isso checando se voltou um usuário sem nenhuma "identity" nova.
    const identities = data?.user?.identities;
    if (data?.user && identities && identities.length === 0) {
      return { error: { message: 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.' } };
    }

    return { data };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data, error: { message: translateAuthError(error.message) } };
    return { data, error };
  };

  const signOut = async () => {
    setIsPasswordRecovery(false);
    await supabase.auth.signOut();
  };

  // Dispara o e-mail de "esqueci minha senha". Sempre retorna sucesso (mesma
  // mensagem seja o e-mail cadastrado ou não) pra não revelar quem tem conta.
  const resetPasswordForEmail = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_RESET_REDIRECT_URL,
    });
    if (error) return { error: { message: translateAuthError(error.message) } };
    return { error: null };
  };

  // Usada na tela de redefinição de senha (depois que o usuário clicou no link do e-mail).
  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: { message: translateAuthError(error.message) } };
    setIsPasswordRecovery(false);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        profileMissing,
        loading,
        isPasswordRecovery,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
