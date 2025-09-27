import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ScanScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { ocrService } from '../services/ocrService';

export default function ScanScreen({ navigation }: ScanScreenProps) {
  const { theme } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

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
    buttonDisabled: {
      opacity: 0.6,
    },
  });

  // 카메라로 직접 사진 촬영
  const handleCameraPress = async () => {
    try {
      setIsProcessing(true);

      // 카메라 권한 요청
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
        return;
      }

      // 카메라로 사진 촬영
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        // 더 나은 편집 경험을 위한 설정
        selectionLimit: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('📷 카메라 사진 촬영 완료:', imageUri);

        // OCR 처리
        const ocrResult = await ocrService.processImage(imageUri);
        console.log('✅ OCR 스캔 완료:', ocrResult.statistics);

        // 의미 포함된 단어 객체 배열 생성
        let detectedWordsData = [];

        if (ocrResult.processedWords && ocrResult.processedWords.length > 0) {
          detectedWordsData = ocrResult.processedWords
            .filter(word => word.found && word.wordData)
            .map(word => ({
              word: word.cleaned,
              meaning: word.wordData!.meanings?.[0]?.korean || '의미 없음',
              partOfSpeech: word.wordData!.meanings?.[0]?.partOfSpeech || 'noun',
              level: word.wordData!.difficulty || 4
            }));
        }

        console.log('📤 ScanScreen에서 전달하는 데이터:', detectedWordsData);

        // ScanResults로 이동
        navigation.navigate('ScanResults', {
          scannedText: ocrResult.ocrResult.text,
          detectedWords: detectedWordsData,
          imageUri: imageUri
        });
      }
    } catch (error) {
      console.error('❌ 카메라 촬영 또는 OCR 처리 오류:', error);
      Alert.alert('오류', '카메라 촬영 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 갤러리에서 직접 이미지 선택
  const handleGalleryPress = async () => {
    try {
      setIsProcessing(true);

      // 갤러리 권한 요청
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
        return;
      }

      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        // 더 나은 편집 경험을 위한 설정
        selectionLimit: 1,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('📷 갤러리 이미지 선택 완료:', imageUri);

        // OCR 처리
        const ocrResult = await ocrService.processImage(imageUri);
        console.log('✅ OCR 스캔 완료:', ocrResult.statistics);

        // 의미 포함된 단어 객체 배열 생성
        let detectedWordsData = [];

        if (ocrResult.processedWords && ocrResult.processedWords.length > 0) {
          detectedWordsData = ocrResult.processedWords
            .filter(word => word.found && word.wordData)
            .map(word => ({
              word: word.cleaned,
              meaning: word.wordData!.meanings?.[0]?.korean || '의미 없음',
              partOfSpeech: word.wordData!.meanings?.[0]?.partOfSpeech || 'noun',
              level: word.wordData!.difficulty || 4
            }));
        }

        console.log('📤 ScanScreen에서 전달하는 데이터:', detectedWordsData);

        // ScanResults로 이동
        navigation.navigate('ScanResults', {
          scannedText: ocrResult.ocrResult.text,
          detectedWords: detectedWordsData,
          imageUri: imageUri
        });
      }
    } catch (error) {
      console.error('❌ 갤러리 선택 또는 OCR 처리 오류:', error);
      Alert.alert('오류', '이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📷</Text>
      <Text style={styles.title}>단어 스캔</Text>
      <Text style={styles.subtitle}>
        책, 문서, 화면의 영어 단어를 스캔하여{'\n'}
        자동으로 인식하고 단어장에 저장하세요.
      </Text>

      <TouchableOpacity
        style={[styles.button, isProcessing && styles.buttonDisabled]}
        onPress={handleCameraPress}
        disabled={isProcessing}
      >
        <Text style={styles.buttonText}>
          {isProcessing ? '📸 처리 중...' : '📸 카메라로 스캔하기'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
        onPress={handleGalleryPress}
        disabled={isProcessing}
      >
        <Text style={styles.secondaryButtonText}>
          {isProcessing ? '🖼️ 처리 중...' : '🖼️ 갤러리에서 선택'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}