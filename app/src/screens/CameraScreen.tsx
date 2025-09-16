import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

const CameraScreen: React.FC = () => {
  const [isScanning] = useState(false);

  const handleScanPress = () => {
    Alert.alert(
      '카메라 스캔',
      'OCR 기능은 아직 구현되지 않았습니다.\n다음 단계에서 react-native-vision-camera를 추가할 예정입니다.',
      [{ text: '확인' }]
    );
  };

  const handleGalleryPress = () => {
    Alert.alert('갤러리에서 선택', '갤러리 이미지 OCR 기능은 아직 구현되지 않았습니다.', [
      { text: '확인' },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 카메라 프리뷰 영역 (임시) */}
      <View style={styles.cameraPreview}>
        <Text style={styles.previewText}>카메라 프리뷰</Text>
        <Text style={styles.previewSubText}>
          텍스트가 포함된 이미지를{'\n'}
          카메라로 촬영하세요
        </Text>
      </View>

      {/* 하단 컨트롤 */}
      <View style={styles.controls}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>📖 책, 문서, 화면의 영어 단어를 스캔하세요</Text>
          <Text style={styles.instructionSubText}>인식된 단어들을 단어장에 추가할 수 있습니다</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.galleryButton} onPress={handleGalleryPress}>
            <Text style={styles.galleryButtonText}>📱</Text>
            <Text style={styles.buttonLabel}>갤러리</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanButtonActive]}
            onPress={handleScanPress}
            disabled={isScanning}
          >
            <View style={styles.scanButtonInner}>
              <Text style={styles.scanButtonText}>{isScanning ? '스캔 중...' : '📷'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flashButton}
            onPress={() => {
              Alert.alert('플래시', '플래시 기능은 카메라 구현 후 추가됩니다.');
            }}
          >
            <Text style={styles.flashButtonText}>⚡</Text>
            <Text style={styles.buttonLabel}>플래시</Text>
          </TouchableOpacity>
        </View>

        {/* 스캔 결과 영역 (임시) */}
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>스캔된 단어들</Text>
          <View style={styles.resultPlaceholder}>
            <Text style={styles.resultPlaceholderText}>스캔 결과가 여기에 표시됩니다</Text>
          </View>
        </View>
      </View>
    </View>
  );
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
    margin: 16,
    borderRadius: 12,
  },
  previewText: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  previewSubText: {
    fontSize: 16,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 24,
  },
  controls: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 34, // Safe area
  },
  instructionContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  instructionSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  galleryButton: {
    alignItems: 'center',
    marginRight: 40,
  },
  galleryButtonText: {
    fontSize: 24,
    marginBottom: 4,
  },
  scanButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scanButtonActive: {
    backgroundColor: '#FF6B6B',
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
    fontSize: 24,
    fontWeight: 'bold',
  },
  flashButton: {
    alignItems: 'center',
    marginLeft: 40,
  },
  flashButtonText: {
    fontSize: 24,
    marginBottom: 4,
  },
  buttonLabel: {
    fontSize: 12,
    color: '#666',
  },
  resultContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    maxHeight: 120,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  resultPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  resultPlaceholderText: {
    fontSize: 14,
    color: '#999',
  },
});

export default CameraScreen;
