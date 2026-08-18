import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ─── Bloquear fontScale do sistema ───────────────────────────────────────────
// Impede que a configuração "Tamanho de fonte" do celular afete o app.
// O app tem seu próprio sistema de responsividade (responsive.js).
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.allowFontScaling = false;

if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.allowFontScaling = false;
// ─────────────────────────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { startSyncManager, stopSyncManager } from './src/lib/syncManager';
import { registerForPushNotifications } from './src/lib/pushNotifications';

function PushRegistrar() {
  const { session } = useAuth();
  useEffect(() => {
    if (session?.user?.id) {
      // O try/catch já está dentro de registerForPushNotifications,
      // mas adicionamos aqui também por segurança
      registerForPushNotifications(session.user.id).catch((e) =>
        console.warn('PushRegistrar error (non-fatal):', e?.message)
      );
    }
  }, [session?.user?.id]);
  return null;
}

export default function App() {
  useEffect(() => {
    startSyncManager();
    return () => stopSyncManager();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <PushRegistrar />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
