/**
 * AsyncStorage 키 상수 정의
 *
 * ⭐ 가상 단어장 아키텍처 (2025-11-04)
 * - 단어장: wordbook_{id} 형식으로 저장
 * - 사용자 기본값: user_custom_defaults 키에 저장
 */

export const STORAGE_KEYS = {
  // 사용자 커스텀 기본값 (모든 단어장에 적용)
  USER_CUSTOM_DEFAULTS: 'user_custom_defaults',

  // 단어장 프리픽스 (실제 키: wordbook_1, wordbook_2 등)
  WORDBOOK_PREFIX: 'wordbook_',

  // 단어장 메타데이터 목록
  WORDBOOKS_LIST: 'wordbooks_list',

  // 사용자 설정
  USER_SETTINGS: 'user_settings',

  // 인증 토큰
  AUTH_TOKEN: 'auth_token',

  // OCR 필터 설정
  OCR_FILTER_SETTINGS: 'ocr_filter_settings',
} as const;

/**
 * 단어장 키 생성 헬퍼 함수
 * @param wordbookId 단어장 ID
 * @returns wordbook_{id} 형식의 키
 */
export function getWordbookKey(wordbookId: number): string {
  return `${STORAGE_KEYS.WORDBOOK_PREFIX}${wordbookId}`;
}

/**
 * 단어장 키에서 ID 추출 헬퍼 함수
 * @param key wordbook_{id} 형식의 키
 * @returns 단어장 ID (실패 시 null)
 */
export function parseWordbookKey(key: string): number | null {
  if (!key.startsWith(STORAGE_KEYS.WORDBOOK_PREFIX)) {
    return null;
  }

  const id = parseInt(key.substring(STORAGE_KEYS.WORDBOOK_PREFIX.length));
  return isNaN(id) ? null : id;
}
