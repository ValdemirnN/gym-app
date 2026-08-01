# Atualização de tema — Rasgua (aluno)

Este zip contém só os arquivos que mudaram/foram criados. Para aplicar:

1. Extraia este zip **na raiz do seu projeto** (`gym-app/`), sobrescrevendo os
   arquivos existentes quando perguntado.
2. Rode `npm install` de novo (adicionei `@expo/vector-icons` como dependência
   explícita em `package.json` — ele já vem junto do Expo, mas não estava
   instalado no node_modules do seu zip).
3. `npx expo start` normalmente.

## O que mudou

- `src/screens/HomeScreen.js` — tela "Início" do aluno: header, card verde
  "Falar com seu personal" e lista de treinos recentes com barrinha colorida
  + badge (Concluído / Em andamento / Não treinou), no estilo do protótipo.
- `src/screens/WorkoutsScreen.js` — "Meus Treinos": headers de seção
  (SEGUNDA-FEIRA, TERÇA-FEIRA...) e cards com ícone, estilo `menu-item` do
  protótipo.
- `src/screens/ClientChatListScreen.js` — "Conversas": cards de chat com
  avatar, badge "Seu personal" e indicador de mensagem não lida.
- `src/screens/ProfileScreen.js` — "Meu Perfil": **mesmos campos e mesma
  lógica de sempre** (dados pessoais, contato, biometria, anamnese, liberação
  médica, salvar, trocar foto, enviar atestado) — só troquei cores/raios/
  espaçamentos pelos tokens de `src/theme/theme.js`, os mesmos já usados no
  perfil do personal.
- `src/navigation/AppNavigator.js` — troquei os emojis da barra inferior por
  ícones do Feather (`@expo/vector-icons`) e apliquei a cor de fundo, borda e
  altura da navbar do protótipo nos 3 fluxos (aluno, personal e admin).
- `package.json` — adicionado `@expo/vector-icons` como dependência.

`src/theme/theme.js` (paleta, raios, espaçamentos) **não precisou mudar** —
ele já tinha os valores certos do protótipo, só que quase nenhuma tela
estava importando ele ainda.

## O que eu não toquei ainda

As demais telas do fluxo do aluno (detalhe de treino, treino ativo, upload de
vídeo, conversa 1‑a‑1, etc.) ainda usam os estilos antigos. Dá pra seguir
exatamente o mesmo padrão nelas — é só pedir que eu faço as próximas.
