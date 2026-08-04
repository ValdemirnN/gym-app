// Gerador de UUID v4 simples, sem dependência externa.
// Usado pra criar o id de um registro (ex: workout_log) NO APARELHO,
// antes mesmo de ter internet — assim o mesmo id pode ser usado
// offline e depois sincronizado com o Supabase sem precisar
// "trocar" o id depois (o Postgres aceita id explícito no insert).
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
