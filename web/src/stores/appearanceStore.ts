'use client';

// 폰트/스킨 설정 스토어 - themeStore(다크모드)와 동일한 apply/init/set 패턴
// 기기별 저장: 선택값은 localStorage, 커스텀 폰트 바이너리는 IndexedDB
// layout.tsx의 인라인 부트스트랩 스크립트가 paint 전에 같은 키를 읽어 FOUC를 막는다

import { create } from 'zustand';
import {
  CUSTOM_FONT_FAMILY,
  CUSTOM_FONT_ID,
  DEFAULT_FONT_STACK,
  getFontPreset,
} from '@/lib/fonts';
import { DEFAULT_SKIN_ID, getSkinPreset } from '@/lib/skins';
import {
  deleteCustomFont,
  loadCustomFont,
  registerCustomFont,
  saveCustomFont,
  validateFontFile,
} from '@/lib/customFont';

const FONT_KEY = 'scan_voca_font';
const SKIN_KEY = 'scan_voca_skin';
const FONT_LINK_ID = 'app-font-css';

interface StoredFont {
  id: string;
  family: string;
  cssUrl?: string;
}

function applyFont(family: string, cssUrl?: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (family) {
    root.style.setProperty('--app-font', `'${family}', ${DEFAULT_FONT_STACK}`);
  } else {
    root.style.removeProperty('--app-font');
  }
  // 링크는 id로 하나만 재사용 (폰트 전환 시 누적 방지)
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (cssUrl) {
    if (!link) {
      link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== cssUrl) link.href = cssUrl;
  } else if (link) {
    link.remove();
  }
}

function applySkin(skinId: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (skinId === DEFAULT_SKIN_ID) {
    root.removeAttribute('data-skin');
  } else {
    root.setAttribute('data-skin', skinId);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  const skin = getSkinPreset(skinId);
  if (meta && skin) meta.setAttribute('content', skin.themeColor);
}

function persistFont(stored: StoredFont) {
  localStorage.setItem(FONT_KEY, JSON.stringify(stored));
}

interface AppearanceState {
  fontId: string;
  skinId: string;
  customFontName: string | null;
  setFont: (id: string) => void;
  setSkin: (id: string) => void;
  uploadCustomFont: (file: File) => Promise<void>;
  removeCustomFont: () => Promise<void>;
  initAppearance: () => Promise<void>;
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  fontId: 'system',
  skinId: DEFAULT_SKIN_ID,
  customFontName: null,

  setFont: (id) => {
    if (id === CUSTOM_FONT_ID) {
      if (!get().customFontName) return; // 업로드된 폰트가 없으면 무시
      persistFont({ id, family: CUSTOM_FONT_FAMILY });
      applyFont(CUSTOM_FONT_FAMILY);
      set({ fontId: id });
      return;
    }
    const preset = getFontPreset(id);
    if (!preset) return;
    persistFont({ id: preset.id, family: preset.family, cssUrl: preset.cssUrl });
    applyFont(preset.family, preset.cssUrl);
    set({ fontId: preset.id });
  },

  setSkin: (id) => {
    if (!getSkinPreset(id)) return;
    localStorage.setItem(SKIN_KEY, id);
    applySkin(id);
    set({ skinId: id });
  },

  uploadCustomFont: async (file) => {
    const error = await validateFontFile(file);
    if (error) throw new Error(error);
    const data = await file.arrayBuffer();
    try {
      await registerCustomFont(data);
    } catch {
      throw new Error('폰트를 불러올 수 없습니다. 파일이 손상되었을 수 있어요.');
    }
    await saveCustomFont({ name: file.name, data, addedAt: Date.now() });
    set({ customFontName: file.name });
    get().setFont(CUSTOM_FONT_ID);
  },

  removeCustomFont: async () => {
    await deleteCustomFont();
    set({ customFontName: null });
    if (get().fontId === CUSTOM_FONT_ID) {
      get().setFont('system');
    }
  },

  initAppearance: async () => {
    if (typeof window === 'undefined') return;

    // 스킨 하이드레이트
    const storedSkin = localStorage.getItem(SKIN_KEY);
    const skinId = storedSkin && getSkinPreset(storedSkin) ? storedSkin : DEFAULT_SKIN_ID;
    applySkin(skinId);
    set({ skinId });

    // 커스텀 폰트 존재 여부는 항상 확인 (피커에 "내 글꼴" 노출용)
    let customRecord: Awaited<ReturnType<typeof loadCustomFont>> = null;
    try {
      customRecord = await loadCustomFont();
    } catch {
      customRecord = null;
    }
    set({ customFontName: customRecord?.name ?? null });

    // 폰트 하이드레이트
    let storedFont: StoredFont | null = null;
    try {
      const raw = localStorage.getItem(FONT_KEY);
      if (raw) storedFont = JSON.parse(raw);
    } catch {
      storedFont = null;
    }
    if (!storedFont) return;

    if (storedFont.id === CUSTOM_FONT_ID) {
      if (!customRecord) {
        // 사이트 데이터 삭제 등으로 레코드가 사라진 경우 - 기본으로 리셋
        localStorage.removeItem(FONT_KEY);
        applyFont('');
        set({ fontId: 'system' });
        return;
      }
      try {
        await registerCustomFont(customRecord.data);
        applyFont(CUSTOM_FONT_FAMILY);
        set({ fontId: CUSTOM_FONT_ID });
      } catch {
        localStorage.removeItem(FONT_KEY);
        applyFont('');
        set({ fontId: 'system' });
      }
      return;
    }

    const preset = getFontPreset(storedFont.id);
    if (!preset) {
      localStorage.removeItem(FONT_KEY);
      applyFont('');
      set({ fontId: 'system' });
      return;
    }
    applyFont(preset.family, preset.cssUrl);
    set({ fontId: preset.id });
  },
}));
