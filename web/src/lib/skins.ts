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
}

export const DEFAULT_SKIN_ID = 'default';

export const SKIN_PRESETS: SkinPreset[] = [
  { id: 'default', label: '기본', swatch: '#4f46e5', themeColor: '#4F46E5' },
  { id: 'rose', label: '로즈', swatch: '#e11d48', themeColor: '#E11D48' },
  { id: 'lavender', label: '라벤더', swatch: '#7c3aed', themeColor: '#7C3AED' },
  { id: 'mint', label: '민트', swatch: '#0d9488', themeColor: '#0D9488' },
  { id: 'ocean', label: '오션', swatch: '#0284c7', themeColor: '#0284C7' },
  { id: 'cream', label: '크림', swatch: '#ea580c', themeColor: '#EA580C' },
];

export function getSkinPreset(id: string): SkinPreset | undefined {
  return SKIN_PRESETS.find((s) => s.id === id);
}
