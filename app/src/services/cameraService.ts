import { Camera } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
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

  // OCR 처리 (현재는 모의 구현)
  async processImageForOCR(imageUri: string): Promise<OCRResult> {
    // 실제 OCR 구현은 나중에 추가
    // 현재는 모의 데이터 반환
    console.log('Processing image for OCR:', imageUri);
    
    // 모의 OCR 결과
    const mockWords = ['example', 'vocabulary', 'learning', 'english', 'study'];
    const mockText = mockWords.join(' ');
    
    return {
      text: mockText,
      confidence: 0.85,
      words: mockWords,
    };
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