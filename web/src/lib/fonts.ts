// 폰트 프리셋 카탈로그 - 무료 한글 폰트 (Google Fonts + Pretendard/jsdelivr)
// 폰트 CSS는 빌드에 포함하지 않고 선택 시 런타임에 <link>로 주입한다 (선택한 폰트만 로드)

export interface FontPreset {
  id: string;
  label: string;
  /** CSS font-family 이름 */
  family: string;
  /** 전체 CSS URL - 없으면 시스템 폰트 스택 사용 */
  cssUrl?: string;
  /** Google Fonts css2 family 파라미터 (미리보기 &text= 서브세팅용) - 없으면 cssUrl 그대로 미리보기 */
  googleFamily?: string;
}

export const DEFAULT_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const CUSTOM_FONT_FAMILY = 'ScanVocaCustom';
export const CUSTOM_FONT_ID = 'custom';

export const FONT_SAMPLE_TEXT = '가나다라 ABC 단어를 스캔하고 암기하세요';

const GOOGLE_CSS2 = 'https://fonts.googleapis.com/css2';

function googleUrl(family: string): string {
  return `${GOOGLE_CSS2}?family=${family}&display=swap`;
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'system', label: '기본', family: '' },
  {
    id: 'noto-sans-kr',
    label: '노토 산스',
    family: 'Noto Sans KR',
    googleFamily: 'Noto+Sans+KR:wght@100..900',
    cssUrl: googleUrl('Noto+Sans+KR:wght@100..900'),
  },
  {
    id: 'pretendard',
    label: '프리텐다드',
    family: 'Pretendard Variable',
    cssUrl:
      'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
  },
  {
    id: 'nanum-gothic',
    label: '나눔고딕',
    family: 'Nanum Gothic',
    googleFamily: 'Nanum+Gothic:wght@400;700',
    cssUrl: googleUrl('Nanum+Gothic:wght@400;700'),
  },
  {
    id: 'nanum-myeongjo',
    label: '나눔명조',
    family: 'Nanum Myeongjo',
    googleFamily: 'Nanum+Myeongjo:wght@400;700',
    cssUrl: googleUrl('Nanum+Myeongjo:wght@400;700'),
  },
  {
    id: 'gowun-dodum',
    label: '고운돋움',
    family: 'Gowun Dodum',
    googleFamily: 'Gowun+Dodum',
    cssUrl: googleUrl('Gowun+Dodum'),
  },
  {
    id: 'gowun-batang',
    label: '고운바탕',
    family: 'Gowun Batang',
    googleFamily: 'Gowun+Batang:wght@400;700',
    cssUrl: googleUrl('Gowun+Batang:wght@400;700'),
  },
  {
    id: 'ibm-plex-kr',
    label: 'IBM 플렉스',
    family: 'IBM Plex Sans KR',
    googleFamily: 'IBM+Plex+Sans+KR:wght@400;500;700',
    cssUrl: googleUrl('IBM+Plex+Sans+KR:wght@400;500;700'),
  },
  {
    id: 'jua',
    label: '주아',
    family: 'Jua',
    googleFamily: 'Jua',
    cssUrl: googleUrl('Jua'),
  },
  {
    id: 'do-hyeon',
    label: '도현',
    family: 'Do Hyeon',
    googleFamily: 'Do+Hyeon',
    cssUrl: googleUrl('Do+Hyeon'),
  },
  {
    id: 'gaegu',
    label: '개구',
    family: 'Gaegu',
    googleFamily: 'Gaegu:wght@400;700',
    cssUrl: googleUrl('Gaegu:wght@400;700'),
  },
  {
    id: 'nanum-pen',
    label: '나눔손글씨',
    family: 'Nanum Pen Script',
    googleFamily: 'Nanum+Pen+Script',
    cssUrl: googleUrl('Nanum+Pen+Script'),
  },
];

export function getFontPreset(id: string): FontPreset | undefined {
  return FONT_PRESETS.find((p) => p.id === id);
}

/** 미리보기용 URL - 샘플 문구에 쓰인 글자만 서브세팅해서 폰트당 몇 KB만 로드 */
export function buildPreviewUrl(preset: FontPreset): string | undefined {
  if (!preset.cssUrl) return undefined;
  if (!preset.googleFamily) return preset.cssUrl; // Pretendard 등 text= 미지원
  const uniqueChars = Array.from(new Set(FONT_SAMPLE_TEXT)).join('');
  return `${GOOGLE_CSS2}?family=${preset.googleFamily}&display=swap&text=${encodeURIComponent(uniqueChars)}`;
}
