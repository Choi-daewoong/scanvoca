import { Frame } from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface FrameProcessorResult {
  text: string;
  words: string[];
  timestamp: number;
}

// Frame Processor에서 호출할 콜백 함수 타입
type OnTextDetected = (result: FrameProcessorResult) => void;

/**
 * Frame Processor용 OCR 처리 함수
 * react-native-vision-camera의 실시간 프레임에서 텍스트를 인식합니다.
 */
export function createTextRecognitionFrameProcessor(onTextDetected: OnTextDetected) {
  'worklet';

  return (frame: Frame) => {
    'worklet';

    try {
      // Frame을 이미지로 변환하여 MLKit에 전달
      // 주의: Frame Processor는 고성능이 필요하므로 너무 자주 호출되지 않도록 조절
      if (frame.width > 0 && frame.height > 0) {
        // 실제 텍스트 인식 (비동기 처리를 runOnJS로 감싸기)
        runOnJS(processFrameForText)(frame, onTextDetected);
      }
    } catch (error) {
      console.error('Frame Processor 오류:', error);
    }
  };
}

/**
 * 프레임에서 텍스트를 추출하는 비동기 함수
 */
async function processFrameForText(frame: Frame, onTextDetected: OnTextDetected) {
  try {
    // Frame을 임시 이미지 파일로 저장 (필요한 경우)
    // 실제로는 Frame의 buffer를 직접 MLKit에 전달할 수 있으면 더 효율적

    // 현재는 단순화된 구현으로 frame의 기본 정보만 사용
    const timestamp = Date.now();

    // 실제 구현에서는 frame.buffer 또는 frame을 MLKit에 직접 전달
    // 지금은 임시로 빈 결과 반환
    const result: FrameProcessorResult = {
      text: '',
      words: [],
      timestamp,
    };

    onTextDetected(result);
  } catch (error) {
    console.error('프레임 텍스트 처리 실패:', error);
  }
}

/**
 * Frame Processor를 위한 설정 옵션
 */
export interface FrameProcessorOptions {
  enabled: boolean;
  intervalMs: number; // 처리 간격 (밀리초)
  minWordLength: number; // 최소 단어 길이
  confidenceThreshold: number; // 신뢰도 임계값
}

/**
 * 고급 Frame Processor (설정 가능한 옵션 포함)
 */
export function createAdvancedTextRecognitionFrameProcessor(
  onTextDetected: OnTextDetected,
  options: FrameProcessorOptions = {
    enabled: true,
    intervalMs: 1000, // 1초마다 처리
    minWordLength: 2,
    confidenceThreshold: 0.7,
  }
) {
  'worklet';

  let lastProcessTime = 0;

  return (frame: Frame) => {
    'worklet';

    if (!options.enabled) return;

    const now = Date.now();

    // 설정된 간격마다만 처리
    if (now - lastProcessTime < options.intervalMs) {
      return;
    }

    lastProcessTime = now;

    try {
      runOnJS(processFrameForTextAdvanced)(frame, onTextDetected, options);
    } catch (error) {
      console.error('고급 Frame Processor 오류:', error);
    }
  };
}

/**
 * 고급 프레임 텍스트 처리 함수
 */
async function processFrameForTextAdvanced(
  frame: Frame,
  onTextDetected: OnTextDetected,
  options: FrameProcessorOptions
) {
  try {
    const timestamp = Date.now();

    // 여기에 실제 MLKit Frame 처리 로직 구현
    // 현재는 임시 구현

    console.log(`🎥 Frame 처리: ${frame.width}x${frame.height} @ ${timestamp}`);

    const result: FrameProcessorResult = {
      text: 'Frame processor running...',
      words: ['frame', 'processor'],
      timestamp,
    };

    onTextDetected(result);
  } catch (error) {
    console.error('고급 프레임 텍스트 처리 실패:', error);
  }
}

/**
 * Frame Processor 유틸리티 함수들
 */
export const FrameProcessorUtils = {
  // Frame 크기 정보 확인
  getFrameInfo: (frame: Frame) => ({
    width: frame.width,
    height: frame.height,
    orientation: frame.orientation,
    timestamp: Date.now(),
  }),

  // Frame 품질 평가 (흐림 정도 등)
  evaluateFrameQuality: (frame: Frame): number => {
    // 실제 구현에서는 이미지 선명도를 평가
    // 현재는 기본값 반환
    return 0.85;
  },

  // 텍스트 인식에 적합한 Frame인지 확인
  isFrameSuitableForOCR: (frame: Frame): boolean => {
    const quality = FrameProcessorUtils.evaluateFrameQuality(frame);
    return quality > 0.7 && frame.width > 400 && frame.height > 300;
  },
};

export default {
  createTextRecognitionFrameProcessor,
  createAdvancedTextRecognitionFrameProcessor,
  FrameProcessorUtils,
};