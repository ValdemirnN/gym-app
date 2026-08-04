import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { enqueue } from './offlineQueue';
import { processQueue } from './syncManager';

function isNetworkError(error) {
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout');
}

// Usa isso no lugar de `supabase.from(table).insert(payload)` sempre que
// a tela precisa continuar funcionando mesmo sem internet (ex: aluno
// registrando um treino). Se não tiver conexão, guarda a ação na fila
// local e devolve { offline: true } — a tela pode seguir normalmente,
// os dados sobem sozinhos quando a internet voltar.
export async function insertRow(table, payload) {
  const net = await NetInfo.fetch();
  if (net.isConnected && net.isInternetReachable !== false) {
    const { error } = await supabase.from(table).insert(payload);
    if (!error) return { offline: false, error: null };
    if (!isNetworkError(error)) return { offline: false, error };
  }
  await enqueue({ type: 'insert', table, payload });
  return { offline: true, error: null };
}

export async function updateRow(table, payload, match) {
  const net = await NetInfo.fetch();
  if (net.isConnected && net.isInternetReachable !== false) {
    let query = supabase.from(table).update(payload);
    Object.entries(match).forEach(([col, val]) => {
      query = query.eq(col, val);
    });
    const { error } = await query;
    if (!error) return { offline: false, error: null };
    if (!isNetworkError(error)) return { offline: false, error };
  }
  await enqueue({ type: 'update', table, payload, match });
  return { offline: true, error: null };
}

// Chama depois de uma sequência de insertRow/updateRow offline-safe, pra
// tentar já mandar tudo na hora caso a internet volte rapidinho — sem
// bloquear a tela (não precisa de await no chamador).
export function trySyncNow() {
  processQueue();
}
