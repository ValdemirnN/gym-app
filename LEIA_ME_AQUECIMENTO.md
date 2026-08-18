# 🔥 Implementação de Aquecimento (Warm-up) — Guia de Aplicação

## Arquivos gerados

| Arquivo | O que é |
|---|---|
| `migration_add_is_warmup.sql` | Execute **primeiro** no Supabase SQL Editor |
| `WarmupExerciseList.js` | Novo componente — copie para `src/components/` |
| `CreateWorkoutScreen.WARMUP.patch.md` | Instruções para `CreateWorkoutScreen.js` |
| `CreateWorkoutScreen_WarmupStep.jsx` | Bloco JSX do passo Aquecimento + funções auxiliares |
| `CreateWorkoutForStudentScreen.WARMUP.patch.md` | Instruções para `CreateWorkoutForStudentScreen.js` |
| `WorkoutDetailScreens.WARMUP.patch.md` | Instruções para ambas as telas de detalhe |

---

## 1. Banco de dados

```sql
-- Execute no Supabase Dashboard → SQL Editor
-- arquivo: migration_add_is_warmup.sql
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS is_warmup BOOLEAN NOT NULL DEFAULT false;
```

**Por que `is_warmup` na própria tabela e não tabela separada?**
- O aquecimento usa os mesmos exercícios, vídeos e cargas que os exercícios normais.
- Uma única query busca tudo ordenado; `is_warmup = true` faz o filtro.
- O personal já tem as permissões de INSERT/UPDATE/DELETE na tabela.
- Nenhuma policy de RLS extra precisa ser criada.

---

## 2. Ordem de aplicação

### Passo A — Componente novo
Copie `WarmupExerciseList.js` para `src/components/WarmupExerciseList.js`.

### Passo B — CreateWorkoutForStudentScreen.js (wizard do personal)
Siga `CreateWorkoutForStudentScreen.WARMUP.patch.md` em ordem.
São 8 mudanças bem delimitadas (find & replace por trecho exato).

### Passo C — CreateWorkoutScreen.js (wizard pessoal, self-use)
Siga `CreateWorkoutScreen.WARMUP.patch.md`.
O bloco JSX do passo está em `CreateWorkoutScreen_WarmupStep.jsx`.

### Passo D — WorkoutDetailScreen.js + StudentWorkoutDetailScreen.js
Siga `WorkoutDetailScreens.WARMUP.patch.md`.
As mudanças trocam o `WarmupCard` (baseado em `daily_warmups`) pelo
novo `WarmupExerciseList` (baseado em `workout_exercises.is_warmup`).

---

## 3. O que muda em cada tela

### 3.1 Fluxo de criação (CreateWorkoutForStudentScreen e CreateWorkoutScreen)

**Antes:** Info → Exercícios → Revisão (3 passos)
**Depois:** Info → **Aquecimento** → Exercícios → Revisão (4 passos)

- O passo Aquecimento é uma cópia do passo Exercícios mas com:
  - Checkbox amarelos (cor `colors.amber`)
  - Estado separado (`warmupSelected`)
  - Sem opção de "Combinado" (bi-set)
  - Stepper de séries × reps para força; stepper de minutos para cardio/leve
  - Formulário de criação de exercício novo dedicado
  - Anexo de vídeo dedicado
- Na revisão, os aquecimentos aparecem num bloco amarelo no topo da lista.
- No `handleSave`, os exercícios de aquecimento são inseridos com `is_warmup = true`
  e `order_index` negativo (garantindo posição antes dos normais na query).

### 3.2 Tela do aluno (WorkoutDetailScreen)

- O `WarmupExerciseList` aparece como `ListHeaderComponent` do FlatList.
- Exibe cada exercício de aquecimento com:
  - Nome, grupo muscular, séries × reps ou duração
  - Vídeo inline (se houver)
  - Badge "Obrigatório" enquanto não confirmado
- **Trava de segurança:** o botão "Iniciar Treino" fica com ícone de cadeado
  e bloqueia a navegação até o aluno tocar em **"Confirmar Aquecimento"**.
- A confirmação reseta a cada vez que a tela ganha foco (useFocusEffect).

### 3.3 Tela do personal por aluno (StudentWorkoutDetailScreen)

- O `WarmupExerciseList` aparece no topo da lista de exercícios.
- O personal vê o botão 🗑️ ao lado de cada exercício de aquecimento para
  removê-lo individualmente (DELETE direto na `workout_exercises`).
- Para **adicionar ou substituir** aquecimentos, o personal usa
  "Editar Treino" (navega para `CreateWorkoutForStudentScreen`), onde
  o passo Aquecimento já está pré-carregado com os itens existentes.

---

## 4. Compatibilidade com `daily_warmups`

A tabela `daily_warmups` (aquecimento genérico por dia da semana) **continua
existindo**. As telas de detalhe param de consultá-la para o WarmupCard —
mas se você ainda usa essa tabela em outros lugares, nada quebra.

Se quiser manter ambos os fluxos (aquecimento do treino + aquecimento do dia),
basta não remover o `WarmupCard` original e exibir os dois em sequência.

---

## 5. Checklist final

- [ ] SQL executado no Supabase
- [ ] `WarmupExerciseList.js` copiado para `src/components/`
- [ ] Import do `WarmupExerciseList` adicionado em `WorkoutDetailScreen.js`
- [ ] Import do `WarmupExerciseList` adicionado em `StudentWorkoutDetailScreen.js`
- [ ] `CreateWorkoutForStudentScreen.js` atualizado (8 mudanças)
- [ ] `CreateWorkoutScreen.js` atualizado (4 mudanças + bloco JSX)
- [ ] Testado: criar treino com aquecimento → visualizar como aluno → confirmar → iniciar
- [ ] Testado: editar treino → aquecimento pré-carrega corretamente
- [ ] Testado: personal remove exercício de aquecimento pela tela de detalhe
