import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, Platform } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import { CameraScreenProps } from '../navigation/types';
import { ocrService } from '../services/ocrService';

export default function CameraScreen({ navigation }: CameraScreenProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'authorized' | 'denied' | 'not-determined'>('not-determined');
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');

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
      setCameraPermission(status);
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
        qualityPrioritization: 'quality',
      });

      const imageUri = Platform.select({
        ios: `file://${photo.path}`,
        android: photo.path,
        default: photo.path,
      }) as string;

      console.log('📷 카메라 사진 촬영 완료:', imageUri);

      // OCR 처리 (기본 처리 방식 사용)
      const ocrResult = await ocrService.processImage(imageUri);
      console.log('✅ OCR 스캔 완료:', ocrResult.statistics);

      // processedWords 또는 validWords에서 wordData 추출
      let detectedWordsData = [];

      console.log('🔍 ocrResult 구조 확인:', {
        hasProcessedWords: !!ocrResult.processedWords,
        processedWordsLength: ocrResult.processedWords?.length || 0,
        processedWords: ocrResult.processedWords
      });

      if (ocrResult.processedWords && ocrResult.processedWords.length > 0) {
        console.log('📋 모든 processedWords:', ocrResult.processedWords);

        // processedWords에서 실제 찾은 단어들만 필터링
        const foundWords = ocrResult.processedWords.filter(word => word.found && word.wordData);
        console.log('✅ 찾은 단어들:', foundWords);

        detectedWordsData = foundWords.map(word => ({
          word: word.cleaned,
          meaning: word.wordData!.meanings?.[0]?.korean || '의미 없음',
          partOfSpeech: word.wordData!.meanings?.[0]?.partOfSpeech || 'noun',
          level: word.wordData!.difficulty || 4
        }));

        console.log('📤 카메라에서 전달하는 데이터:', detectedWordsData);
      } else {
        console.log('⚠️ processedWords가 없거나 비어있습니다');
        detectedWordsData = [];
      }

      // ScanResults로 이동
      navigation.navigate('ScanResults', {
        scannedText: ocrResult.ocrResult.text,
        detectedWords: detectedWordsData, // 의미 포함된 객체 배열로 전달
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

      // 이미지 선택
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false,
        selectionLimit: 1,
        presentationStyle: Platform.OS === 'ios' ? ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN : undefined,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('📷 갤러리 이미지 선택 완료:', imageUri);

        // OCR 처리 (기본 처리 방식 사용)
        const ocrResult = await ocrService.processImage(imageUri);
        console.log('✅ OCR 스캔 완료:', ocrResult.statistics);

        // processedWords 또는 validWords에서 wordData 추출
        let detectedWordsData = [];

        console.log('🔍 갤러리 ocrResult 구조 확인:', {
          hasProcessedWords: !!ocrResult.processedWords,
          processedWordsLength: ocrResult.processedWords?.length || 0,
          processedWords: ocrResult.processedWords
        });

        if (ocrResult.processedWords && ocrResult.processedWords.length > 0) {
          console.log('📋 갤러리 모든 processedWords:', ocrResult.processedWords);

          // processedWords에서 실제 찾은 단어들만 필터링
          const foundWords = ocrResult.processedWords.filter(word => word.found && word.wordData);
          console.log('✅ 갤러리 찾은 단어들:', foundWords);

          detectedWordsData = foundWords.map(word => ({
            word: word.cleaned,
            meaning: word.wordData.meanings?.[0]?.korean_meaning || '의미 없음',
            partOfSpeech: word.wordData.meanings?.[0]?.part_of_speech || 'n',
            level: word.wordData.difficulty_level || 4
          }));

          console.log('📤 갤러리에서 전달하는 데이터:', detectedWordsData);
        } else {
          console.log('⚠️ 갤러리 processedWords가 없거나 비어있습니다');
          detectedWordsData = [];
        }

        // ScanResults로 이동
        navigation.navigate('ScanResults', {
          scannedText: ocrResult.ocrResult.text,
          detectedWords: detectedWordsData, // 의미 포함된 객체 배열로 전달
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
      top: 50,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    focusGuide: {
      position: 'absolute',
      width: 250,
      height: 150,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.5)',
      borderStyle: 'dashed',
      borderRadius: 8,
    },
    focusGuideBorder: {
      position: 'absolute',
      top: -8,
      left: -8,
      right: -8,
      bottom: -8,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: 12,
    },
    cameraControls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 120,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 30,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    closeBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderWidth: 2,
      borderColor: 'white',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      color: 'white',
      fontSize: 20,
      fontWeight: 'bold',
    },
    captureBtn: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'white',
      borderWidth: 4,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    captureBtnText: {
      color: '#4F46E5',
      fontSize: 28,
    },
    captureBtnDisabled: {
      opacity: 0.5,
    },
    placeholder: {
      width: 50,
      height: 50,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    loadingText: {
      color: 'white',
      fontSize: 16,
      marginTop: 16,
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

        {/* Focus Guide */}
        <View style={styles.focusGuide}>
          <View style={styles.focusGuideBorder} />
        </View>
      </View>

      {/* Camera Controls */}
      <View style={styles.cameraControls}>
        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => navigation.goBack()}
          disabled={isScanning}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>

        {/* Capture Button */}
        <TouchableOpacity
          style={[styles.captureBtn, isScanning && styles.captureBtnDisabled]}
          onPress={handleCapture}
          disabled={isScanning}
          delayPressIn={0}
          delayPressOut={0}
        >
          <Text style={styles.captureBtnText}>📸</Text>
        </TouchableOpacity>

        {/* Gallery Button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleGallery}
          disabled={isScanning}
        >
          <Text style={styles.closeBtnText}>🖼️</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Overlay */}
      {isScanning && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>이미지 처리 중...</Text>
        </View>
      )}
    </View>
  );
}