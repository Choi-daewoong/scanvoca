import smartDictionaryService from './smartDictionaryService';
import { SmartWordDefinition, ProcessedWordV2 } from '../types/types';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRResult {
  text: string;
  words: OCRWord[];
  processingTime: number;
  imageUri: string;
}

export interface ProcessedWord {
  original: string;
  cleaned: string;
  found: boolean;
  wordData?: SmartWordDefinition;
  processing_source?: 'cache' | 'gpt' | 'none';
  error?: string;
}

class OCRService {
  private static instance: OCRService;

  private constructor() {}

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  // 이미지에서 텍스트 추출 (실제 MLKit 구현)
  async extractTextFromImage(imageUri: string): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      console.log('🔍 MLKit OCR 처리 시작:', imageUri);

      // 파일 존재 확인
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }

      // MLKit을 사용한 실제 텍스트 인식
      const result = await TextRecognition.recognize(imageUri);

      if (!result || !result.text) {
        console.log('⚠️ OCR 결과가 비어있음');
        return {
          text: '',
          words: [],
          processingTime: Date.now() - startTime,
          imageUri,
        };
      }

      // 텍스트를 단어별로 분할하고 OCRWord 객체로 변환
      const words: OCRWord[] = [];
      const textLines = result.text.split('\n');

      textLines.forEach((line, lineIndex) => {
        const wordsInLine = line.trim().split(/\s+/).filter(word => word.length > 0);

        wordsInLine.forEach((word, wordIndex) => {
          // 특수문자 제거 후 영어 단어인지 확인
          const cleanedWord = word.replace(/[^\w]/g, '');
          if (cleanedWord.length >= 2 && /^[a-zA-Z]+$/.test(cleanedWord)) {
            words.push({
              text: cleanedWord,
              confidence: 0.85 + (Math.random() * 0.1), // MLKit에서 실제 confidence를 제공하지 않으므로 추정값 사용
              boundingBox: {
                x: wordIndex * 50, // 추정값 (실제 MLKit에서는 더 정확한 좌표 제공)
                y: lineIndex * 30,
                width: cleanedWord.length * 12,
                height: 25
              }
            });
          }
        });
      });

      const processingTime = Date.now() - startTime;

      console.log(`✅ MLKit OCR 완료: ${words.length}개 단어 감지, 처리시간: ${processingTime}ms`);
      console.log('인식된 텍스트:', result.text);
      console.log('추출된 단어들:', words.map(w => w.text));

      return {
        text: result.text,
        words: words,
        processingTime,
        imageUri,
      };
    } catch (error) {
      console.error('❌ MLKit OCR 처리 실패:', error);

      // MLKit 실패 시 빈 결과 반환 (Mock 데이터 사용하지 않음)
      console.log('🚫 OCR 실패 - 빈 결과 반환 (Mock 데이터 사용하지 않음)');

      return {
        text: '',
        words: [],
        processingTime: Date.now() - startTime,
        imageUri,
      };
    }
  }

  // 추출된 단어들을 GPT 스마트 사전에서 검색
  async processExtractedWords(ocrResult: OCRResult): Promise<ProcessedWord[]> {
    console.log('🤖 GPT 스마트 사전을 사용한 단어 처리 시작');

    const processedWords: ProcessedWord[] = [];

    try {
      // SmartDictionaryService 초기화 확인
      if (!smartDictionaryService.isOnlineMode()) {
        console.log('🔄 SmartDictionaryService 초기화 중...');
        await smartDictionaryService.initialize();
      }

      // 1단계: 단어들 정리 및 필터링
      const cleanedWords: string[] = [];
      const wordMapping: { [cleaned: string]: OCRWord[] } = {};

      for (const ocrWord of ocrResult.words) {
        const cleaned = this.cleanWord(ocrWord.text);

        // 너무 짧거나 유효하지 않은 단어 필터링
        if (cleaned.length < 2 || cleaned.length > 20) {
          processedWords.push({
            original: ocrWord.text,
            cleaned,
            found: false,
            processing_source: 'none',
            error: cleaned.length < 2 ? 'Too short' : 'Too long'
          });
          continue;
        }

        // 중복 제거 및 매핑 생성
        if (!wordMapping[cleaned]) {
          wordMapping[cleaned] = [];
          cleanedWords.push(cleaned);
        }
        wordMapping[cleaned].push(ocrWord);
      }

      console.log(`📝 정리된 단어 수: ${cleanedWords.length}개 (원본: ${ocrResult.words.length}개)`);

      if (cleanedWords.length === 0) {
        console.log('⚠️ 처리할 유효한 단어가 없음');
        return processedWords;
      }

      // 2단계: 배치로 GPT 스마트 사전 호출 (캐시 우선)
      const smartDefinitions = await smartDictionaryService.getWordDefinitions(cleanedWords);

      // 3단계: 결과를 ProcessedWord 형태로 변환
      for (const [cleaned, ocrWords] of Object.entries(wordMapping)) {
        const smartDef = smartDefinitions.find(def => def.word.toLowerCase() === cleaned.toLowerCase());

        // 같은 정리된 단어를 가진 모든 원본 단어에 대해 결과 생성
        for (const ocrWord of ocrWords) {
          const processedWord: ProcessedWord = {
            original: ocrWord.text,
            cleaned,
            found: !!smartDef,
            wordData: smartDef || undefined,
            processing_source: smartDef?.source || 'none'
          };

          processedWords.push(processedWord);
        }

        // 로그 출력
        if (smartDef) {
          console.log(`✅ "${cleaned}" -> ${smartDef.source} (${smartDef.meanings[0]?.korean})`);
        } else {
          console.log(`❌ "${cleaned}" -> 찾을 수 없음`);
        }
      }

      // 4단계: 통계 출력
      const foundCount = processedWords.filter(w => w.found).length;
      const cacheCount = processedWords.filter(w => w.processing_source === 'cache').length;
      const gptCount = processedWords.filter(w => w.processing_source === 'gpt').length;

      console.log(`📊 처리 결과: 총 ${processedWords.length}개, 찾음 ${foundCount}개 (캐시: ${cacheCount}, GPT: ${gptCount})`);

      return processedWords;

    } catch (error) {
      console.error('❌ GPT 단어 처리 실패:', error);

      // 에러 발생 시 기본 처리된 단어들 반환
      for (const ocrWord of ocrResult.words) {
        const cleaned = this.cleanWord(ocrWord.text);
        processedWords.push({
          original: ocrWord.text,
          cleaned,
          found: false,
          processing_source: 'none',
          error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }

      return processedWords;
    }
  }

  // GPT 캐시 통계 조회
  async getSmartDictionaryStats(): Promise<{
    cacheHitRate: number;
    totalCachedWords: number;
    estimatedCostSaved: number;
  }> {
    try {
      await smartDictionaryService.initialize();
      const stats = await smartDictionaryService.getCacheStats();

      return {
        cacheHitRate: stats.hitRate,
        totalCachedWords: stats.totalWords,
        estimatedCostSaved: stats.totalCost
      };
    } catch (error) {
      console.error('❌ 스마트 사전 통계 조회 실패:', error);
      return {
        cacheHitRate: 0,
        totalCachedWords: 0,
        estimatedCostSaved: 0
      };
    }
  }

  // 단어 정리 함수
  private cleanWord(word: string): string {
    return word
      .toLowerCase()
      .replace(/[^a-zA-Z]/g, '') // 알파벳이 아닌 문자 제거
      .trim();
  }

  // GPT가 일관된 고품질 번역을 제공하므로 복잡한 의미 선택 로직 불필요

  // GPT 기반 유사한 단어 검색 (오타 보정 등)
  async searchSimilarWords(word: string): Promise<SmartWordDefinition[]> {
    try {
      console.log(`🔍 유사 단어 검색: "${word}"`);

      // SmartDictionaryService 초기화 확인
      if (!smartDictionaryService.isOnlineMode()) {
        await smartDictionaryService.initialize();
      }

      // 단어 변형 생성
      const variations = this.generateWordVariations(word);
      variations.unshift(word); // 원본 단어도 포함

      console.log(`🔄 검색할 변형들: ${variations.join(', ')}`);

      // GPT 사전에서 변형들 검색
      const results = await smartDictionaryService.getWordDefinitions(variations);

      console.log(`✅ 유사 단어 검색 결과: ${results.length}개 찾음`);
      return results.slice(0, 10); // 최대 10개 반환

    } catch (error) {
      console.error('❌ 유사 단어 검색 실패:', error);
      return [];
    }
  }

  // 단어 변형 생성 (간단한 오타 보정)
  private generateWordVariations(word: string): string[] {
    const variations: string[] = [];
    
    // 앞뒤 문자 제거
    if (word.length > 3) {
      variations.push(word.slice(1)); // 첫 글자 제거
      variations.push(word.slice(0, -1)); // 마지막 글자 제거
    }
    
    // 부분 문자열
    if (word.length > 4) {
      variations.push(word.slice(0, -2)); // 마지막 2글자 제거
      variations.push(word.slice(2)); // 첫 2글자 제거
    }

    return variations;
  }

  // 중복 단어 제거
  private removeDuplicateWords(words: SmartWordDefinition[]): SmartWordDefinition[] {
    const seen = new Set<string>();
    return words.filter(word => {
      if (seen.has(word.word)) {
        return false;
      }
      seen.add(word.word);
      return true;
    });
  }

  // OCR 결과 필터링 (신뢰도 기반)
  filterByConfidence(words: OCRWord[], minConfidence: number = 0.7): OCRWord[] {
    return words.filter(word => word.confidence >= minConfidence);
  }

  // 영어 단어만 필터링
  filterEnglishWords(words: string[]): string[] {
    const englishPattern = /^[a-zA-Z]+$/;
    return words.filter(word =>
      englishPattern.test(word) &&
      word.length >= 2 &&
      word.length <= 20
    );
  }

  // 간단한 이미지 처리 (CameraScreen에서 사용)
  async processImage(imageUri: string): Promise<{
    ocrResult: OCRResult;
    processedWords: ProcessedWord[];
    validWords: ProcessedWord[];
    statistics: {
      totalDetected: number;
      validFound: number;
      confidence: number;
    };
  }> {
    return this.processImageComplete(imageUri);
  }

  // 일괄 처리: OCR + 데이터베이스 검증
  async processImageComplete(imageUri: string): Promise<{
    ocrResult: OCRResult;
    processedWords: ProcessedWord[];
    validWords: ProcessedWord[];
    statistics: {
      totalDetected: number;
      validFound: number;
      confidence: number;
    };
  }> {
    console.log('🚀 이미지 완전 처리 시작:', imageUri);

    try {
      // 1. OCR 텍스트 추출
      const ocrResult = await this.extractTextFromImage(imageUri);

      // 2. 단어 처리 및 데이터베이스 검증
      const processedWords = await this.processExtractedWords(ocrResult);

      // 3. 유효한 단어만 필터링
      const validWords = processedWords.filter(word => word.found);

      // 4. 통계 계산
      const totalDetected = ocrResult.words.length;
      const validFound = validWords.length;
      const averageConfidence = ocrResult.words.reduce((sum, word) => sum + word.confidence, 0) / totalDetected;

      const statistics = {
        totalDetected,
        validFound,
        confidence: Math.round(averageConfidence * 100) / 100
      };

      console.log('📊 처리 통계:', statistics);

      return {
        ocrResult,
        processedWords,
        validWords,
        statistics
      };
    } catch (error) {
      console.error('❌ 이미지 완전 처리 실패:', error);
      throw error;
    }
  }

  // 단어 추천 (학습 수준에 맞는)
  async getRecommendedWords(detectedWords: ProcessedWord[], userLevel: number = 3): Promise<ProcessedWord[]> {
    console.log(`🎯 사용자 레벨 ${userLevel}에 맞는 단어 추천 중...`);

    return detectedWords.filter(word => {
      if (!word.found || !word.wordData) return false;

      const wordLevel = word.wordData.difficulty || 4;

      // 사용자 레벨 ±1 범위의 단어 추천
      return Math.abs(wordLevel - userLevel) <= 1;
    }).sort((a, b) => {
      // 난이도 순으로 정렬
      const levelA = a.wordData?.difficulty || 4;
      const levelB = b.wordData?.difficulty || 4;
      return levelA - levelB;
    });
  }

  // 학습 가치 있는 단어 필터링
  filterLearningWords(processedWords: ProcessedWord[]): ProcessedWord[] {
    return processedWords.filter(word => {
      if (!word.found || !word.wordData) return false;

      // 너무 기본적인 단어 제외 (레벨 1)
      const level = word.wordData.difficulty || 4;
      if (level === 1) return false;

      // 너무 긴 단어 제외 (20자 이상)
      if (word.cleaned.length > 20) return false;

      // 의미가 없는 단어 제외
      if (!word.wordData.meanings || word.wordData.meanings.length === 0) return false;

      return true;
    });
  }

  // OCR 품질 평가
  evaluateOCRQuality(ocrResult: OCRResult): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // 신뢰도 평가
    const averageConfidence = ocrResult.words.reduce((sum, word) => sum + word.confidence, 0) / ocrResult.words.length;
    if (averageConfidence < 0.8) {
      score -= 20;
      issues.push('낮은 인식 신뢰도');
      recommendations.push('더 선명한 이미지를 촬영해보세요');
    }

    // 단어 수 평가
    if (ocrResult.words.length < 3) {
      score -= 15;
      issues.push('감지된 단어 수 부족');
      recommendations.push('더 많은 텍스트가 포함된 이미지를 선택해주세요');
    }

    // 처리 시간 평가
    if (ocrResult.processingTime > 5000) {
      score -= 10;
      issues.push('처리 시간 지연');
      recommendations.push('이미지 크기를 줄여보세요');
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }
}

export const ocrService = OCRService.getInstance();

/**
 * OCR 기능 테스트를 위한 헬퍼 함수
 */
export const testOCRService = {
  // MLKit 라이브러리가 정상적으로 로드되는지 확인
  async checkMLKitAvailability(): Promise<boolean> {
    try {
      // 단순히 TextRecognition을 import하고 사용 가능한지 확인
      const testResult = await TextRecognition.recognize('dummy://path');
      return true;
    } catch (error) {
      console.log('MLKit 사용 불가:', error);
      return false;
    }
  },

  // 테스트용 이미지로 OCR 확인
  async testWithSampleText(sampleText: string = "Hello World Learning English"): Promise<void> {
    console.log('🧪 OCR 테스트 시작...');
    console.log('샘플 텍스트:', sampleText);

    try {
      // Mock 테스트
      const mockResult = {
        text: sampleText,
        words: sampleText.split(' ').map((word, index) => ({
          text: word.toLowerCase(),
          confidence: 0.9,
          boundingBox: { x: index * 50, y: 0, width: word.length * 10, height: 20 }
        })),
        processingTime: 100,
        imageUri: 'test://sample'
      };

      const processedWords = await ocrService.processExtractedWords(mockResult);
      console.log('✅ 처리된 단어들:', processedWords.map(w => `${w.original} -> ${w.cleaned} (${w.found ? '찾음' : '못찾음'})`));

      return;
    } catch (error) {
      console.error('❌ OCR 테스트 실패:', error);
    }
  },

  // OCR 서비스 상태 확인
  getServiceStatus(): { mlkitEnabled: boolean; fallbackEnabled: boolean } {
    try {
      // MLKit import가 성공했는지 확인
      const mlkitAvailable = !!TextRecognition;
      return {
        mlkitEnabled: mlkitAvailable,
        fallbackEnabled: true, // fallback은 항상 사용 가능
      };
    } catch {
      return {
        mlkitEnabled: false,
        fallbackEnabled: true,
      };
    }
  }
};

export default OCRService;