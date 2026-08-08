// supabase/functions/send-push/index.ts
//
// Essa função roda no servidor da Supabase (Deno), não no celular.
// Ela recebe { user_id, title, body }, busca o token de push desse
// usuário na tabela profiles, e manda a notificação de verdade pro
// celular dele através da Expo Push API.
//
// COMO FAZER O DEPLOY (só uma vez):
//   1. Instala a CLI da Supabase (se ainda não tiver):
//        npm install -g supabase
//   2. Loga:
//        supabase login
//   3. Vincula ao seu projeto (pega o "project ref" no painel do Supabase,
//      em Project Settings > General):
//        supabase link --project-ref SEU_PROJECT_REF
//   4. Deploy:
//        supabase functions deploy send-push
//   5. Copia a URL que aparecer (algo como
//      https://SEU_PROJECT_REF.supabase.co/functions/v1/send-push)
//      e cola no lugar de 'https://SEU-PROJETO.supabase.co/functions/v1/send-push'
//      dentro do supabase/schema_v21.sql (função trigger_send_push),
//      depois roda esse trecho do SQL de novo no SQL Editor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const { user_id, title, body } = await req.json();

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id e title são obrigatórios' }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', user_id)
      .maybeSingle();

    if (error || !profile?.expo_push_token) {
      // Usuário não tem token cadastrado (nunca abriu o app com push habilitado) — tudo bem, não é erro.
      return new Response(JSON.stringify({ skipped: true, reason: 'sem token de push' }), { status: 200 });
    }

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: profile.expo_push_token,
        title,
        body: body || '',
        sound: 'default',
      }),
    });

    const result = await pushResponse.json();
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
