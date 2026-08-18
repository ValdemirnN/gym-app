import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

// Troque esse número pelo WhatsApp de quem vai atender o suporte técnico
// (você mesmo, ou quem cuida do app no dia a dia).
const SUPPORT_WHATSAPP = '5584999999999';
const SUPPORT_EMAIL = 'nvaldemir76@gmail.com';

const FAQ_ALUNO = [
  {
    q: 'Não tenho internet, o app funciona mesmo assim?',
    a: 'Funciona! Você pode fazer o treino normalmente sem internet. Assim que seu celular conectar de novo, tudo é enviado automaticamente pro seu personal.',
  },
  {
    q: 'Como eu troco um exercício por outro?',
    a: 'Durante o treino, toque nos "⋮" ao lado do exercício e escolha "Fazer outro exercício no lugar". Só aparecem as opções que seu personal já autorizou.',
  },
  {
    q: 'Como vejo o vídeo de um exercício?',
    a: 'Se o exercício tiver vídeo cadastrado pelo seu personal, aparece um botão "Ver vídeo" logo abaixo do nome dele, tanto antes de começar quanto durante o treino.',
  },
  {
    q: 'Como participo de um desafio?',
    a: 'Na tela de Desafios, leia a regra que seu personal escreveu e toque em "Tirar foto e ganhar ponto" sempre que cumprir. Cada foto enviada conta 1 ponto no ranking.',
  },
  {
    q: 'Meu treino sumiu ou não abre, o que eu faço?',
    a: 'Primeiro tenta fechar o app completamente e abrir de novo. Se continuar, fala com seu personal pelo chat, ou usa o suporte técnico abaixo.',
  },
];

const FAQ_PERSONAL = [
  {
    q: 'Como eu defino substitutos pra um exercício?',
    a: 'Na tela de montar o treino do aluno, depois de marcar o exercício, toque em "Cadastrar substituto" e escolha até 2 exercícios que o aluno pode usar no lugar.',
  },
  {
    q: 'Como excluo um aluno sem perder o cadastro?',
    a: 'Na lista de alunos, toque no ícone de lixeira ao lado do nome dele. Ele some da lista de ativos, mas o cadastro fica guardado — você pode reativar quando quiser na aba "Excluídos".',
  },
  {
    q: 'Como crio um desafio pros meus alunos?',
    a: 'No Dashboard, toque em "Desafios" → "Novo desafio". Defina o título, a regra (na descrição), o período e a premiação. Os alunos participam enviando fotos, e você escolhe o vencedor pelo ranking.',
  },
  {
    q: 'Como registro uma avaliação física de um aluno?',
    a: 'Entre no perfil do aluno → "Avaliações físicas" → toque no "+" pra lançar peso, % de gordura e medidas. Dá pra acompanhar a evolução e cadastrar metas também.',
  },
  {
    q: 'Preciso gerar um APK novo toda vez que peço uma mudança?',
    a: 'Não, na maioria das vezes não. Mudanças de tela/lógica são enviadas via atualização remota (OTA) e chegam sozinhas pro celular dos alunos. Só é necessário gerar um novo APK/build quando entra uma biblioteca nativa nova.',
  },
];

export default function FaqScreen({ navigation, route }) {
  const role = route?.params?.role === 'personal' ? 'personal' : 'aluno';
  const faqs = role === 'personal' ? FAQ_PERSONAL : FAQ_ALUNO;
  const [openIndex, setOpenIndex] = useState(null);
  const [message, setMessage] = useState('');

  const sendWhatsApp = () => {
    const text = message.trim()
      ? message.trim()
      : 'Oi! Preciso de ajuda com um problema técnico no app.';
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('Erro', 'Não consegui abrir o WhatsApp.');
    });
  };

  const sendEmail = () => {
    const subject = encodeURIComponent('Suporte técnico - Meu Treino');
    const body = encodeURIComponent(message.trim() || 'Descreva aqui o problema que você encontrou...');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Erro', 'Não consegui abrir o app de e-mail.');
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Dúvidas e suporte</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.sectionTitle}>Perguntas frequentes</Text>
        {faqs.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <TouchableOpacity key={i} style={styles.faqCard} onPress={() => setOpenIndex(isOpen ? null : i)} activeOpacity={0.8}>
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{item.q}</Text>
                <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim2} />
              </View>
              {isOpen && <Text style={styles.faqAnswer}>{item.a}</Text>}
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Não achou a resposta?</Text>
        <Text style={styles.supportDesc}>
          Conta pra gente o que aconteceu que a gente te ajuda o quanto antes.
        </Text>
        <TextInput
          style={styles.textArea}
          placeholder="Descreva o problema técnico que você encontrou..."
          placeholderTextColor={colors.textDim2}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TouchableOpacity style={styles.whatsappButton} onPress={sendWhatsApp}>
          <Feather name="message-circle" size={16} color="#04170F" />
          <Text style={styles.whatsappButtonText}> Falar no WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emailButton} onPress={sendEmail}>
          <Feather name="mail" size={16} color={colors.text} />
          <Text style={styles.emailButtonText}> Enviar por e-mail</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(10), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(18), fontWeight: '800', color: colors.text, marginBottom: vs(16) },
  sectionTitle: { color: colors.textDim, fontSize: fs(10), fontWeight: '700', textTransform: 'uppercase', marginBottom: vs(10) },
  faqCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(8),
  },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { color: colors.text, fontSize: fs(11.5), fontWeight: '600', flex: 1, marginRight: 10 },
  faqAnswer: { color: colors.textDim, fontSize: fs(10.5), marginTop: vs(10), lineHeight: 18 },
  supportDesc: { color: colors.textDim, fontSize: fs(10.5), marginBottom: vs(10), lineHeight: 18 },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    color: colors.text,
    fontSize: fs(11.5),
    height: 90,
    textAlignVertical: 'top',
    marginBottom: vs(12),
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: radius.sm,
    paddingVertical: vs(13),
    marginBottom: vs(10),
  },
  whatsappButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(12) },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: vs(13),
  },
  emailButtonText: { color: colors.text, fontWeight: '600', fontSize: fs(12) },
});
