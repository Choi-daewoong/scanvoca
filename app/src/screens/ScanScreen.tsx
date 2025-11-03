import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ScanScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { ocrService } from '../services/ocrService';
import { ImageEditingGuide } from '../components/common';

interface DetectedWordData {
  word: string;
  meaning: string;
  partOfSpeech: string;
  level: number;
}

export default function ScanScreen({ navigation }: ScanScreenProps) {
  const { theme } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEditingGuide, setShowEditingGuide] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    heroSection: {
      alignItems: 'center',
      marginBottom: theme.spacing.xxl,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.lg,
      shadowColor: theme.colors.primary.main,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    iconText: {
      fontSize: 48,
      color: 'white',
    },
    title: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
      fontWeight: '700',
    },
    subtitle: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xl,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: theme.spacing.md,
    },
    buttonsContainer: {
      width: '100%',
      gap: theme.spacing.md,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: 18,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary.main,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
      gap: theme.spacing.sm,
    },
    primaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.primary.contrast,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      borderWidth: 2,
      borderColor: theme.colors.border.medium,
      backgroundColor: theme.colors.background.secondary,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: 18,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    secondaryButtonText: {
      ...theme.typography.button,
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonIcon: {
      fontSize: 20,
    },
    buttonDisabled: {
      opacity: 0.6,
      transform: [{ scale: 0.98 }],
    },
    helpButton: {
      position: 'absolute',
      top: 50,
      right: theme.spacing.lg,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(79, 70, 229, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary.main,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    helpButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
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

      // 카메라로 사진 촬영 (개선된 편집 옵션으로 더 좋은 가시성 제공)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // 자유롭게 크롭 가능 (위/아래, 좌/우 독립적 조정)
        quality: 0.9, // 더 높은 품질로 졌명하게
        selectionLimit: 1,
        // iOS에서 더 나은 편집 경험 제공
        presentationStyle: Platform.OS === 'ios'
          ? ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN
          : undefined,
        videoMaxDuration: 30,
        // Android 전용 옵션들
        ...(Platform.OS === 'android' && {
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: false,
        }),
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('📷 카메라 사진 촬영 완료:', imageUri);

        // OCR 처리 후 즉시 결과 화면으로 이동 (확인 과정 생략)
        const ocrResult = await ocrService.processImage(imageUri);
        console.log('✅ OCR 스캔 완료:', ocrResult.statistics);

        // processedWords에서 실제 찾은 단어들만 필터링
        let detectedWordsData: DetectedWordData[] = [];
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

        // 확인 과정 없이 바로 결과 화면으로 이동
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

      // 이미지 선택 (개선된 편집 옵션으로 더 좋은 가시성 제공)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // 자유롭게 크롭 가능 (위/아래, 좌/우 독립적 조정)
        quality: 0.9, // 더 높은 품질로 졌명하게
        selectionLimit: 1,
        // iOS에서 더 나은 편집 경험 제공
        presentationStyle: Platform.OS === 'ios'
          ? ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN
          : undefined,
        // Android 전용 옵션들
        ...(Platform.OS === 'android' && {
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: false,
        }),
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('📷 갤러리 이미지 선택 완료:', imageUri);

        // OCR 처리 후 즉시 결과 화면으로 이동 (확인 과정 생략)
        const ocrResult = await ocrService.processImage(imageUri);
        console.log('✅ OCR 스캔 완료:', ocrResult.statistics);

        // processedWords에서 실제 찾은 단어들만 필터링
        let detectedWordsData: DetectedWordData[] = [];
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

        // 확인 과정 없이 바로 결과 화면으로 이동
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
      <View style={styles.heroSection}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>📷</Text>
        </View>

        <Text style={styles.title}>스마트 단어 스캔</Text>
        <Text style={styles.subtitle}>
          AI가 영어 단어를 자동 인식하고{'\n'}
          자연스러운 한국어 번역을 제공합니다
        </Text>

        {/* 편집 도움말 버튼 */}
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => setShowEditingGuide(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.helpButtonText}>?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleCameraPress}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonIcon}>
            {isProcessing ? '⏳' : '📷'}
          </Text>
          <Text style={styles.primaryButtonText}>
            {isProcessing ? '스마트 스캔 중...' : '카메라로 스캔하기'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleGalleryPress}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonIcon}>
            {isProcessing ? '⏳' : '🖼️'}
          </Text>
          <Text style={styles.secondaryButtonText}>
            {isProcessing ? '이미지 처리 중...' : '갤러리에서 선택'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 이미지 편집 가이드 모달 */}
      <ImageEditingGuide
        visible={showEditingGuide}
        onClose={() => setShowEditingGuide(false)}
      />
    </View>
  );
}