/**
 * 품사(Part of Speech) 관련 유틸리티 함수
 *
 * 데이터베이스에는 영어로 저장되지만, UI에서는 한글로 표시하기 위한 변환 함수
 */

// 품사 영어 → 한글 매핑
export const PART_OF_SPEECH_MAP: Record<string, string> = {
  // 표준 품사
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  preposition: '전치사',
  conjunction: '접속사',
  interjection: '감탄사',
  pronoun: '대명사',
  determiner: '한정사',

  // 추가 품사
  article: '관사',
  'modal verb': '조동사',
  number: '수사',

  // 약어 (일부 데이터에서 사용될 수 있음)
  n: '명사',
  v: '동사',
  adj: '형용사',
  adv: '부사',
  prep: '전치사',
  conj: '접속사',
  interj: '감탄사',
  pron: '대명사',
  det: '한정사',

  // 한글 입력 (GPT가 한글로 반환한 경우 그대로 유지)
  명사: '명사',
  동사: '동사',
  형용사: '형용사',
  부사: '부사',
  전치사: '전치사',
  접속사: '접속사',
  감탄사: '감탄사',
  대명사: '대명사',
  한정사: '한정사',
  관사: '관사',
  조동사: '조동사',
  수사: '수사',
};

// 품사 한글 → 영어 매핑 (역변환)
export const PART_OF_SPEECH_REVERSE_MAP: Record<string, string> = {
  명사: 'noun',
  동사: 'verb',
  형용사: 'adjective',
  부사: 'adverb',
  전치사: 'preposition',
  접속사: 'conjunction',
  감탄사: 'interjection',
  대명사: 'pronoun',
  한정사: 'determiner',
};

/**
 * 품사를 한글로 변환
 * @param partOfSpeech - 영어 또는 한글 품사
 * @returns 한글 품사 (매핑이 없으면 원본 그대로 반환)
 */
export function getPartOfSpeechKorean(partOfSpeech: string | undefined): string {
  if (!partOfSpeech) return '';

  const trimmed = partOfSpeech.trim();

  // 복합 품사 처리 (예: "noun, verb" → "명사, 동사")
  if (trimmed.includes(',') || trimmed.includes('/')) {
    const parts = trimmed.split(/[,/]/).map(p => p.trim());
    const koreanParts = parts.map(p => {
      const normalized = p.toLowerCase();
      return PART_OF_SPEECH_MAP[normalized] || p;
    });
    return koreanParts.join(', ');
  }

  const normalized = trimmed.toLowerCase();
  return PART_OF_SPEECH_MAP[normalized] || partOfSpeech;
}

/**
 * 품사를 영어 표준 형식으로 정규화
 * @param partOfSpeech - 영어, 한글, 또는 약어 품사
 * @returns 영어 표준 품사 (noun, verb, adjective 등)
 */
export function normalizePartOfSpeech(partOfSpeech: string | undefined): string {
  if (!partOfSpeech) return 'noun'; // 기본값

  const trimmed = partOfSpeech.trim();

  // 이미 한글인 경우 영어로 변환
  if (PART_OF_SPEECH_REVERSE_MAP[trimmed]) {
    return PART_OF_SPEECH_REVERSE_MAP[trimmed];
  }

  // 영어나 약어인 경우 표준 형식으로 변환
  const normalized = trimmed.toLowerCase();

  // 약어 매핑
  const abbreviationMap: Record<string, string> = {
    n: 'noun',
    v: 'verb',
    adj: 'adjective',
    adv: 'adverb',
    prep: 'preposition',
    conj: 'conjunction',
    interj: 'interjection',
    pron: 'pronoun',
    det: 'determiner',
  };

  if (abbreviationMap[normalized]) {
    return abbreviationMap[normalized];
  }

  // 이미 표준 형식인 경우
  const standardForms = [
    'noun', 'verb', 'adjective', 'adverb',
    'preposition', 'conjunction', 'interjection',
    'pronoun', 'determiner'
  ];

  if (standardForms.includes(normalized)) {
    return normalized;
  }

  // 알 수 없는 형식이면 기본값 반환
  console.warn(`Unknown part of speech: "${partOfSpeech}", defaulting to "noun"`);
  return 'noun';
}

/**
 * EditWordModal에서 사용하는 품사 옵션
 */
export const PART_OF_SPEECH_OPTIONS = [
  { value: 'noun', label: '명사' },
  { value: 'verb', label: '동사' },
  { value: 'adjective', label: '형용사' },
  { value: 'adverb', label: '부사' },
  { value: 'preposition', label: '전치사' },
  { value: 'conjunction', label: '접속사' },
  { value: 'interjection', label: '감탄사' },
  { value: 'pronoun', label: '대명사' },
  { value: 'determiner', label: '한정사' },
];
