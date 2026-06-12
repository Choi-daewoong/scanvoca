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
