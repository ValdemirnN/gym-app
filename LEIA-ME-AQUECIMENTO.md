# Aquecimento Diário — Guia de Integração

## Arquivos entregues

```
gym-app-warmup/
├── supabase/
│   └── schema_v26_daily_warmup.sql          ← rode no Supabase SQL Editor
├── src/
│   ├── components/
│   │   └── WarmupCard.js                    ← componente novo (copie para o projeto)
│   └── screens/
│       ├── WorkoutDetailScreen.PATCH.js     ← instruções de alteração (Personal)
│       └── StudentWorkoutDetailScreen.PATCH.js ← instruções de alteração (Aluno)
└── LEIA-ME-AQUECIMENTO.md                   ← este arquivo
```

---

## 1. Modelagem de dados

### Por que uma tabela separada?

O aquecimento **não é um exercício** do treino. Misturá-lo em `workout_exercises` com um `order_index = -1` traria problemas: ele apareceria nos logs, nas séries concluídas, na contagem de exercícios, etc. A tabela separada mantém o domínio limpo.

### Estrutura da tabela `daily_warmups`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | identificador |
| `personal_id` | uuid FK → profiles | quem criou |
| `day_of_week` | text (enum check) | 'segunda', 'terca', … |
| `student_id` | uuid FK → profiles (nullable) | null = vale para todos os alunos do personal nesse dia; uuid = sobrescreve só para aquele aluno |
| `title` | text | nome do aquecimento |
| `instructions` | text | orientações escritas |
| `duration_minutes` | int | tempo estimado |
| `reps_detail` | text | ex: "3x10 polichinelos + 2 min esteira" |
| `video_id` | uuid FK → exercise_videos | vídeo demonstrativo (opcional) |

A constraint `UNIQUE (personal_id, day_of_week, student_id)` garante no banco que existe **no máximo um aquecimento por {personal, dia, aluno}**, evitando duplicatas mesmo com chamadas concorrentes.

---

## 2. Passo a passo de instalação

### Passo 1 — banco de dados
Abra o **SQL Editor** do Supabase e rode o conteúdo de `schema_v26_daily_warmup.sql` inteiro.

> ⚠️ O script pressupõe que a tabela `exercise_videos` já existe (referenciada em migrações anteriores). Se ainda não existe no seu banco, remova ou comente a linha `video_id uuid references exercise_videos(id) on delete set null`.

### Passo 2 — componente
Copie `src/components/WarmupCard.js` para `gym-app/src/components/WarmupCard.js`.

### Passo 3 — WorkoutDetailScreen (Personal)
Abra `gym-app/src/screens/WorkoutDetailScreen.js` e aplique as alterações descritas em `WorkoutDetailScreen.PATCH.js`:

1. Adicione o import do `WarmupCard`.
2. Desestruture `profile` do `useAuth()` (além do `session` já existente).
3. Adicione o estado `warmup` e a função `loadWarmup`.
4. Chame `loadWarmup()` dentro do `useFocusEffect`.
5. Adicione `ListHeaderComponent` na `<FlatList>`.

### Passo 4 — StudentWorkoutDetailScreen (visão do personal sobre o aluno)
Abra `gym-app/src/screens/StudentWorkoutDetailScreen.js` e aplique as alterações descritas em `StudentWorkoutDetailScreen.PATCH.js`:

1. Adicione o import do `WarmupCard`.
2. Adicione o estado `warmup` e a função `loadWarmup`.
3. Chame `loadWarmup()` dentro do `useFocusEffect`.
4. Insira o `<WarmupCard>` como **primeiro filho** do `<ScrollView>`.

> **Atenção:** certifique-se de passar `dayOfWeek` em `route.params` ao navegar para `StudentWorkoutDetailScreen`. O parâmetro já existe em `WorkoutDetailScreen` — basta replicar ao navegar para a tela do aluno.

---

## 3. Lógica de renderização condicional

O componente `WarmupCard` recebe a prop `isPersonal` (boolean) e se comporta assim:

| Cenário | Comportamento |
|---|---|
| `isPersonal=true` + sem aquecimento | Exibe botão "Adicionar Aquecimento do Dia" |
| `isPersonal=true` + com aquecimento | Exibe card colapsável com botões ✏️ e 🗑️ |
| `isPersonal=false` + sem aquecimento | Renderiza `null` (invisível) |
| `isPersonal=false` + com aquecimento | Exibe card colapsável, sem botões de edição |

A validação do perfil no app fica assim:

```js
// WorkoutDetailScreen (Personal)
<WarmupCard isPersonal={true} ... />

// Tela do Aluno (StudentWorkoutDetailScreen ou outra tela de aluno)
<WarmupCard isPersonal={false} ... />
```

A proteção de escrita existe em duas camadas:
- **RLS no banco**: as policies de `INSERT`, `UPDATE` e `DELETE` verificam `public.current_user_role() = 'personal'`.
- **UI**: o botão de adicionar/editar/remover só aparece quando `isPersonal=true`.

---

## 4. Posicionamento fixo no topo

### WorkoutDetailScreen (usa FlatList)
Usar `ListHeaderComponent` é a abordagem correta para FlatList: o componente scrollará junto com a lista, mas sempre aparece **antes de qualquer item**, sem precisar de `position: 'absolute'` ou ScrollView aninhado.

```jsx
<FlatList
  data={groupedItems}
  ListHeaderComponent={<WarmupCard ... />}  // ← sempre no topo
  renderItem={...}
/>
```

### StudentWorkoutDetailScreen (usa ScrollView)
Inserir o `<WarmupCard>` como **primeiro filho** do `<ScrollView>` garante o mesmo efeito.

```jsx
<ScrollView>
  <WarmupCard ... />   {/* ← sempre no topo */}
  {items.map(...)}
</ScrollView>
```

---

## 5. Lógica de prioridade (genérico vs. por aluno)

A função `loadWarmup` em `StudentWorkoutDetailScreen` aplica a seguinte lógica de fallback:

1. Tenta buscar um aquecimento **específico para o aluno** (`student_id = studentId`).
2. Se não encontrar, usa o aquecimento **genérico do personal** para aquele dia (`student_id IS NULL`).

Isso permite que o personal personalize o aquecimento para alunos com restrições específicas sem precisar recriar um para cada um.
