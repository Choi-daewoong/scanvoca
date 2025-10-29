import { OCRResult, ProcessedWord } from './ocrService';
import smartDictionaryService from './smartDictionaryService';
import { getWordsMasteryStatus } from './wordbookExportImport';

export interface FilterOptions {
  excludeMastered?: boolean;    // 외운 단어 제외
  excludeBasic?: boolean;        // 기초 단어 (레벨 1) 제외
  minimumDifficulty?: number;    // 최소 난이도
}

export interface FilterResult {
  processedWords: ProcessedWord[];
  excludedCount: number;
  excludedWords: Array<{ word: string; reason: string }>;
}

/**
 * OCR 결과를 필터링하여 처리
 * - 외운 단어 자동 제외
 * - 기초 단어 제외 옵션
 * - 최소 난이도 필터링
 */
export async function processExtractedWordsWithFilter(
  ocrResult: OCRResult,
  cleanWordFn: (text: string) => string,
  filterOptions?: FilterOptions
): Promise<FilterResult> {
  console.log('🤖 GPT 스마트 사전을 사용한 단어 처리 시작 (필터링 적용)');

  // 기본 필터 옵션
  const options: Required<FilterOptions> = {
    excludeMastered: filterOptions?.excludeMastered ?? true,  // 기본: 외운 단어 제외
    excludeBasic: filterOptions?.excludeBasic ?? false,
    minimumDifficulty: filterOptions?.minimumDifficulty ?? 1
  };

  console.log('📋 필터 설정:', options);

  const processedWords: ProcessedWord[] = [];
  const excludedWords: Array<{ word: string; reason: string }> = [];

  try {
    // 1. 단어 정리 및 중복 제거
    const cleanedWords: string[] = [];
    const wordMapping: { [cleaned: string]: any[] } = {};

    for (const ocrWord of ocrResult.words) {
      const cleaned = cleanWordFn(ocrWord.text);

      if (cleaned.length < 2 || cleaned.length > 20) {
        continue;
      }

      if (!wordMapping[cleaned]) {
        wordMapping[cleaned] = [];
        cleanedWords.push(cleaned);
      }
      wordMapping[cleaned].push(ocrWord);
    }

    console.log(`📝 OCR에서 ${cleanedWords.length}개 단어 추출됨`);

    if (cleanedWords.length === 0) {
      return { processedWords, excludedCount: 0, excludedWords };
    }

    // 2. 학습 상태 조회 (배치)
    let masteryStatus: Map<string, any> | null = null;
    if (options.excludeMastered) {
      console.log('📊 학습 상태 조회 중... (모든 단어장 확인)');
      masteryStatus = await getWordsMasteryStatus(cleanedWords);
    }

    // 3. 필터링
    const filteredWords: string[] = [];

    for (const word of cleanedWords) {
      const status = masteryStatus?.get(word.toLowerCase());

      // 외운 단어 필터링
      if (status?.isMastered) {
        excludedWords.push({ word, reason: '외운 단어' });
        console.log(`  ⏭️ "${word}" - 외운 단어 (제외)`);
        continue;
      }

      // 기초 단어 필터링
      if (options.excludeBasic && status?.difficulty === 1) {
        excludedWords.push({ word, reason: '기초 단어' });
        console.log(`  ⏭️ "${word}" - 기초 단어 레벨 1 (제외)`);
        continue;
      }

      filteredWords.push(word);
    }

    console.log(`\n✅ 필터링 완료:`);
    console.log(`   - 포함: ${filteredWords.length}개`);
    console.log(`   - 제외: ${excludedWords.length}개`);

    // 4. 필터링된 단어만 GPT/캐시 조회
    if (filteredWords.length > 0) {
      console.log(`\n🔍 ${filteredWords.length}개 단어 정의 조회 중...`);
      const smartDefinitions = await smartDictionaryService.getWordDefinitions(filteredWords);

      for (const [cleaned, ocrWords] of Object.entries(wordMapping)) {
        if (!filteredWords.includes(cleaned)) {
          continue; // 필터링된 단어는 스킵
        }

        const smartDef = smartDefinitions.find(def =>
          def.word.toLowerCase() === cleaned.toLowerCase()
        );

        for (const ocrWord of ocrWords) {
          processedWords.push({
            original: ocrWord.text,
            cleaned,
            found: !!smartDef,
            wordData: smartDef,
            processing_source: smartDef?.source || 'none'
          });
        }
      }
    }

    // 제외된 단어 정보 반환 (UI에서 표시용)
    if (excludedWords.length > 0) {
      console.log(`\n📋 제외된 단어 목록:`);
      excludedWords.forEach(({ word, reason }) => {
        console.log(`   - ${word} (${reason})`);
      });
    }

    console.log(`\n✅ 최종 결과: ${processedWords.length}개 단어 처리 완료`);

    return {
      processedWords,
      excludedCount: excludedWords.length,
      excludedWords
    };

  } catch (error) {
    console.error('❌ 단어 처리 실패:', error);
    return { processedWords, excludedCount: 0, excludedWords };
  }
}
