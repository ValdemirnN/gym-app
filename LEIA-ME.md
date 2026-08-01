# O que mudou

Copie estes arquivos para dentro do seu projeto, mantendo os mesmos caminhos
(eles substituem os originais ou são novos):

## 1. Esqueci minha senha

**Novos:**
- `src/screens/ForgotPasswordScreen.js` — tela onde o usuário digita o e-mail e recebe o link.
- `src/screens/ResetPasswordScreen.js` — tela de nova senha + confirmar senha, com checklist visual dos 4 requisitos.
- `src/utils/passwordValidation.js` — as 4 regras de senha (mín. 7 caracteres, 1 maiúscula, 1 número, 1 caractere especial), usadas tanto no cadastro quanto na redefinição.

**Substituídos:**
- `src/context/AuthContext.js` — adiciona `resetPasswordForEmail`, `updatePassword`, e o tratamento do deep link que o app recebe quando o usuário toca no link do e-mail.
- `src/navigation/AppNavigator.js` — registra a tela "ForgotPassword" e força a tela de nova senha assim que o link é aberto.
- `src/screens/LoginScreen.js` — adiciona o link "Esqueceu a senha? Clique aqui".
- `src/screens/SignupScreen.js` — passou a exigir as mesmas 4 regras de senha do reset (antes só pedia 6 caracteres), pra não ter senha "fraca" permitida num lugar e recusada no outro.
- `app.json` — adiciona `"scheme": "meutreino"`, necessário para o link do e-mail conseguir reabrir o app.

### ⚠️ Configuração obrigatória no painel do Supabase
Vá em **Authentication → URL Configuration** e adicione em **Redirect URLs**:
```
meutreino://reset-password
```
Sem isso, o Supabase recusa o redirect e o link do e-mail não vai abrir o app.

### ⚠️ Sobre testar em desenvolvimento
Esquemas de URL customizados (`meutreino://...`) **não funcionam no app Expo Go**.
Para testar o fluxo completo do link de e-mail, você precisa rodar um
"development build" (`npx expo run:android` / `npx expo run:ios`, ou um build
com EAS) — no Expo Go o clique no link não vai reabrir seu app.

---

## 2. Perfil completo do Personal Trainer

**Novo:**
- `supabase/schema_v13.sql` — roda no SQL Editor do Supabase; adiciona as novas colunas na tabela `profiles` (é aditivo, não apaga nada).

**Substituído:**
- `src/screens/PersonalProfileScreen.js` — tela de perfil do Personal agora reúne:
  - **Dados pessoais:** nome, data de nascimento, gênero (a foto de perfil já existia).
  - **Contato:** WhatsApp (já existia), Instagram, LinkedIn (e-mail já era mostrado).
  - **Credenciamento (obrigatório):** número do CREF e estado (UF) de atuação.
  - **Atuação profissional:** especialidades (seleção múltipla) e bio.
  - **Comercial e operacional:** valor da consultoria, planos disponíveis (texto livre), local de atendimento (online/presencial, com endereço quando presencial) e horários de disponibilidade.
  - Chave Pix continua no fim, como já era.

### Observação de design
- "Planos disponíveis" ficou como texto livre (ex: "Mensal, Trimestral") em vez de um cadastro estruturado de planos com preço — isso evita criar uma tabela nova e uma tela de CRUD só pra isso. Se depois vocês quiserem planos com preço/duração individuais, dá pra evoluir para uma tabela `personal_plans` à parte.
- Não mexi na tela de cadastro (Signup) do Personal para pedir todos esses campos de cara — o cadastro continua rápido (nome/e-mail/senha/Pix) e o Personal completa CREF, bio, especialidades etc. depois em "Meu Perfil". Se preferir que isso já seja obrigatório no cadastro, é só avisar que eu ajusto o `SignupScreen.js`.
