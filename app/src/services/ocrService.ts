import { databaseService } from '../database/database';
import { WordWithMeaning } from '../types/types';

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
  wordData?: WordWithMeaning;
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

  // 이미지에서 텍스트 추출 (강화된 시뮬레이션)
  async extractTextFromImage(imageUri: string): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      console.log('🔍 OCR 처리 시작:', imageUri);

      // 실제 OCR 구현은 Google Vision API, Tesseract.js 등을 사용
      // 현재는 다양한 시나리오를 가진 시뮬레이션 데이터
      const mockScenarios = [
        // 학습 교재 시나리오
        [
          { text: 'vocabulary', confidence: 0.95 },
          { text: 'learning', confidence: 0.92 },
          { text: 'English', confidence: 0.88 },
          { text: 'study', confidence: 0.90 },
          { text: 'application', confidence: 0.87 },
          { text: 'education', confidence: 0.94 },
          { text: 'knowledge', confidence: 0.89 }
        ],
        // 뉴스 기사 시나리오
        [
          { text: 'technology', confidence: 0.93 },
          { text: 'innovation', confidence: 0.91 },
          { text: 'development', confidence: 0.88 },
          { text: 'research', confidence: 0.95 },
          { text: 'artificial', confidence: 0.85 },
          { text: 'intelligence', confidence: 0.87 }
        ],
        // 소설/책 시나리오
        [
          { text: 'beautiful', confidence: 0.94 },
          { text: 'adventure', confidence: 0.89 },
          { text: 'mysterious', confidence: 0.86 },
          { text: 'character', confidence: 0.92 },
          { text: 'journey', confidence: 0.90 },
          { text: 'imagination', confidence: 0.88 }
        ]
      ];

      // 랜덤 시나리오 선택
      const selectedScenario = mockScenarios[Math.floor(Math.random() * mockScenarios.length)];

      // 바운딩 박스 계산
      const mockWords: OCRWord[] = selectedScenario.map((word, index) => ({
        ...word,
        boundingBox: {
          x: (index % 3) * 120 + 10,
          y: Math.floor(index / 3) * 40 + 10,
          width: word.text.length * 8 + 20,
          height: 30
        }
      }));

      // OCR 처리 시간 시뮬레이션 (1-3초)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      const processingTime = Date.now() - startTime;

      console.log(`✅ OCR 완료: ${mockWords.length}개 단어 감지, 처리시간: ${processingTime}ms`);

      return {
        text: mockWords.map(w => w.text).join(' '),
        words: mockWords,
        processingTime,
        imageUri,
      };
    } catch (error) {
      console.error('❌ OCR 처리 실패:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  // 추출된 단어들을 정리하고 데이터베이스에서 검색
  async processExtractedWords(ocrResult: OCRResult): Promise<ProcessedWord[]> {
    const processedWords: ProcessedWord[] = [];

    for (const ocrWord of ocrResult.words) {
      // 단어 정리 (특수문자 제거, 소문자 변환 등)
      const cleaned = this.cleanWord(ocrWord.text);
      
      if (cleaned.length < 2) {
        continue; // 너무 짧은 단어는 건너뛰기
      }

      try {
        // 데이터베이스에서 단어 검색 (수정된 호출 방식)
        const wordData = await databaseService.repo.words.findExactWord(cleaned);

        processedWords.push({
          original: ocrWord.text,
          cleaned,
          found: !!wordData,
          wordData: wordData || undefined,
        });
      } catch (error) {
        console.error(`Failed to search word: ${cleaned}`, error);
        processedWords.push({
          original: ocrWord.text,
          cleaned,
          found: false,
        });
      }
    }

    return processedWords;
  }

  // 단어 정리 함수
  private cleanWord(word: string): string {
    return word
      .toLowerCase()
      .replace(/[^a-zA-Z]/g, '') // 알파벳이 아닌 문자 제거
      .trim();
  }

  // 유사한 단어 검색 (오타 보정 등)
  async searchSimilarWords(word: string): Promise<WordWithMeaning[]> {
    try {
      // 기본 검색 (수정된 호출 방식)
      let results = await databaseService.repo.words.searchWords(word);

      if (results.length === 0 && word.length > 3) {
        // 유사한 단어 검색 (간단한 부분 문자열 검색)
        const variations = this.generateWordVariations(word);

        for (const variation of variations) {
          const varResults = await databaseService.repo.words.searchWords(variation);
          results = results.concat(varResults);

          if (results.length >= 5) break; // 최대 5개까지만
        }
      }

      // 중복 제거
      const uniqueResults = this.removeDuplicateWords(results);
      
      return uniqueResults.slice(0, 10); // 최대 10개 반환
    } catch (error) {
      console.error('Similar word search failed:', error);
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
  private removeDuplicateWords(words: WordWithMeaning[]): WordWithMeaning[] {
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

      const wordLevel = word.wordData.difficulty_level || 4;

      // 사용자 레벨 ±1 범위의 단어 추천
      return Math.abs(wordLevel - userLevel) <= 1;
    }).sort((a, b) => {
      // 난이도 순으로 정렬
      const levelA = a.wordData?.difficulty_level || 4;
      const levelB = b.wordData?.difficulty_level || 4;
      return levelA - levelB;
    });
  }

  // 학습 가치 있는 단어 필터링
  filterLearningWords(processedWords: ProcessedWord[]): ProcessedWord[] {
    return processedWords.filter(word => {
      if (!word.found || !word.wordData) return false;

      // 너무 기본적인 단어 제외 (레벨 1)
      const level = word.wordData.difficulty_level || 4;
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
export default OCRService;