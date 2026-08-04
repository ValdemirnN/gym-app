import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { getQueue, setQueue } from './offlineQueue';

let isSyncing = false;
let netUnsubscribe = null;
let listeners = [];

function notify(count) {
  listeners.forEach((cb) => cb(count));
}

// Componentes (ex: um selo de "X pendências") podem escutar quantos
// itens ainda faltam sincronizar. Retorna uma função pra parar de escutar.
export function onQueueChange(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

export async function getPendingCount() {
  const queue = await getQueue();
  return queue.length;
}

function isNetworkError(error) {
  const msg = (error?.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout');
}

async function runAction(action) {
  if (action.type === 'insert') {
    return supabase.from(action.table).insert(action.payload);
  }
  if (action.type === 'update') {
    let query = supabase.from(action.table).update(action.payload);
    Object.entries(action.match || {}).forEach(([col, val]) => {
      query = query.eq(col, val);
    });
    return query;
  }
  return { error: new Error('Tipo de ação de sync desconhecido: ' + action.type) };
}

// Processa a fila em ordem (importante: um workout_log precisa ser
// inserido antes das séries dele, por exemplo — por isso NÃO paraleliza).
export async function processQueue() {
  if (isSyncing) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected || net.isInternetReachable === false) return;

  isSyncing = true;
  try {
    let queue = await getQueue();
    notify(queue.length);

    while (queue.length > 0) {
      const action = queue[0];
      const { error } = await runAction(action);

      if (error) {
        if (isNetworkError(error)) {
          // Sem internet de novo no meio do processo: para e tenta na próxima vez.
          break;
        }
        // Erro de dado (ex: linha já existe, referência inválida) — descarta
        // essa ação específica pra não travar a fila inteira pra sempre.
        console.warn('[sync] descartando ação com erro:', action.table, error.message);
      }

      queue = queue.slice(1);
      await setQueue(queue);
      notify(queue.length);
    }
  } finally {
    isSyncing = false;
  }
}

// Chama uma vez lá no App.js. Sincroniza assim que abrir o app (se tiver
// internet) e sempre que a conexão voltar.
export function startSyncManager() {
  processQueue();
  if (netUnsubscribe) return;
  netUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processQueue();
    }
  });
}

export function stopSyncManager() {
  if (netUnsubscribe) {
    netUnsubscribe();
    netUnsubscribe = null;
  }
}
