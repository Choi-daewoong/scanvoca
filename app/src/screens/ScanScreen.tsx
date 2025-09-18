import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScanScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';

export default function ScanScreen({ navigation }: ScanScreenProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.lg,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xl,
      textAlign: 'center',
    },
    button: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    buttonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.background.primary,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.text.primary,
    },
  });

  const handleCameraPress = () => {
    // CameraScreen으로 이동
    navigation.getParent()?.navigate('Camera');
  };

  const handleGalleryPress = () => {
    // CameraScreen으로 이동하여 갤러리 기능 사용
    navigation.getParent()?.navigate('Camera');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📷</Text>
      <Text style={styles.title}>단어 스캔</Text>
      <Text style={styles.subtitle}>
        책, 문서, 화면의 영어 단어를 스캔하여{'\n'}
        자동으로 인식하고 단어장에 저장하세요.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleCameraPress}>
        <Text style={styles.buttonText}>📸 카메라로 스캔하기</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={handleGalleryPress}>
        <Text style={styles.secondaryButtonText}>🖼️ 갤러리에서 선택</Text>
      </TouchableOpacity>
    </View>
  );
}