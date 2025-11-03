import { SharedWordbook } from '../types/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, writeAsStringAsync, deleteAsync, EncodingType } from 'expo-file-system/legacy';
import { wordbookService } from './wordbookService';

/**
 * 공유 코드 생성 (6자리 랜덤 코드)
 */
export function generateSharingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 단어장을 JSON 파일로 Export
 * @param wordbookId - Export할 단어장 ID
 * @returns JSON 문자열
 */
export async function exportWordbookToFile(wordbookId: number): Promise<string> {
  try {
    console.log(`📤 단어장 ${wordbookId} Export 시작`);

    // 1. 단어장 메타데이터 조회
    const wordbooks = await wordbookService.getWordbooks();
    const wordbook = wordbooks.find(wb => wb.id === wordbookId);

    if (!wordbook) {
      throw new Error('단어장을 찾을 수 없습니다.');
    }

    // 2. 단어 데이터 조회
    const words = await wordbookService.getWordbookWords(wordbookId);

    if (words.length === 0) {
      throw new Error('단어장에 단어가 없습니다.');
    }

    console.log(`📝 ${words.length}개 단어 Export 중...`);

    // 3. 난이도 분포 계산
    const difficultyDistribution: Record<number, number> = {};
    words.forEach((word: any) => {
      const difficulty = word.difficulty || 1;
      difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
    });

    // 4. SharedWordbook 형식으로 변환
    const sharedWordbook: SharedWordbook = {
      id: `shared_${wordbookId}_${Date.now()}`,
      name: wordbook.name,
      description: wordbook.description || '',
      words: words.map((word: any) => ({
        word: word.word,
        pronunciation: word.pronunciation,
        difficulty: word.difficulty,
        meanings: word.meanings,
        confidence: 1.0,
        source: word.source || 'gpt'
      })),
      metadata: {
        created_at: new Date().toISOString(),
        word_count: words.length,
        difficulty_distribution: difficultyDistribution,
        tags: []
      },
      sharing_code: generateSharingCode()
    };

    // 5. JSON 문자열로 직렬화
    const jsonString = JSON.stringify(sharedWordbook, null, 2);
    console.log(`✅ Export 완료: ${jsonString.length} bytes`);

    return jsonString;

  } catch (error) {
    console.error('Failed to export wordbook:', error);
    throw error;
  }
}

/**
 * Import할 데이터 검증
 * @param data - SharedWordbook 객체
 * @returns 검증 결과
 */
