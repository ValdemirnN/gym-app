import AsyncStorage from '@react-native-async-storage/async-storage';

// Fila de ações pendentes (inserts/updates que não conseguiram ir pro
// Supabase por falta de internet). Fica guardada no aparelho até o
// syncManager conseguir mandar tudo.
const QUEUE_KEY = 'offline_sync_queue_v1';

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function setQueue(queue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// action: { type: 'insert' | 'update', table, payload, match? }
// match é usado só no 'update': { coluna: valor } vira .eq('coluna', valor)
export async function enqueue(action) {
  const queue = await getQueue();
  queue.push({ ...action, queuedAt: Date.now() });
  await setQueue(queue);
  return queue.length;
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
