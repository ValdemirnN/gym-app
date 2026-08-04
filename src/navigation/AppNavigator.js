import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import WorkoutsScreen from '../screens/WorkoutsScreen';
import CreateWorkoutScreen from '../screens/CreateWorkoutScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import ActiveWorkoutScreen from '../screens/ActiveWorkoutScreen';
import UploadVideoScreen from '../screens/UploadVideoScreen';
import VideoPlayerScreen from '../screens/VideoPlayerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ClientChatListScreen from '../screens/ClientChatListScreen';
import TalkToPersonalScreen from '../screens/TalkToPersonalScreen';
import ChatScreen from '../screens/ChatScreen';
import PendingApprovalScreen from '../screens/PendingApprovalScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminPersonalsListScreen from '../screens/AdminPersonalsListScreen';
import AdminProfileScreen from '../screens/AdminProfileScreen';

// telas do Personal
import PersonalDashboardScreen from '../screens/PersonalDashboardScreen';
import PersonalStudentsListScreen from '../screens/PersonalStudentsListScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import StudentWorkoutsScreen from '../screens/StudentWorkoutsScreen';
import CreateWorkoutForStudentScreen from '../screens/CreateWorkoutForStudentScreen';
import StudentWorkoutDetailScreen from '../screens/StudentWorkoutDetailScreen';
import StudentHistoryScreen from '../screens/StudentHistoryScreen';
import StudentWorkoutLogDetailScreen from '../screens/StudentWorkoutLogDetailScreen';
import StudentHealthScreen from '../screens/StudentHealthScreen';
import StudentRegistrationScreen from '../screens/StudentRegistrationScreen';
import StudentSubscriptionScreen from '../screens/StudentSubscriptionScreen';
import PersonalProfileScreen from '../screens/PersonalProfileScreen';
import PersonalChatListScreen from '../screens/PersonalChatListScreen';
import StudentEvaluationsScreen from '../screens/StudentEvaluationsScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import StudentChallengeScreen from '../screens/StudentChallengeScreen';
import FaqScreen from '../screens/FaqScreen';
import ParqScreen from '../screens/ParqScreen';
import StudentParqViewScreen from '../screens/StudentParqViewScreen';
import StudentOwnSubscriptionScreen from '../screens/StudentOwnSubscriptionScreen';

// <<<--- 1. IMPORTAÇÃO DA NOVA TELA ADICIONADA AQUI --->>>
import NotificationsScreen from '../screens/NotificationsScreen';

const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();
const ClientChatStackNav = createNativeStackNavigator();
const PersonalStack = createNativeStackNavigator();
const PersonalChatStackNav = createNativeStackNavigator();
// <<<--- 2. NOVO STACK PARA O DASHBOARD DO PERSONAL --->>>
const PersonalHomeStackNav = createNativeStackNavigator(); 

const Tab = createBottomTabNavigator();
const PersonalTab = createBottomTabNavigator();
const AdminTab = createBottomTabNavigator();

const tabScreenOptions = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: colors.surface3,
    borderTopColor: colors.border2,
    borderTopWidth: 1,
    height: 64,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.textDim,
  tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600' },
};

function resetToRootOnTabPress(rootScreenName) {
  return ({ navigation, route }) => ({
    tabPress: (e) => {
      // Impede o comportamento padrão de "lembrar" a última tela
      e.preventDefault();
      // Força a aba a abrir sempre na tela inicial (root) limpa
      navigation.navigate(route.name, { screen: rootScreenName });
    },
  });
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

// ---------- Aluno (cliente) ----------

function HomeStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="HomeMain" component={HomeScreen} />
      <RootStack.Screen name="TalkToPersonal" component={TalkToPersonalScreen} />
      <RootStack.Screen name="Chat" component={ChatScreen} />
      {/* <<<--- 3. TELA DE NOTIFICAÇÕES DO ALUNO ADICIONADA AQUI --->>> */}
      <RootStack.Screen name="NotificationsScreen" component={NotificationsScreen} />
      <RootStack.Screen name="StudentChallenge" component={StudentChallengeScreen} />
      <RootStack.Screen name="Faq" component={FaqScreen} />
      <RootStack.Screen name="Parq" component={ParqScreen} />
      <RootStack.Screen name="Faturas" component={StudentOwnSubscriptionScreen} />
    </RootStack.Navigator>
  );
}

function WorkoutsStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="WorkoutsList" component={WorkoutsScreen} />
      <RootStack.Screen name="CreateWorkout" component={CreateWorkoutScreen} />
      <RootStack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
      <RootStack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
      <RootStack.Screen name="UploadVideo" component={UploadVideoScreen} />
      <RootStack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
    </RootStack.Navigator>
  );
}

function ClientChatStack() {
  return (
    <ClientChatStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ClientChatStackNav.Screen name="ChatList" component={ClientChatListScreen} />
      <ClientChatStackNav.Screen name="ChatConversation" component={ChatScreen} />
    </ClientChatStackNav.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: 'Início', tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} /> }}
        listeners={resetToRootOnTabPress('HomeMain')}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutsStack}
        options={{ tabBarLabel: 'Treinos', tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} /> }}
        listeners={resetToRootOnTabPress('WorkoutsList')}
      />
      <Tab.Screen
        name="ClientChat"
        component={ClientChatStack}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} /> }}
        listeners={resetToRootOnTabPress('ChatList')}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

// ---------- Personal ----------