export function validateSharedWordbook(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 필수 필드 확인
  if (!data.name || typeof data.name !== 'string') {
    errors.push('단어장 이름이 없습니다.');
  }

  if (!Array.isArray(data.words)) {
    errors.push('단어 목록이 올바르지 않습니다.');
  } else if (data.words.length === 0) {
    errors.push('단어가 하나도 없습니다.');
  } else {
    // 각 단어 구조 확인
    for (let i = 0; i < Math.min(data.words.length, 10); i++) {
      const word = data.words[i];
      if (!word.word || !word.meanings || !Array.isArray(word.meanings)) {
        errors.push(`단어 ${i + 1}의 구조가 올바르지 않습니다.`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * JSON 파일에서 단어장 Import
 * @param jsonData - SharedWordbook JSON 문자열
 * @returns 생성된 새 단어장 ID
 */
export async function importWordbookFromFile(jsonData: string): Promise<number> {
  try {
    console.log(`📥 단어장 Import 시작`);

    // 1. JSON 파싱
    let sharedWordbook: SharedWordbook;
    try {
      sharedWordbook = JSON.parse(jsonData);
    } catch (error) {
      throw new Error('파일을 읽을 수 없습니다.');
    }

    // 2. 데이터 검증
    const validation = validateSharedWordbook(sharedWordbook);
    if (!validation.valid) {
      throw new Error(`올바른 단어장 파일이 아닙니다: ${validation.errors.join(', ')}`);
    }

    console.log(`📝 "${sharedWordbook.name}" Import 중 (${sharedWordbook.words.length}개 단어)`);

    // 3. 중복 이름 처리
    const existingWordbooks = await wordbookService.getWordbooks();
    let finalName = sharedWordbook.name;
    let counter = 2;

    while (existingWordbooks.some(wb => wb.name.toLowerCase() === finalName.toLowerCase())) {
      finalName = `${sharedWordbook.name} (${counter})`;
      counter++;
    }

    // 4. 새 단어장 생성
    const newWordbookId = await wordbookService.createWordbook(finalName, sharedWordbook.description);

    // 5. 단어 데이터 저장
    const wordbookKey = `wordbook_${newWordbookId}`;
    const wordsToSave = sharedWordbook.words.map((word: any, index: number) => ({
      id: Date.now() + index, // 고유 ID 생성
      word: word.word,
      pronunciation: word.pronunciation,
      difficulty: word.difficulty,
      meanings: word.meanings,
      addedAt: new Date().toISOString(),
      source: word.source || 'gpt'
    }));

    await AsyncStorage.setItem(wordbookKey, JSON.stringify(wordsToSave));

    console.log(`✅ Import 완료: "${finalName}" (ID: ${newWordbookId})`);

    return newWordbookId;

  } catch (error) {
    console.error('Failed to import wordbook:', error);
    throw error;
  }
}

/**
 * 단어장을 네이티브 공유 다이얼로그로 공유
 * @param wordbookId - 공유할 단어장 ID
 */
export async function shareWordbook(wordbookId: number): Promise<void> {
  try {
    console.log(`📤 단어장 ${wordbookId} 공유 시작`);

    // 1. Export 함수로 JSON 생성
    const jsonString = await exportWordbookToFile(wordbookId);

    // 2. 단어장 정보 조회 (파일명 생성용)
    const wordbooks = await wordbookService.getWordbooks();
    const wordbook = wordbooks.find(wb => wb.id === wordbookId);
    const fileName = `${wordbook?.name || 'wordbook'}_${Date.now()}.json`
      .replace(/[^a-zA-Z0-9가-힣_\-]/g, '_'); // 특수문자 제거

    // 3. FileSystem에 임시 파일 저장
    const fileUri = `${cacheDirectory}${fileName}`;
    await writeAsStringAsync(fileUri, jsonString, {
      encoding: EncodingType.UTF8
    });

    console.log(`💾 임시 파일 생성: ${fileUri}`);

    // 4. 동적으로 expo-sharing import
    const Sharing = await import('expo-sharing');

    // 5. 공유 가능 여부 확인
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('이 기기에서는 공유 기능을 사용할 수 없습니다.');
    }

    // 6. expo-sharing 호출
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: '단어장 공유',
      UTI: 'public.json'
    });

    console.log(`✅ 공유 완료`);

    // 7. 공유 완료 후 임시 파일 삭제
    try {
      await deleteAsync(fileUri, { idempotent: true });
      console.log(`🗑️ 임시 파일 삭제 완료`);
    } catch (error) {
      console.warn('임시 파일 삭제 실패:', error);
    }

  } catch (error) {
    console.error('Failed to share wordbook:', error);
    throw error;
  }
}

/**
 * 모든 단어장에서 특정 단어의 학습 상태 조회
 *
 * 중요: 같은 단어가 여러 단어장에 있는 경우
 * → 하나라도 외운 것으로 표시되어 있으면 외운 것으로 간주!
 *
 * @param word - 확인할 단어
 * @returns 학습 상태
 */
export async function getWordMasteryStatus(word: string): Promise<{
  isMastered: boolean;
  correctCount: number;
  incorrectCount: number;
  difficulty?: number;
}> {
  try {
    const wordbooks = await wordbookService.getWordbooks();

    let maxCorrectCount = 0;
    let maxIncorrectCount = 0;
    let foundDifficulty: number | undefined;

    // 모든 단어장에서 해당 단어 찾기
    for (const wordbook of wordbooks) {
      const words = await wordbookService.getWordbookWords(wordbook.id);
      const found = words.find((w: any) =>
        w.word.toLowerCase() === word.toLowerCase()
      );

      if (found) {
        // 가장 높은 correct_count 찾기
        const correctCount = found.study_progress?.correct_count || 0;
        const incorrectCount = found.study_progress?.incorrect_count || 0;

        if (correctCount > maxCorrectCount) {
          maxCorrectCount = correctCount;
          maxIncorrectCount = incorrectCount;
          foundDifficulty = found.difficulty;
        }

        console.log(`  - 단어장 "${wordbook.name}": correct=${correctCount}, incorrect=${incorrectCount}`);
      }
    }

    // 외운 기준: correct >= 3 && correct > incorrect
    const isMastered = maxCorrectCount >= 3 && maxCorrectCount > maxIncorrectCount;

    console.log(`✅ "${word}": 외움=${isMastered} (최고 correct=${maxCorrectCount})`);

    return {
      isMastered,
      correctCount: maxCorrectCount,
      incorrectCount: maxIncorrectCount,
      difficulty: foundDifficulty
    };

  } catch (error) {
    console.error('학습 상태 조회 실패:', error);
    return {
      isMastered: false,
      correctCount: 0,
      incorrectCount: 0
    };
  }
}

/**
 * 여러 단어의 학습 상태를 배치로 조회
 */
export async function getWordsMasteryStatus(words: string[]): Promise<Map<string, {
  isMastered: boolean;
  difficulty?: number;
}>> {
  const statusMap = new Map();

  console.log(`📊 ${words.length}개 단어의 학습 상태 조회 시작...`);

  for (const word of words) {
    const status = await getWordMasteryStatus(word);
    statusMap.set(word.toLowerCase(), {
      isMastered: status.isMastered,
      difficulty: status.difficulty
    });
  }

  const masteredCount = Array.from(statusMap.values())
    .filter(s => s.isMastered).length;

  console.log(`✅ 조회 완료: ${masteredCount}개 외움, ${words.length - masteredCount}개 미암기`);

  return statusMap;
}
