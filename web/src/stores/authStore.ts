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
      set({ user, isLoading: false });
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
      set({ user, isLoading: false });
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      set({ isInitialized: true });
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