// <<<--- 4. STACK DO DASHBOARD DO PERSONAL CRIADO AQUI --->>>
function PersonalHomeStack() {
  return (
    <PersonalHomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <PersonalHomeStackNav.Screen name="PersonalDashboardMain" component={PersonalDashboardScreen} />
      <PersonalHomeStackNav.Screen name="NotificationsScreen" component={NotificationsScreen} />
      <PersonalHomeStackNav.Screen name="Challenges" component={ChallengesScreen} />
      <PersonalHomeStackNav.Screen name="Faq" component={FaqScreen} />
    </PersonalHomeStackNav.Navigator>
  );
}

function PersonalStudentsStack() {
  return (
    <PersonalStack.Navigator screenOptions={{ headerShown: false }}>
      <PersonalStack.Screen name="StudentsList" component={PersonalStudentsListScreen} />
      <PersonalStack.Screen name="StudentDetail" component={StudentDetailScreen} />
      <PersonalStack.Screen name="StudentWorkouts" component={StudentWorkoutsScreen} />
      <PersonalStack.Screen name="CreateWorkoutForStudent" component={CreateWorkoutForStudentScreen} />
      <PersonalStack.Screen name="StudentWorkoutDetail" component={StudentWorkoutDetailScreen} />
      <PersonalStack.Screen name="StudentHistory" component={StudentHistoryScreen} />
      <PersonalStack.Screen name="StudentEvaluations" component={StudentEvaluationsScreen} />
      <PersonalStack.Screen name="StudentParqView" component={StudentParqViewScreen} />
      <PersonalStack.Screen name="StudentWorkoutLogDetail" component={StudentWorkoutLogDetailScreen} />
      <PersonalStack.Screen name="StudentChat" component={ChatScreen} />
      <PersonalStack.Screen name="StudentHealth" component={StudentHealthScreen} />
      <PersonalStack.Screen name="StudentRegistration" component={StudentRegistrationScreen} />
      <PersonalStack.Screen name="StudentSubscription" component={StudentSubscriptionScreen} />
      <PersonalStack.Screen name="UploadVideo" component={UploadVideoScreen} />
      <PersonalStack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
    </PersonalStack.Navigator>
  );
}

function PersonalChatStack() {
  return (
    <PersonalChatStackNav.Navigator screenOptions={{ headerShown: false }}>
      <PersonalChatStackNav.Screen name="ChatList" component={PersonalChatListScreen} />
      <PersonalChatStackNav.Screen name="ChatConversation" component={ChatScreen} />
    </PersonalChatStackNav.Navigator>
  );
}

function PersonalTabs() {
  return (
    <PersonalTab.Navigator screenOptions={tabScreenOptions}>
      <PersonalTab.Screen
        name="PersonalDashboard"
        component={PersonalHomeStack} // <<<--- 5. ALTERADO DE PersonalDashboardScreen PARA PersonalHomeStack --->>>
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} /> }}
        listeners={resetToRootOnTabPress('PersonalDashboardMain')} // <<<--- 6. ADICIONADO LISTENER --->>>
      />
      <PersonalTab.Screen
        name="PersonalStudents"
        component={PersonalStudentsStack}
        options={{ tabBarLabel: 'Alunos', tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} /> }}
        listeners={resetToRootOnTabPress('StudentsList')}
      />
      <PersonalTab.Screen
        name="PersonalChat"
        component={PersonalChatStack}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ color }) => <Feather name="message-circle" size={22} color={color} /> }}
        listeners={resetToRootOnTabPress('ChatList')}
      />
      <PersonalTab.Screen
        name="PersonalProfile"
        component={PersonalProfileScreen}
        options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }}
      />
    </PersonalTab.Navigator>
  );
}

// ---------- Admin ----------

function AdminTabs() {
  return (
    <AdminTab.Navigator screenOptions={tabScreenOptions}>
      <AdminTab.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} /> }}
      />
      <AdminTab.Screen
        name="AdminPersonals"
        component={AdminPersonalsListScreen}
        options={{ tabBarLabel: 'Personals', tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={color} /> }}
      />
      <AdminTab.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }}
      />
    </AdminTab.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={loadingStyles.container}>
      <ActivityIndicator color="#22C55E" size="large" />
    </View>
  );
}

function ProfileErrorScreen() {
  const { signOut, refreshProfile, profileMissing } = useAuth();
  return (
    <View style={loadingStyles.container}>
      <Text style={loadingStyles.text}>
        {profileMissing
          ? 'Sua conta foi criada, mas o cadastro não foi concluído corretamente. Saia e cadastre-se novamente, ou fale com o suporte.'
          : 'Não consegui carregar seu perfil. Verifique sua conexão e tente novamente.'}
      </Text>
      <TouchableOpacity style={loadingStyles.button} onPress={refreshProfile}>
        <Text style={loadingStyles.buttonText}>Tentar novamente</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={signOut} style={{ marginTop: 16 }}>
        <Text style={{ color: '#EF4444' }}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const loadingStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', padding: 32 },
  text: { color: '#9CA3AF', textAlign: 'center', marginBottom: 20, fontSize: 14, lineHeight: 20 },
  button: { backgroundColor: '#22C55E', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: '#111827', fontWeight: 'bold' },
});

export default function AppNavigator() {
  const { session, profile, loading, isPasswordRecovery } = useAuth();

  let content;

  if (loading) {
    content = <LoadingScreen />;
  } else if (isPasswordRecovery) {
    content = <ResetPasswordScreen />;
  } else if (!session) {
    content = <AuthNavigator />;
  } else if (!profile) {
    content = <ProfileErrorScreen />;
  } else if (profile.status === 'pendente') {
    content = <PendingApprovalScreen />;
  } else if (profile.role === 'admin') {
    content = <AdminTabs />;
  } else if (profile.role === 'personal') {
    content = <PersonalTabs />;
  } else {
    content = <MainTabs />;
  }

  return <NavigationContainer>{content}</NavigationContainer>;
}