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

  // 이미지에서 텍스트 추출 (현재는 모의 구현)
  async extractTextFromImage(imageUri: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // 실제 OCR 구현은 Google Vision API, Tesseract.js 등을 사용
      // 현재는 모의 데이터 반환
      const mockWords: OCRWord[] = [
        { text: 'vocabulary', confidence: 0.95, boundingBox: { x: 10, y: 10, width: 100, height: 30 } },
        { text: 'learning', confidence: 0.92, boundingBox: { x: 120, y: 10, width: 80, height: 30 } },
        { text: 'English', confidence: 0.88, boundingBox: { x: 210, y: 10, width: 70, height: 30 } },
        { text: 'study', confidence: 0.90, boundingBox: { x: 10, y: 50, width: 60, height: 30 } },
        { text: 'application', confidence: 0.87, boundingBox: { x: 80, y: 50, width: 110, height: 30 } },
      ];

      const processingTime = Date.now() - startTime;

      return {
        text: mockWords.map(w => w.text).join(' '),
        words: mockWords,
        processingTime,
        imageUri,
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
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
        // 데이터베이스에서 단어 검색
        const wordData = await databaseService.findExactWord(cleaned);
        
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
      // 기본 검색
      let results = await databaseService.searchWords(word);
      
      if (results.length === 0 && word.length > 3) {
        // 유사한 단어 검색 (간단한 부분 문자열 검색)
        const variations = this.generateWordVariations(word);
        
        for (const variation of variations) {
          const varResults = await databaseService.searchWords(variation);
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
}

export const ocrService = OCRService.getInstance();
export default OCRService;