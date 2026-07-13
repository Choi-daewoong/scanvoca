// 스킨(풀 테마) 카탈로그 - 실제 색상 정의는 globals.css의 html[data-skin] 블록에 있음
// 포인트 색(indigo 램프)과 중립색(gray 램프·white)을 CSS 변수로 통째로 덮어쓰는 방식이라
// 컴포넌트 코드 수정 없이 전체 앱이 리테마된다

export interface SkinPreset {
  id: string;
  label: string;
  /** 설정 페이지 스와치 도트 색 (포인트 600 단계) */
  swatch: string;
  /** <meta name="theme-color"> 갱신용 */
  themeColor: string;
  /** 활성 탭 아이콘에 붙는 테마 모티프 (24x24 viewBox 채움 패스) - 없으면 장식 없음 */
  motifPath?: string;
}

export const DEFAULT_SKIN_ID = 'default';

export const SKIN_PRESETS: SkinPreset[] = [
  { id: 'default', label: '기본', swatch: '#4f46e5', themeColor: '#4F46E5' },
  {
    id: 'rose',
    label: '로즈',
    swatch: '#e11d48',
    themeColor: '#E11D48',
    // 하트
    motifPath:
      'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  },
  {
    id: 'lavender',
    label: '라벤더',
    swatch: '#7c3aed',
    themeColor: '#7C3AED',
    // 반짝이 (4방향 별)
    motifPath: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z',
  },
  {
    id: 'mint',
    label: '민트',
    swatch: '#0d9488',
    themeColor: '#0D9488',
    // 잎사귀
    motifPath: 'M12 2c5.5 5.5 5.5 13 0 20-5.5-7-5.5-14.5 0-20z',
  },
  {
    id: 'ocean',
    label: '오션',
    swatch: '#0284c7',
    themeColor: '#0284C7',
    // 물방울
    motifPath: 'M12 2c4 5.5 7 9.2 7 13a7 7 0 11-14 0c0-3.8 3-7.5 7-13z',
  },
  {
    id: 'cream',
    label: '크림',
    swatch: '#ea580c',
    themeColor: '#EA580C',
    // 도트
    motifPath: 'M12 6a6 6 0 110 12 6 6 0 010-12z',
  },
];

export function getSkinPreset(id: string): SkinPreset | undefined {
  return SKIN_PRESETS.find((s) => s.id === id);
}
