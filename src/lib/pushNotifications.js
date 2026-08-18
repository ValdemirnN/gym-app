import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Detecta Expo Go (SDK 53+ removeu push do Expo Go)
function isRunningInExpoGo() {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient' ||
    Constants.executionEnvironment === 'expo'
  );
}

export async function registerForPushNotifications(userId) {
  try {
    // Expo Go SDK 53+ não suporta push — sai antes de importar o módulo
    if (isRunningInExpoGo()) return null;

    // Importa dinamicamente para evitar que o módulo inicialize no Expo Go
    // (o erro nas imagens vem da inicialização do módulo, não da chamada)
    const Device = await import('expo-device');
    if (!Device.default.isDevice) return null;

    const Notifications = await import('expo-notifications');

    Notifications.default.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const { status: existingStatus } =
      await Notifications.default.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.default.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.default.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('Push: projectId não encontrado no app.json');
      return null;
    }

    const tokenData = await Notifications.default.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenData?.data;

    if (userId && token) {
      await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('id', userId);
    }

    return token;
  } catch (error) {
    // Nunca deixa o push derrubar o app
    console.warn(
      'Push notification registration failed (non-fatal):',
      error?.message
    );
    return null;
  }
}
