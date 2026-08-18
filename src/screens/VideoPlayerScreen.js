import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';
import { s, vs, ms, fs, isSmallDevice, screenPaddingH, screenPaddingTop } from '../utils/responsive';

export default function VideoPlayerScreen({ route, navigation }) {
  const { videoId, title } = route.params;
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('exercise_videos').select('storage_path').eq('id', videoId).single();
      if (data) {
        const { data: pub } = supabase.storage.from('exercise-videos').getPublicUrl(data.storage_path);
        setVideoUrl(pub.publicUrl);
      }
      setLoading(false);
    };
    load();
  }, [videoId]);

  const player = useVideoPlayer(null);

  useEffect(() => {
    if (videoUrl && player) {
      player.replaceAsync(videoUrl).then(() => player.play());
    }
  }, [videoUrl, player]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <Feather name="chevron-left" size={20} color={colors.text} />
        <Text style={styles.back}>Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : videoUrl ? (
        // ✅ FIX: VideoView ignora borderRadius aplicado diretamente nele (componente nativo).
        // A solução correta é envolvê-lo em um View com borderRadius + overflow: 'hidden'.
        // alignSelf: 'center' garante a centralização no contêiner pai.
        <View style={styles.videoWrapper}>
          <VideoView
            style={styles.video}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
          />
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Feather name="video-off" size={22} color={colors.textDim2} />
          <Text style={styles.empty}>Não consegui carregar esse vídeo.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: screenPaddingTop },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: vs(16), marginLeft: -4 },
  back: { color: colors.text, fontSize: fs(13), marginLeft: 2 },
  title: { fontSize: fs(18), fontWeight: '800', color: colors.text, marginBottom: vs(16) },

  // ✅ FIX: wrapper com borderRadius + overflow: 'hidden' para arredondar as bordas do vídeo.
  // alignSelf: 'center' centraliza o bloco horizontalmente no contêiner pai.
  videoWrapper: {
    width: '100%',
    alignSelf: 'center',        // ✅ centraliza horizontalmente
    borderRadius: radius.md,    // ✅ arredondamento aplicado no wrapper, não no VideoView
    overflow: 'hidden',         // ✅ força o vídeo a respeitar o borderRadius do wrapper
    backgroundColor: '#000',
  },

  // O VideoView ocupa 100% do wrapper — as bordas arredondadas vêm do pai
  video: {
    width: '100%',
    aspectRatio: 16 / 9,        // mantém a proporção
  },

  emptyBox: { alignItems: 'center', gap: 10, marginTop: vs(40) },
  empty: { color: colors.textDim, textAlign: 'center' },
});
