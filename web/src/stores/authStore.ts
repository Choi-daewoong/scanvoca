'use client';

import { create } from 'zustand';
import { User } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string, persistent?: boolean) => Promise<void>;
  googleLogin: (idToken: string, persistent?: boolean) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async (email, password, persistent = false) => {
    set({ isLoading: true });
    try {
      await authService.login(email, password, persistent);
      const user = await authService.getMe();
      set({ user, isLoading: false, isInitialized: true });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  googleLogin: async (idToken, persistent = false) => {
    set({ isLoading: true });
    try {
      await authService.googleLogin(idToken, persistent);
      const user = await authService.getMe();
      set({ user, isLoading: false, isInitialized: true });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    authService.logout();
    set({ user: null });
  },

  loadUser: async () => {
    if (typeof window === 'undefined') {
      set({ isInitialized: true });
      return;
    }
    // sessionStorage(로그인 유지 OFF)와 localStorage(로그인 유지 ON) 모두 확인
    const token = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
    if (!token) {
      // 토큰이 전혀 없는 첫 방문 - 조용히 게스트 세션을 발급받아 이어간다
      try {
        await authService.guestLogin();
        const user = await authService.getMe();
        set({ user, isInitialized: true });
      } catch {
        set({ user: null, isInitialized: true });
      }
      return;
    }
    try {
      const user = await authService.getMe();
      set({ user, isInitialized: true });
    } catch {
      set({ user: null, isInitialized: true });
    }
  },

  setUser: (user) => set({ user }),
}));
