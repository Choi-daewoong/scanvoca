// TTS (Text-to-Speech) 서비스 - 호환성 모드
import { Alert, Platform } from 'react-native';

// expo-speech 조건부 import (네이티브 모듈 미포함 시 대응)
let Speech: any = null;
try {
  Speech = require('expo-speech');
  console.log('✅ expo-speech 모듈 로드 성공');
} catch (error) {
  console.log('⚠️ expo-speech 모듈 사용 불가:', error.message);
}

interface TTSOptions {
  language?: string;
  rate?: number;
  pitch?: number;
}

class TTSService {
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      if (Speech && Speech.speak) {
        this.isInitialized = true;
        console.log('✅ TTS 서비스: expo-speech 사용 가능');
      } else {
        this.isInitialized = false;
        console.log('⚠️ TTS 서비스: expo-speech 사용 불가 (폴백 모드)');
      }
    } catch (error) {
      this.isInitialized = false;
      console.log('⚠️ TTS 서비스 초기화 실패:', error);
    }
  }

  async speak(text: string, options: TTSOptions = {}) {
    const {
      language = 'en-US',
      rate = 0.75,  // 조금 더 천천히
      pitch = 1.0,
    } = options;

    console.log(`🔊 TTS 요청: "${text}" (언어: ${language})`);
    console.log(`🔍 TTS 상태 확인 - isInitialized: ${this.isInitialized}, Speech: ${!!Speech}, Speech.speak: ${!!(Speech && Speech.speak)}`);

    try {
      if (this.isInitialized && Speech && Speech.speak) {
        console.log(`🎵 expo-speech TTS 재생 시작: "${text}"`);

        // TTS 재생 전에 이전 재생 중단
        if (Speech.stop) {
          await Speech.stop();
        }

        // expo-speech를 사용한 실제 TTS 재생
        const speechOptions = {
          language,
          rate,
          pitch,
          voice: undefined, // 시스템 기본 음성 사용
        };

        console.log(`🔧 TTS 옵션:`, speechOptions);

        // Promise 방식으로 TTS 결과 확인
        return new Promise((resolve) => {
          Speech.speak(text, {
            ...speechOptions,
            onStart: () => {
              console.log(`▶️ TTS 재생 시작됨: "${text}"`);
            },
            onDone: () => {
              console.log(`✅ TTS 재생 완료: "${text}"`);
              resolve(true);
            },
            onStopped: () => {
              console.log(`⏹️ TTS 재생 중단됨: "${text}"`);
              resolve(false);
            },
            onError: (error: any) => {
              console.error(`❌ TTS 재생 에러: "${text}"`, error);
              resolve(false);
            },
          });
        });
      } else {
        console.log(`⚠️ TTS 조건 불충족 - 폴백 모드 사용`);

        // 폴백 1: 웹 Speech API 시도 (Android WebView에서 작동 가능)
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          try {
            console.log(`🌐 웹 Speech API 시도: "${text}"`);

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = language;
            utterance.rate = rate;
            utterance.pitch = pitch;

            return new Promise((resolve) => {
              utterance.onstart = () => {
                console.log(`▶️ 웹 TTS 재생 시작: "${text}"`);
              };

              utterance.onend = () => {
                console.log(`✅ 웹 TTS 재생 완료: "${text}"`);
                resolve(true);
              };

              utterance.onerror = (event) => {
                console.error(`❌ 웹 TTS 에러: "${text}"`, event);
                resolve(false);
              };

              window.speechSynthesis.speak(utterance);
            });
          } catch (webError) {
            console.warn('웹 Speech API 실패:', webError);
          }
        }

        // 폴백 2: Alert 메시지로 발음 표시 (개발 모드에서만)
        if (__DEV__) {
          Alert.alert(
            '🔊 발음 재생 (개발 모드)',
            `"${text}"\n\n언어: ${language}\n속도: ${rate}x\n\n💡 실제 음성을 들으려면 Dev Client APK가 필요합니다.\n\n현재 상태:\n- expo-speech 로드됨: ${!!Speech}\n- TTS 초기화됨: ${this.isInitialized}`,
            [{ text: '확인', style: 'default' }]
          );
        }

        console.log(`📢 TTS 폴백 모드: "${text}"`);
        return false;
      }
    } catch (error) {
      console.error('TTS 에러:', error);

      if (__DEV__) {
        Alert.alert(
          '🔊 발음 재생 오류',
          `"${text}"\n\n언어: ${language}\n\n⚠️ TTS 재생 중 오류가 발생했습니다.\n\n에러: ${error instanceof Error ? error.message : String(error)}`,
          [{ text: '확인', style: 'default' }]
        );
      }
      return false;
    }
  }

  // 발음 중단
  async stop() {
    try {
      if (this.isInitialized && Speech && Speech.stop) {
        await Speech.stop();
        console.log('🔇 TTS 중단');
      }
    } catch (error) {
      console.warn('TTS 중단 에러:', error);
    }
  }

  // 사용 가능 여부 확인
  isReady(): boolean {
    return this.isInitialized;
  }

  // 현재 상태 정보
  getStatus(): string {
    if (this.isInitialized) {
      return 'expo-speech 사용 가능 (Dev Client)';
    } else {
      return 'expo-speech 사용 불가 (폴백 모드)';
    }
  }

  // 사용 가능한 음성 목록 가져오기
  async getAvailableVoices() {
    try {
      if (this.isInitialized && Speech && Speech.getAvailableVoicesAsync) {
        const voices = await Speech.getAvailableVoicesAsync();
        console.log('사용 가능한 음성:', voices.length);
        return voices.filter(voice => voice.language.startsWith('en'));
      }
    } catch (error) {
      console.warn('음성 목록 가져오기 실패:', error);
    }
    return [];
  }

  // 단어 발음 (단어에 특화된 TTS)
  async speakWord(word: string, options: TTSOptions = {}) {
    // 단어 전용 옵션 설정
    const wordOptions = {
      language: 'en-US',
      rate: 0.65, // 단어는 더 천천히
      pitch: 1.0,
      ...options,
    };

    console.log(`📖 단어 발음 요청: "${word}"`);
    return this.speak(word, wordOptions);
  }

  // 예문 발음 (문장에 특화된 TTS)
  async speakSentence(sentence: string, options: TTSOptions = {}) {
    // 문장 전용 옵션 설정
    const sentenceOptions = {
      language: 'en-US',
      rate: 0.8, // 문장은 조금 빠르게
      pitch: 1.0,
      ...options,
    };

    console.log(`📝 예문 발음 요청: "${sentence}"`);
    return this.speak(sentence, sentenceOptions);
  }

  // TTS 시스템 테스트
  async testTTS(): Promise<boolean> {
    console.log('🧪 TTS 시스템 테스트 시작...');

    try {
      const testWord = 'hello';
      const result = await this.speakWord(testWord);

      if (result) {
        console.log('✅ TTS 테스트 성공');
        return true;
      } else {
        console.log('⚠️ TTS 테스트 실패 (폴백 모드)');
        return false;
      }
    } catch (error) {
      console.error('❌ TTS 테스트 중 오류:', error);
      return false;
    }
  }

  // TTS 진단 정보
  getDiagnostics(): {
    speechModule: boolean;
    isInitialized: boolean;
    hasSpeak: boolean;
    hasStop: boolean;
    hasGetVoices: boolean;
    platform: string;
    status: string;
  } {
    return {
      speechModule: !!Speech,
      isInitialized: this.isInitialized,
      hasSpeak: !!(Speech && Speech.speak),
      hasStop: !!(Speech && Speech.stop),
      hasGetVoices: !!(Speech && Speech.getAvailableVoicesAsync),
      platform: Platform.OS,
      status: this.getStatus(),
    };
  }
}

// 싱글톤 인스턴스 생성
const ttsService = new TTSService();

export default ttsService;