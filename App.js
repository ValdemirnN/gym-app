import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { startSyncManager, stopSyncManager } from './src/lib/syncManager';
import { registerForPushNotifications } from './src/lib/pushNotifications';

function PushRegistrar() {
  const { session } = useAuth();
  useEffect(() => {
    if (session?.user?.id) {
      registerForPushNotifications(session.user.id);
    }
  }, [session?.user?.id]);
  return null;
}

export default function App() {
  useEffect(() => {
    // Fica de olho na conexão e manda pro Supabase, em segundo plano,
    // tudo que ficou pendente enquanto o app estava offline.
    startSyncManager();
    return () => stopSyncManager();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <PushRegistrar />
      <AppNavigator />
    </AuthProvider>
  );
}
