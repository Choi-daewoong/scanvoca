import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, ActivityIndicator, Platform } from 'react-native';
import { CameraScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { databaseService } from '../database/database';
import { ocrService } from '../services/ocrService';

export default function CameraScreen({ navigation }: CameraScreenProps) {
  const { theme } = useTheme();
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [detectedWords, setDetectedWords] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 웹 환경에서는 카메라 기능을 비활성화하고 mock 데이터 사용
  const isWeb = Platform.OS === 'web';

  // 웹 환경용 mock 스캔 함수
  const handleMockScan = async () => {
    try {
      setIsScanning(true);
      setScanProgress(0);
      setDetectedWords([]);

      console.log('🌐 웹 환경 Mock 스캔 시작...');

      // UI 진행률 시뮬레이션
      await simulateOCRProgress();

      // Mock OCR 결과 생성
      const mockWords = ['hello', 'world', 'react', 'native', 'expo', 'typescript', 'javascript', 'mobile'];
      const result = {
        ocrResult: {
          text: 'Hello world! This is a mock scan result for web testing.',
          confidence: 0.95
        },
        validWords: mockWords.map(word => ({
          original: word,
          cleaned: word,
          confidence: 0.9
        })),
        statistics: {
          totalWords: mockWords.length,
          validWords: mockWords.length,
          averageConfidence: 0.9
        }
      };

      console.log('✅ 웹 Mock 스캔 완료:', result.statistics);

      // 감지된 단어들 UI에 표시
      const detectedWordTexts = result.validWords.map(word => word.cleaned);
      setDetectedWords(detectedWordTexts);

      // 잠깐 결과 표시
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ScanResults로 이동하면서 OCR 결과 전달
      navigation.navigate('ScanResults', {
        scannedText: result.ocrResult.text,
        detectedWords: detectedWordTexts,
        imageUri: 'mock://web-scan-image.jpg'
      });

    } catch (error) {
      console.error('❌ 웹 Mock 스캔 오류:', error);
      Alert.alert('스캔 오류', 'Mock 스캔 중 오류가 발생했습니다.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
      setDetectedWords([]);
    }
  };

  // 애니메이션 효과
  useEffect(() => {
    const blinkAnimation = () => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => blinkAnimation());
    };

    blinkAnimation();

    // 스캔 버튼 펄스 효과
    const pulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => !isScanning && pulseAnimation());
    };

    pulseAnimation();
  }, [isScanning]);

  const simulateOCRProgress = async () => {
    // OCR 진행 시뮬레이션
    const progressSteps = [0, 25, 50, 75, 100];

    for (let i = 0; i < progressSteps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 400));
      setScanProgress(progressSteps[i]);

      if (i === 2) {
        // 50% 진행시 일부 단어 감지
        setDetectedWords(['education', 'learning']);
      } else if (i === 4) {
        // 100% 완료시 전체 단어 감지
        setDetectedWords(['education', 'learning', 'vocabulary', 'essential', 'knowledge']);
      }
    }
  };

  const handleScanPress = async () => {
    setIsScanning(true);
    setScanProgress(0);
    setDetectedWords([]);

    try {
      console.log('📷 카메라 스캔 시작...');

      // 1. 진행률 시뮬레이션 (UI 반응성을 위해)
      await simulateOCRProgress();

      // 2. 실제 OCR 처리 (시뮬레이션 이미지 URI 사용)
      const imageUri = `mock://camera-capture-${Date.now()}.jpg`;
      console.log('🔍 OCR 처리 시작:', imageUri);

      // OCR 서비스를 통한 완전 처리
      const result = await ocrService.processImageComplete(imageUri);

      console.log('✅ OCR 처리 완료:', {
        totalDetected: result.statistics.totalDetected,
        validFound: result.statistics.validFound,
        confidence: result.statistics.confidence
      });

      // 감지된 단어들 UI에 표시
      const detectedWordTexts = result.validWords.map(word => word.cleaned);
      setDetectedWords(detectedWordTexts);

      // 잠깐 결과 표시
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ScanResults로 이동하면서 OCR 결과 전달
      navigation.navigate('ScanResults', {
        scannedText: result.ocrResult.text,
        detectedWords: detectedWordTexts,
        imageUri: imageUri
      });

    } catch (error) {
      console.error('❌ 스캔 오류:', error);
      Alert.alert('스캔 오류', '단어 스캔 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
      setDetectedWords([]);
    }
  };

  const handleGalleryPress = async () => {
    try {
      // 갤러리 선택 시뮬레이션
      Alert.alert(
        '갤러리 이미지 선택',
        '이미지를 선택하면 OCR을 진행합니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '선택',
            onPress: async () => {
              setIsScanning(true);
              setScanProgress(0);
              setDetectedWords([]);

              try {
                console.log('🖼️ 갤러리 이미지 OCR 시작...');

                // UI 진행률 시뮬레이션
                await simulateOCRProgress();

                // OCR 처리 (갤러리 이미지 시뮬레이션)
                const imageUri = `mock://gallery-image-${Date.now()}.jpg`;
                const result = await ocrService.processImageComplete(imageUri);

                console.log('✅ 갤러리 OCR 완료:', result.statistics);

                // 감지된 단어들 표시
                const detectedWordTexts = result.validWords.map(word => word.cleaned);
                setDetectedWords(detectedWordTexts);

                // 결과 화면으로 이동
                navigation.navigate('ScanResults', {
                  scannedText: result.ocrResult.text,
                  detectedWords: detectedWordTexts,
                  imageUri: imageUri
                });

              } catch (error) {
                console.error('❌ 갤러리 OCR 오류:', error);
                Alert.alert('처리 오류', '이미지 처리 중 오류가 발생했습니다.');
              } finally {
                setIsScanning(false);
                setScanProgress(0);
                setDetectedWords([]);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('오류', '이미지 처리 중 오류가 발생했습니다.');
      setIsScanning(false);
    }
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
    // 실제 카메라에서는 플래시 토글 기능이 들어갈 예정
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    cameraPreview: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
      margin: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      position: 'relative',
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanOverlay: {
      width: '80%',
      height: '60%',
      borderWidth: 2,
      borderColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.md,
      backgroundColor: 'transparent',
    },
    cornerTL: {
      position: 'absolute',
      top: -2,
      left: -2,
      width: 20,
      height: 20,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderColor: theme.colors.primary.main,
    },
    cornerTR: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 20,
      height: 20,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderColor: theme.colors.primary.main,
    },
    cornerBL: {
      position: 'absolute',
      bottom: -2,
      left: -2,
      width: 20,
      height: 20,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderColor: theme.colors.primary.main,
    },
    cornerBR: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderColor: theme.colors.primary.main,
    },
    progressContainer: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
    },
    progressText: {
      ...theme.typography.body2,
      color: '#FFF',
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    progressBar: {
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary.main,
    },
    detectedWordsContainer: {
      marginTop: theme.spacing.sm,
    },
    detectedWordsText: {
      ...theme.typography.caption,
      color: '#CCC',
      textAlign: 'center',
    },
    flashActive: {
      backgroundColor: theme.colors.primary.main,
    },
    previewText: {
      ...theme.typography.h2,
      color: '#FFF',
      marginBottom: theme.spacing.sm,
    },
    previewSubText: {
      ...theme.typography.body1,
      color: '#CCC',
      textAlign: 'center',
      lineHeight: 24,
    },
    controls: {
      backgroundColor: theme.colors.background.primary,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      paddingTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: 34, // Safe area
    },
    instructionContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    instructionText: {
      ...theme.typography.body1,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
      textAlign: 'center',
      marginBottom: theme.spacing.xs,
    },
    instructionSubText: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    galleryButton: {
      alignItems: 'center',
      marginRight: 40,
    },
    galleryButtonText: {
      fontSize: 24,
      marginBottom: theme.spacing.xs,
    },
    scanButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.primary.main,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    scanButtonActive: {
      backgroundColor: theme.colors.semantic.error,
    },
    scanButtonInner: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: '#FFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanButtonText: {
      fontSize: isScanning ? 16 : 24,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
    },
    flashButton: {
      alignItems: 'center',
      marginLeft: 40,
    },
    flashButtonText: {
      fontSize: 24,
      marginBottom: theme.spacing.xs,
    },
    buttonLabel: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
    },
    resultContainer: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      maxHeight: 120,
    },
    resultTitle: {
      ...theme.typography.body1,
      fontWeight: 'bold',
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
    },
    resultPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 60,
    },
    resultPlaceholderText: {
      ...theme.typography.body2,
      color: theme.colors.text.tertiary,
    },
    // 웹 환경용 스타일
    webMockContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
    },
    webMockTitle: {
      ...theme.typography.h1,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    webMockSubtitle: {
      ...theme.typography.body1,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: theme.spacing.xl,
    },
    mockScanButton: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      minWidth: 200,
    },
    mockScanButtonText: {
      ...theme.typography.button,
      textAlign: 'center',
    },
  });

  // 웹 환경에서는 간단한 mock 카메라 화면 표시
  if (isWeb) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <View style={styles.webMockContainer}>
          <Text style={[styles.webMockTitle, { color: theme.colors.text.primary }]}>
            📷 카메라 스캔
          </Text>
          <Text style={[styles.webMockSubtitle, { color: theme.colors.text.secondary }]}>
            웹 환경에서는 카메라 기능을 사용할 수 없습니다.{'\n'}
            모바일 앱에서 카메라 스캔 기능을 이용해주세요.
          </Text>
          <TouchableOpacity
            style={[styles.mockScanButton, { backgroundColor: theme.colors.primary.main }]}
            onPress={handleMockScan}
          >
            <Text style={[styles.mockScanButtonText, { color: theme.colors.primary.contrast }]}>
              🖼️ Mock 스캔 테스트
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 카메라 프리뷰 영역 */}
      <View style={styles.cameraPreview}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <View style={styles.scanOverlay}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>

          {isScanning && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                텍스트를 분석하고 있습니다... {scanProgress}%
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${scanProgress}%` }]}
                />
              </View>
              {detectedWords.length > 0 && (
                <View style={styles.detectedWordsContainer}>
                  <Text style={styles.detectedWordsText}>
                    감지된 단어: {detectedWords.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {!isScanning && (
          <>
            <Text style={styles.previewText}>📖</Text>
            <Text style={styles.previewSubText}>
              텍스트가 포함된 문서를{'\n'}
              사각형 안에 맞춰주세요
            </Text>
          </>
        )}
      </View>

      {/* 하단 컨트롤 */}
      <View style={styles.controls}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            {isScanning ? '🔍 텍스트 분석 중...' : '📖 책, 문서, 화면의 영어 단어를 스캔하세요'}
          </Text>
          <Text style={styles.instructionSubText}>
            {isScanning ? `${scanProgress}% 완료` : '인식된 단어들을 단어장에 추가할 수 있습니다'}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.galleryButton} onPress={handleGalleryPress}>
            <Text style={styles.galleryButtonText}>📱</Text>
            <Text style={styles.buttonLabel}>갤러리</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.scanButton, isScanning && styles.scanButtonActive]}
              onPress={handleScanPress}
              disabled={isScanning}
            >
              <View style={styles.scanButtonInner}>
                {isScanning ? (
                  <ActivityIndicator size="small" color={theme.colors.primary.main} />
                ) : (
                  <Text style={styles.scanButtonText}>📷</Text>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={[styles.flashButton, flashEnabled && styles.flashActive]}
            onPress={toggleFlash}
          >
            <Text style={styles.flashButtonText}>
              {flashEnabled ? '⚡' : '🔦'}
            </Text>
            <Text style={styles.buttonLabel}>
              {flashEnabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 스캔 결과 영역 */}
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>실시간 단어 감지</Text>
          <View style={styles.resultPlaceholder}>
            {isScanning ? (
              <View>
                <Text style={styles.resultPlaceholderText}>
                  텍스트 분석 중... ({scanProgress}%)
                </Text>
                {detectedWords.length > 0 && (
                  <Text style={[styles.resultPlaceholderText, { color: theme.colors.primary.main, marginTop: theme.spacing.xs }]}>
                    {detectedWords.join(' • ')}
                  </Text>
                )}
              </View>
            ) : (
              <Text style={styles.resultPlaceholderText}>
                문서를 스캔하면 여기에 단어들이 표시됩니다
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
