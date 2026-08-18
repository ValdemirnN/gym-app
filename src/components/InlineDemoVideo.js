import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, LayoutAnimation, Platform, UIManager, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme/theme';

// Altura máxima do player: 55% da altura da tela — vídeos muito altos ficam compactos
const { height: SCREEN_H } = Dimensions.get('window');
const MAX_VIDEO_HEIGHT = SCREEN_H * 0.55;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Limites pra não deixar o card gigante demais quando o vídeo é bem estreito/largo.
// 9/16 = bem vertical (reels/stories), 16/9 = bem horizontal.
const MIN_RATIO = 9 / 16;
const MAX_RATIO = 16 / 9;
const FALLBACK_RATIO = 4 / 3; // usado só enquanto o formato real ainda não chegou

/**
 * Player de vídeo embutido direto no card do exercício — nunca navega pra outra tela.
 * O espaço reservado se adapta ao formato real do vídeo: vertical vira um card alto,
 * horizontal vira um card largo, sem sobrar tarja preta nas laterais nem em cima/baixo.
 */
export default function InlineDemoVideo({ videoId }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratio, setRatio] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setVideoUrl(null);
    setRatio(null);
    (async () => {
      const { data } = await supabase.from('exercise_videos').select('storage_path').eq('id', videoId).single();
      if (alive && data) {
        const { data: pub } = supabase.storage.from('exercise-videos').getPublicUrl(data.storage_path);
        setVideoUrl(pub.publicUrl);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [videoId]);

  const player = useVideoPlayer(null);

  useEffect(() => {
    if (videoUrl && player) {
      player.replaceAsync(videoUrl);
    }
  }, [videoUrl, player]);

  // Descobre o formato real (largura x altura) assim que o player souber — usamos dois
  // eventos porque em alguns vídeos/plataformas um chega bem antes do outro. O primeiro
  // que trouxer um tamanho válido já ajusta o card.
  const applySize = (size) => {
    if (size?.width && size?.height) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const raw = size.width / size.height;
      setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw)));
    }
  };

  const { videoTrack } = useEvent(player, 'videoTrackChange', { videoTrack: player.videoTrack });
  useEffect(() => applySize(videoTrack?.size), [videoTrack]);

  const { availableVideoTracks } = useEvent(player, 'sourceLoad', {
    availableVideoTracks: player.availableVideoTracks || [],
  });
  useEffect(() => applySize(availableVideoTracks?.[0]?.size), [availableVideoTracks]);

  if (loading) {
    return (
      <View style={[styles.card, { aspectRatio: FALLBACK_RATIO, maxHeight: MAX_VIDEO_HEIGHT }, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!videoUrl) {
    return (
      <View style={[styles.card, { aspectRatio: FALLBACK_RATIO, maxHeight: MAX_VIDEO_HEIGHT }, styles.center]}>
        <Feather name="video-off" size={20} color={colors.textDim2} />
        <Text style={styles.emptyText}>Não consegui carregar esse vídeo.</Text>
      </View>
    );
  }

  return (
    // ✅ FIX: alignSelf + alignItems/justifyContent garantem centralização no contêiner pai.
    // overflow: 'hidden' + borderRadius no wrapper externo são suficientes para arredondar
    // as bordas do vídeo nativo, já que VideoView ignora borderRadius aplicado diretamente nele.
    <View style={[styles.card, { aspectRatio: ratio || FALLBACK_RATIO, maxHeight: MAX_VIDEO_HEIGHT }]}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls
        // "cover" garante que o vídeo preencha o card inteiro sem tarja preta —
        // quando conseguimos detectar o formato real (acima), o card já fica do
        // mesmo formato do vídeo, então "cover" não corta nada; se a detecção
        // falhar ou demorar, ainda assim não sobra fundo preto nas laterais.
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignSelf: 'center',           // ✅ FIX: centraliza o card no eixo horizontal
    borderRadius: radius.md,       // ✅ FIX: era 0, agora usa o raio do tema
    backgroundColor: '#0c0b09',
    overflow: 'hidden',            // ✅ mantido: essencial para o borderRadius funcionar no vídeo
    alignItems: 'center',          // ✅ FIX: centraliza conteúdo interno verticalmente
    justifyContent: 'center',      // ✅ FIX: centraliza conteúdo interno horizontalmente
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: colors.textDim2, fontSize: 12 },
});
