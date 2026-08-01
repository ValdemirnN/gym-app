# Meu Treino — App de Academia

App em React Native (Expo) + Supabase para usuários criarem e executarem seus treinos.

## O que já está pronto
- Login e cadastro de usuário
- Criação de planos de treino (escolhendo exercícios de um catálogo)
- Execução de treino (registro de peso/reps por série)
- Histórico de treinos
- Perfil do usuário (nome, altura, peso)
- Banco de dados completo com regras de segurança (cada usuário só vê os próprios dados)

---

## PASSO 1 — Criar o banco de dados (Supabase)

1. Acesse **https://supabase.com** e crie uma conta gratuita.
2. Clique em **New Project**. Escolha um nome, senha do banco e região (escolha uma perto do Brasil, ex: São Paulo/sa-east-1 se disponível).
3. Espere o projeto ser criado (~2 min).
4. Vá em **SQL Editor** (menu lateral) → **New query**.
5. Abra o arquivo `supabase/schema.sql` deste projeto, copie todo o conteúdo, cole no editor e clique em **Run**.
   - Isso cria todas as tabelas, regras de segurança e um catálogo inicial de exercícios.
6. Vá em **Project Settings** → **API**. Copie:
   - **Project URL**
   - **anon public key**

## PASSO 2 — Conectar o app ao banco

1. Abra o arquivo `src/lib/supabaseConfig.js`.
2. Substitua os valores de `SUPABASE_URL` e `SUPABASE_ANON_KEY` pelos que você copiou no passo anterior.

## PASSO 3 — Instalar as ferramentas no seu computador

Você vai precisar de:
- **Node.js** (versão 18 ou superior): baixe em https://nodejs.org
- **Expo Go** no seu celular (iOS ou Android): baixe na App Store / Play Store — é o app que permite testar seu projeto direto no celular, sem precisar compilar nada ainda.

## PASSO 4 — Rodar o projeto

No terminal, dentro da pasta do projeto:

```bash
npm install
npx expo start
```

Isso vai abrir um QR Code no terminal / navegador.
- **Android**: abra o app Expo Go e escaneie o QR Code.
- **iPhone**: abra a câmera do iPhone e aponte pro QR Code, vai abrir no Expo Go automaticamente.

Pronto — o app vai rodar no seu celular igual estivesse instalado, e já vai estar conectado ao banco de dados real.

## PASSO 5 — Testar

1. Crie uma conta pelo app (tela de Cadastro).
2. Vá em "Treinos" → "+ Novo" → dê um nome, selecione exercícios, defina séries/reps → Salvar.
3. Toque no treino criado → "Iniciar Treino" → preencha peso/reps de cada série → marque como feita → "Finalizar Treino".
4. Volte pra aba "Início" e veja o treino no seu histórico.

---

## PASSO 6 — Publicar de verdade na App Store e Play Store

Isso é feito com o **EAS (Expo Application Services)**, gratuito para builds ocasionais.

### 6.1 Criar as contas de desenvolvedor (obrigatório, feito por você)
- **Google Play**: https://play.google.com/console — taxa única de US$25
- **Apple Developer**: https://developer.apple.com/programs — US$99/ano (só é possível com conta Apple e, geralmente, precisa confirmar dados de pessoa física/jurídica)

### 6.2 Gerar os arquivos de instalação (build)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android
eas build --platform ios
```

O EAS compila na nuvem — você **não precisa de Mac** nem para gerar o build de iOS. Ao final, ele te dá um link para baixar o `.aab` (Android) e o `.ipa` (iOS).

### 6.3 Enviar para as lojas

```bash
eas submit --platform android
eas submit --platform ios
```

Esse comando já envia o build direto para o Google Play Console / App Store Connect. Depois disso, você só precisa preencher a ficha da loja (descrição, capturas de tela, categoria, política de privacidade) e enviar para revisão.

📄 Guia oficial (em inglês, mas bem visual): https://docs.expo.dev/deploy/submit-to-app-stores/

---

## Antes de publicar, não esqueça de:
- Trocar `com.seunome.meutreino` no arquivo `app.json` pelo identificador do seu app (ex: `com.suaempresa.meutreino`)
- Criar os ícones/splash screen reais na pasta `assets/` (o projeto referencia `icon.png`, `splash.png`, `adaptive-icon.png` — você vai precisar adicionar essas imagens)
- Escrever uma política de privacidade (obrigatória para apps com login/dados de usuário) — pode ser uma página simples hospedada em qualquer lugar

## Próximos passos sugeridos (quando quiser evoluir o app)
- Gráfico de evolução de carga por exercício
- Notificações lembrando do treino
- Cronômetro de descanso entre séries
- Fotos de progresso
