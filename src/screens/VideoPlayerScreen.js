import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

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
        <VideoView style={styles.video} player={player} allowsFullscreen allowsPictureInPicture />
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
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginLeft: -4 },
  back: { color: colors.text, fontSize: 15, marginLeft: 2 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: radius.md },
  emptyBox: { alignItems: 'center', gap: 10, marginTop: 40 },
  empty: { color: colors.textDim, textAlign: 'center' },
});
