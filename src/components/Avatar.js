import React, { useState } from 'react';
import { View, Image, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';

const DEFAULT_AVATAR = require('../../assets/default-avatar.png');

// Foto de perfil redonda. Se `uri` não vier (usuário não colocou foto),
// cai pro ícone padrão. Ao tocar, abre em tela cheia.
export default function Avatar({ uri, size = 48 }) {
  const [expanded, setExpanded] = useState(false);
  const source = uri ? { uri } : DEFAULT_AVATAR;

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded(true)}>
        <Image
          source={source}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      </TouchableOpacity>

      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <Pressable style={styles.overlay} onPress={() => setExpanded(false)}>
          <Image source={source} style={styles.fullImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: '#374151' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: { width: '100%', height: '80%' },
});
