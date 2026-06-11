'use client';

import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'scan_voca_theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  initTheme: () => {
    const stored = localStorage.getItem(THEME_KEY);
    const theme: Theme = stored === 'dark' ? 'dark' : 'light';
    applyTheme(theme);
    set({ theme });
  },
}));
