import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

// fetch(uri).blob() corrompe/trunca vídeos locais no React Native/Expo.
// Lemos os bytes reais do arquivo com a API nova do expo-file-system.
const VIDEO_MIME_TYPES = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
};

function getVideoContentType(uri) {
  const ext = (uri.split('.').pop() || 'mp4').split('?')[0].toLowerCase();
  return VIDEO_MIME_TYPES[ext] || 'video/mp4';
}

export default function UploadVideoScreen({ navigation, route }) {
  const { session } = useAuth();
  const { exerciseId, exerciseName } = route?.params || {};
  const [name, setName] = useState(exerciseName || '');
  const [videoUri, setVideoUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [videos, setVideos] = useState([]);
  const [replacingId, setReplacingId] = useState(null);

  const loadVideos = useCallback(async () => {
    const { data, error } = await supabase
      .from('exercise_videos')
      .select('id, name, storage_path')
      .eq('owner_id', session.user.id)
      .order('name');
    if (!error) setVideos(data || []);
  }, [session.user.id]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleDelete = (video) => {
    Alert.alert('Apagar vídeo', `Remover "${video.name}"? Isso vai tirar o vídeo de qualquer treino que o use.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          const { error: storageError } = await supabase.storage.from('exercise-videos').remove([video.storage_path]);
          if (storageError) {
            Alert.alert('Erro ao apagar arquivo', storageError.message);
            return;
          }
          const { error: dbError } = await supabase.from('exercise_videos').delete().eq('id', video.id);
          if (dbError) {
            Alert.alert('Erro ao apagar registro', dbError.message);
            return;
          }
          loadVideos();
        },
      },
    ]);
  };

  const handleReplace = async (video) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso aos seus vídeos para continuar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;

    setReplacingId(video.id);
    try {
      const uri = result.assets[0].uri;
      const contentType = getVideoContentType(uri);
      await uploadWithFetch(video.storage_path, uri, contentType, true);
      Alert.alert('Pronto!', 'Vídeo substituído com sucesso.');
    } catch (e) {
      Alert.alert('Erro ao substituir vídeo', e.message);
    } finally {
      setReplacingId(null);
    }
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso aos seus vídeos para continuar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const uploadWithFetch = async (storagePath, uri, contentType, upsert = false) => {
    const {
      data: { session: authSession },
    } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    const supabaseUrl = supabase.supabaseUrl || supabase.storageUrl?.replace('/storage/v1', '');

    const url = `${supabaseUrl}/storage/v1/object/exercise-videos/${storagePath}`;
    const method = upsert ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'x-upsert': upsert ? 'true' : 'false',
      },
      body: { uri },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Upload falhou com status ${response.status}`);
    }
    return await response.json();
  };

  const handleUpload = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Dê um nome pro vídeo (ex: Supino reto).');
      return;
    }
    if (!videoUri) {
      Alert.alert('Atenção', 'Escolha um vídeo da galeria.');
      return;
    }
    setUploading(true);
    try {
      const contentType = getVideoContentType(videoUri);
      const ext = (videoUri.split('.').pop() || 'mp4').split('?')[0];
      const path = `${session.user.id}/${Date.now()}.${ext}`;

      await uploadWithFetch(path, videoUri, contentType, false);

      const { data: inserted, error: insertError } = await supabase
        .from('exercise_videos')
        .insert({ name: name.trim(), storage_path: path, owner_id: session.user.id })
        .select()
        .single();

      if (insertError) throw insertError;

      if (exerciseId) {
        const { error: attachError } = await supabase
          .from('exercises')
          .update({ video_id: inserted.id })
          .eq('id', exerciseId);
        if (attachError) throw attachError;

        Alert.alert('Pronto!', `Vídeo enviado e já vinculado a "${exerciseName}".`);
        navigation.goBack();
        return;
      }

      Alert.alert('Pronto!', 'Vídeo enviado com sucesso. Já pode buscar por ele ao montar um treino.');
      setName('');
      setVideoUri(null);
      loadVideos();
    } catch (e) {
      Alert.alert('Erro ao enviar vídeo', e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{exerciseName ? `Enviar vídeo - ${exerciseName}` : 'Enviar vídeo'}</Text>
      <Text style={styles.subtitle}>
        {exerciseId
          ? `Ao enviar, esse vídeo já fica vinculado automaticamente ao exercício "${exerciseName}".`
          : 'Esse vídeo fica salvo dentro do app e pode ser usado em qualquer exercício, depois é só buscar pelo nome.'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Nome do vídeo (ex: Supino reto)"
        placeholderTextColor={colors.textDim2}
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity style={styles.pickButton} onPress={pickVideo}>
        <Feather name={videoUri ? 'check-circle' : 'film'} size={16} color={videoUri ? colors.accent : colors.text} />
        <Text style={[styles.pickButtonText, videoUri && { color: colors.accent }]}>
          {videoUri ? 'Vídeo selecionado' : 'Escolher vídeo da galeria'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleUpload} disabled={uploading} activeOpacity={0.85}>
        {uploading ? <ActivityIndicator color="#04170F" /> : <Text style={styles.saveButtonText}>Enviar</Text>}
      </TouchableOpacity>

      <Text style={styles.listTitle}>Meus vídeos</Text>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>Nenhum vídeo enviado ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.videoRow}>
            <View style={styles.videoIcon}>
              <Feather name="film" size={15} color={colors.accent} />
            </View>
            <Text style={styles.videoName} numberOfLines={1}>{item.name}</Text>
            {replacingId === item.id ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View style={styles.videoActions}>
                <TouchableOpacity onPress={() => handleReplace(item)}>
                  <Text style={styles.replaceText}>Substituir</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteText}>Apagar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(12), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(20), fontWeight: '800', color: colors.text, marginBottom: vs(6) },
  subtitle: { color: colors.textDim, fontSize: fs(11), marginBottom: vs(20), lineHeight: 18 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: vs(16),
    fontSize: fs(14),
  },
  pickButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(16),
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickButtonText: { color: colors.text, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: 16, alignItems: 'center' },
  saveButtonText: { color: '#04170F', fontWeight: '700', fontSize: fs(14) },
  listTitle: { color: colors.text, fontSize: fs(14), fontWeight: '700', marginTop: vs(28), marginBottom: vs(10) },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: vs(20), fontSize: fs(12) },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: vs(10),
  },
  videoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoName: { color: colors.text, fontSize: fs(12), flex: 1 },
  videoActions: { flexDirection: 'row', gap: 16 },
  replaceText: { color: colors.accent, fontWeight: '600', marginRight: 16, fontSize: fs(11) },
  deleteText: { color: colors.red, fontWeight: '600', fontSize: fs(11) },
});
