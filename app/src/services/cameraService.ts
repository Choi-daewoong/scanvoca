import { Camera } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export interface CameraPermissions {
  camera: boolean;
  microphone: boolean;
  mediaLibrary: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: string[];
}

class CameraService {
  private static instance: CameraService;

  private constructor() {}

  static getInstance(): CameraService {
    if (!CameraService.instance) {
      CameraService.instance = new CameraService();
    }
    return CameraService.instance;
  }

  // 카메라 권한 요청 및 확인
  async requestPermissions(): Promise<CameraPermissions> {
    try {
      // 카메라 권한 요청
      const cameraPermission = await Camera.requestCameraPermission();
      
      // 갤러리 권한 요청 (MediaLibrary)
      const mediaLibraryStatus = await MediaLibrary.requestPermissionsAsync();
      
      // 이미지 피커 권한 요청
      const imagePickerStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();

      return {
        camera: cameraPermission === 'granted',
        microphone: true, // 마이크는 비활성화했으므로 true로 설정
        mediaLibrary: mediaLibraryStatus.granted && imagePickerStatus.granted,
      };
    } catch (error) {
      console.error('Permission request failed:', error);
      return {
        camera: false,
        microphone: false,
        mediaLibrary: false,
      };
    }
  }

  // 현재 권한 상태 확인
  async getPermissionStatus(): Promise<CameraPermissions> {
    try {
      const cameraPermission = await Camera.getCameraPermissionStatus();
      const mediaLibraryStatus = await MediaLibrary.getPermissionsAsync();
      const imagePickerStatus = await ImagePicker.getMediaLibraryPermissionsAsync();

      return {
        camera: cameraPermission === 'granted',
        microphone: true,
        mediaLibrary: mediaLibraryStatus.granted && imagePickerStatus.granted,
      };
    } catch (error) {
      console.error('Permission status check failed:', error);
      return {
        camera: false,
        microphone: false,
        mediaLibrary: false,
      };
    }
  }

  // 갤러리에서 이미지 선택
  async pickImageFromGallery(): Promise<string | null> {
    try {
      const permissions = await this.getPermissionStatus();
      if (!permissions.mediaLibrary) {
        const newPermissions = await this.requestPermissions();
        if (!newPermissions.mediaLibrary) {
          throw new Error('Gallery permission not granted');
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
        selectionLimit: 1,
        presentationStyle: Platform.OS === 'ios' ? ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN : undefined,
      });

      if (!result.canceled && result.assets.length > 0) {
        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.error('Image picker failed:', error);
      throw error;
    }
  }

  // 카메라 사용 가능 여부 확인
  async isCameraAvailable(): Promise<boolean> {
    try {
      const devices = await Camera.getAvailableCameraDevices();
      return devices.length > 0;
    } catch (error) {
      console.error('Camera availability check failed:', error);
      return false;
    }
  }

  // 사용 가능한 카메라 장치 목록 가져오기
  async getAvailableDevices() {
    try {
      return await Camera.getAvailableCameraDevices();
    } catch (error) {
      console.error('Failed to get camera devices:', error);
      return [];
    }
  }

  // OCR 처리 (실제 MLKit 구현)
  async processImageForOCR(imageUri: string): Promise<OCRResult> {
    console.log('🔍 실제 OCR 처리 시작:', imageUri);

    try {
      // ocrService를 동적으로 import하여 순환 참조 방지
      const { ocrService } = await import('./ocrService');

      // 실제 MLKit OCR 처리
      const ocrResult = await ocrService.extractTextFromImage(imageUri);

      // CameraService의 OCRResult 형태로 변환
      const words = ocrResult.words.map(word => word.text);
      const averageConfidence = ocrResult.words.length > 0
        ? ocrResult.words.reduce((sum, word) => sum + word.confidence, 0) / ocrResult.words.length
        : 0;

      console.log(`✅ OCR 처리 완료: ${words.length}개 단어, 평균 신뢰도: ${averageConfidence.toFixed(2)}`);

      return {
        text: ocrResult.text,
        confidence: averageConfidence,
        words: words,
      };
    } catch (error) {
      console.error('❌ OCR 처리 실패:', error);

      // 실패 시 fallback
      return {
        text: 'OCR processing failed',
        confidence: 0,
        words: [],
      };
    }
  }

  // 이미지를 임시 파일로 저장
  async saveTemporaryImage(uri: string): Promise<string> {
    try {
      // 임시 파일 경로 생성
      const timestamp = Date.now();
      const fileName = `temp_ocr_${timestamp}.jpg`;
      
      // 실제 구현에서는 FileSystem을 사용하여 임시 파일로 복사
      console.log(`Saving temporary image: ${fileName}`);
      
      return uri; // 현재는 원본 URI 반환
    } catch (error) {
      console.error('Failed to save temporary image:', error);
      throw error;
    }
  }
}

export const cameraService = CameraService.getInstance();
export default CameraService;