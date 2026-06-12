const POS_MAP: Record<string, string> = {
  noun: '명',
  pronoun: '대',
  verb: '동',
  adjective: '형',
  adverb: '부',
  preposition: '전',
  conjunction: '접',
  interjection: '감',
  determiner: '관',
  article: '관',
  numeral: '수',
  number: '수',
  auxiliary: '조동',
  'auxiliary verb': '조동',
  'modal verb': '조동',
  prefix: '접두',
  suffix: '접미',
  idiom: '숙어',
  phrase: '숙어',
  abbreviation: '약어',
};

/**
 * 영어 품사 표기를 한글 약자로 변환합니다 (예: "noun" -> "명").
 * 매핑되지 않는 값은 원본 텍스트를 그대로 반환합니다.
 */
export function formatPartOfSpeech(pos: string | undefined | null): string {
  if (!pos) return '';
  const key = pos.trim().toLowerCase();
  return POS_MAP[key] ?? pos;
}

/** 뜻 수정 화면 등에서 사용할 품사 선택 옵션 목록 */
export const PART_OF_SPEECH_OPTIONS: { value: string; label: string }[] = [
  { value: 'noun', label: '명사' },
  { value: 'pronoun', label: '대명사' },
  { value: 'verb', label: '동사' },
  { value: 'adjective', label: '형용사' },
  { value: 'adverb', label: '부사' },
  { value: 'preposition', label: '전치사' },
  { value: 'conjunction', label: '접속사' },
  { value: 'interjection', label: '감탄사' },
  { value: 'determiner', label: '관사/한정사' },
  { value: 'auxiliary verb', label: '조동사' },
  { value: 'idiom', label: '숙어' },
  { value: 'phrase', label: '구동사' },
];
