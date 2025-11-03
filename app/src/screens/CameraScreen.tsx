import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, Platform } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import { CameraScreenProps } from '../navigation/types';
import { ocrService } from '../services/ocrService';
import { ImageEditingGuide } from '../components/common';
import { processExtractedWordsWithFilter } from '../services/ocrFiltering';
import { useOCRFilterSettings } from '../hooks/useOCRFilterSettings';

export default function CameraScreen({ navigation }: CameraScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'authorized' | 'denied' | 'not-determined'>('not-determined');
  const [showEditingGuide, setShowEditingGuide] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { settings } = useOCRFilterSettings();

  useEffect(() => {
    // 상태바 숨기기 (전체화면)
    StatusBar.setHidden(true);

    return () => {
      // 컴포넌트 언마운트 시 상태바 복원
      StatusBar.setHidden(false);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      // Map VisionCamera permission to our state type
      const mappedStatus = status === 'granted' ? 'authorized' :
                           status === 'denied' ? 'denied' : 'not-determined';
      setCameraPermission(mappedStatus);
    })();
  }, []);

  // 카메라로 사진 촬영 (VisionCamera)
  const handleCapture = async () => {
    try {
      setIsScanning(true);
      if (cameraPermission !== 'authorized') {
        Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
        return;
      }
      if (!cameraRef.current) {
        Alert.alert('카메라 오류', '카메라 초기화 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: true,
      });

      const imageUri = Platform.select({
        ios: `file://${photo.path}`,
        android: photo.path,
        default: photo.path,
      }) as string;

      console.log('📷 카메라 사진 촬영 완료:', imageUri);

      // OCR 처리 후 즉시 결과 화면으로 이동 (확인 과정 생략)
      const ocrResult = await ocrService.processImage(imageUri);
      console.log('✅ OCR 스캔 완료:', ocrResult.statistics);

      // 필터링 적용 (hook에서 가져온 설정 사용)
      const { processedWords, excludedCount, excludedWords } =
        await processExtractedWordsWithFilter(
          ocrResult.ocrResult,
          (text: string) => ocrService.cleanWord(text),
          settings
        );

      // processedWords에서 실제 찾은 단어들만 필터링
      interface DetectedWordData {
        word: string;
        meaning: string;
        partOfSpeech: string;
        level: number;
      }
      let detectedWordsData: DetectedWordData[] = [];
      if (processedWords && processedWords.length > 0) {
        const foundWords = processedWords.filter(word => word.found && word.wordData);
        detectedWordsData = foundWords.map(word => ({
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
        excludedCount,  // 제외된 단어 수
        excludedWords,   // 제외된 단어 목록
        imageUri: imageUri
      });
    } catch (error) {
      console.error('❌ 카메라 촬영 또는 OCR 처리 오류:', error);
      Alert.alert('오류', '카메라 촬영 중 오류가 발생했습니다.');
    } finally {
      setIsScanning(false);
    }
  };

  // 갤러리에서 이미지 선택
  const handleGallery = async () => {
    try {
      setIsScanning(true);

      // 갤러리 권한 요청
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
        return;
      }

      // 이미지 선택 (개선된 편집 옵션으로 더 좋은 가시성 제공)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // 자유롭게 크롭 가능, 비율 고정 없음
        quality: 0.9, // 더 높은 품질로 졌명하게
        exif: false,
        selectionLimit: 1,
        // iOS에서 더 나은 편집 경험 제공
        presentationStyle: Platform.OS === 'ios'
          ? ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN
          : undefined,
        // Android에서 더 나은 UI 옵션
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

        // 필터링 적용 (hook에서 가져온 설정 사용)
        const { processedWords, excludedCount, excludedWords } =
          await processExtractedWordsWithFilter(
            ocrResult.ocrResult,
            (text: string) => ocrService.cleanWord(text),
            settings
          );

        // processedWords에서 실제 찾은 단어들만 필터링
        interface DetectedWordData {
          word: string;
          meaning: string;
          partOfSpeech: string;
          level: number;
        }
        let detectedWordsData: DetectedWordData[] = [];
        if (processedWords && processedWords.length > 0) {
          const foundWords = processedWords.filter(word => word.found && word.wordData);
          detectedWordsData = foundWords.map(word => ({
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
          excludedCount,  // 제외된 단어 수
          excludedWords,   // 제외된 단어 목록
          imageUri: imageUri
        });
      }
    } catch (error) {
      console.error('❌ 갤러리 선택 또는 OCR 처리 오류:', error);
      Alert.alert('오류', '이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsScanning(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    cameraPreview: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1F2937', // 폴백 색상
    },
    previewText: {
      color: 'white',
      fontSize: 18,
      textAlign: 'center',
      marginBottom: 16,
    },
    previewSubtext: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: 14,
      textAlign: 'center',
    },
    instructionOverlay: {
      position: 'absolute',
      top: 60,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    instructionText: {
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      overflow: 'hidden',
    },
    focusGuide: {
      position: 'absolute',
      width: 280,
      height: 180,
      borderWidth: 3,
      borderColor: 'rgba(79, 70, 229, 0.8)', // 인디고 색상
      borderRadius: 16,
      backgroundColor: 'rgba(79, 70, 229, 0.1)',
    },
    focusCorners: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    corner: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderColor: '#FFFFFF',
      borderWidth: 3,
    },
    cornerTopLeft: {
      top: -12,
      left: -12,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderTopLeftRadius: 8,
    },
    cornerTopRight: {
      top: -12,
      right: -12,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
      borderTopRightRadius: 8,
    },
    cornerBottomLeft: {
      bottom: -12,
      left: -12,
      borderRightWidth: 0,
      borderTopWidth: 0,
      borderBottomLeftRadius: 8,
    },
    cornerBottomRight: {
      bottom: -12,
      right: -12,
      borderLeftWidth: 0,
      borderTopWidth: 0,
      borderBottomRightRadius: 8,
    },
    cameraControls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 140,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 40,
      paddingVertical: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
    },
    controlButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    controlButtonActive: {
      backgroundColor: 'rgba(79, 70, 229, 0.8)',
      borderColor: '#4F46E5',
      transform: [{ scale: 0.95 }],
    },
    controlIcon: {
      width: 24,
      height: 24,
      tintColor: 'white',
    },
    captureButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#FFFFFF',
      borderWidth: 6,
      borderColor: 'rgba(255, 255, 255, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
    captureButtonActive: {
      transform: [{ scale: 0.9 }],
      backgroundColor: '#F3F4F6',
    },
    captureInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#4F46E5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    captureIcon: {
      width: 28,
      height: 28,
      tintColor: 'white',
    },
    controlButtonDisabled: {
      opacity: 0.4,
      transform: [{ scale: 0.9 }],
    },
    captureButtonDisabled: {
      opacity: 0.6,
      transform: [{ scale: 0.95 }],
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      paddingHorizontal: 32,
      paddingVertical: 24,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    loadingSpinner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 4,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderTopColor: '#4F46E5',
    },
    loadingText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginTop: 16,
      textAlign: 'center',
    },
    loadingSubtext: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
    },
    helpButton: {
      position: 'absolute',
      top: 60,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(79, 70, 229, 0.9)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#4F46E5',
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

  return (
    <View style={styles.container}>
      {/* Camera Preview */}
      <View style={styles.cameraPreview}>
        {cameraPermission === 'authorized' && device ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!isScanning}
            ref={cameraRef}
            photo={true}
          />
        ) : (
          <>
            <Text style={styles.previewText}>📷 카메라 초기화 중...</Text>
            <Text style={styles.previewSubtext}>권한을 허용했는지 확인해주세요.</Text>
          </>
        )}

        {/* Instruction Overlay */}
        <View style={styles.instructionOverlay}>
          <Text style={styles.instructionText}>
            📝 영어 단어가 있는 영역을 프레임 안에 맞춰주세요
          </Text>
        </View>

        {/* 편집 도움말 버튼 */}
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => setShowEditingGuide(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.helpButtonText}>?</Text>
        </TouchableOpacity>

        {/* Focus Guide */}
        <View style={styles.focusGuide}>
          <View style={styles.focusCorners}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </View>
      </View>

      {/* Camera Controls */}
      <View style={styles.cameraControls}>
        {/* Close Button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            isScanning && styles.controlButtonDisabled
          ]}
          onPress={() => navigation.goBack()}
          disabled={isScanning}
          activeOpacity={0.7}
        >
          <Text style={{ color: 'white', fontSize: 20, fontWeight: '600' }}>✕</Text>
        </TouchableOpacity>

        {/* Capture Button */}
        <TouchableOpacity
          style={[
            styles.captureButton,
            isScanning && styles.captureButtonDisabled
          ]}
          onPress={handleCapture}
          disabled={isScanning}
          activeOpacity={0.8}
        >
          <View style={styles.captureInner}>
            <Text style={{ color: 'white', fontSize: 24 }}>📸</Text>
          </View>
        </TouchableOpacity>

        {/* Gallery Button */}
        <TouchableOpacity
          style={[
            styles.controlButton,
            isScanning && styles.controlButtonDisabled
          ]}
          onPress={handleGallery}
          disabled={isScanning}
          activeOpacity={0.7}
        >
          <Text style={{ color: 'white', fontSize: 20 }}>🖼️</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {isScanning && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <View style={styles.loadingSpinner} />
            <Text style={styles.loadingText}>스마트 스캔 중...</Text>
            <Text style={styles.loadingSubtext}>단어를 인식하고 의미를 찾는 중입니다</Text>
          </View>
        </View>
      )}

      {/* 이미지 편집 가이드 모달 */}
      <ImageEditingGuide
        visible={showEditingGuide}
        onClose={() => setShowEditingGuide(false)}
      />
    </View>
  );
}