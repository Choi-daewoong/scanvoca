// src/stores/authStore.ts

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../utils/api';
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  SocialLoginRequest,
  SocialLoginResult,
} from '../types/auth';

interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  isLoading: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  socialLogin: (request: SocialLoginRequest) => Promise<void>;
  updateProfile: (profileData: Partial<User>) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      refresh_token: null,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        try {
          console.log('[AuthStore] 로그인 시도:', credentials.email);
          set({ isLoading: true });

          // FormData 형태로 전송 (백엔드가 OAuth2 형식 기대)
          const formData = new URLSearchParams();
          formData.append('username', credentials.email);
          formData.append('password', credentials.password);

          const response = await apiClient.post<AuthResponse>(
            '/auth/login',
            formData.toString(),
            {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          );

          const { user, access_token, refresh_token } = response.data;

          if (!access_token || !user) {
            throw new Error('로그인 응답에 필수 데이터가 없습니다.');
          }

          // API 클라이언트에 토큰 설정
          apiClient.setAuthToken(access_token);

          set({
            user: { ...user, id: String(user.id) },
            access_token,
            refresh_token,
            isLoading: false,
          });

          console.log('[AuthStore] 로그인 성공:', user.email);
        } catch (error: any) {
          console.error('[AuthStore] 로그인 실패:', error.message);
          set({ isLoading: false });
          throw new Error(error.message || '로그인에 실패했습니다.');
        }
      },

      register: async (userData: RegisterData) => {
        try {
          console.log('[AuthStore] 회원가입 시도:', userData.email);
          set({ isLoading: true });

          const payload = {
            email: userData.email,
            username: userData.name,
            password: userData.password,
            full_name: userData.name,
            role: userData.role.toUpperCase(),
            phone: userData.phone,
          };

          await apiClient.post('/auth/register', payload);

          set({ isLoading: false });
          console.log('[AuthStore] 회원가입 성공');
        } catch (error: any) {
          console.error('[AuthStore] 회원가입 실패:', error.message);
          set({ isLoading: false });
          throw new Error(error.message || '회원가입에 실패했습니다.');
        }
      },

      socialLogin: async (request: SocialLoginRequest) => {
        try {
          console.log('[AuthStore] 소셜 로그인 시도:', request.provider);
          set({ isLoading: true });

          let endpoint = '';
          switch (request.provider) {
            case 'google':
              endpoint = '/auth/google';
              break;
            case 'apple':
              endpoint = '/auth/apple';
              break;
            case 'naver':
              endpoint = '/auth/naver';
              break;
            case 'kakao':
              endpoint = '/auth/kakao';
              break;
            default:
              throw new Error('지원하지 않는 소셜 로그인 제공자입니다.');
          }

          const payload = {
            provider: request.provider.toUpperCase(),
            code: request.code,
            id_token: request.id_token,
            state: request.state,
          };

          const response = await apiClient.post<SocialLoginResult>(endpoint, payload);
          const { user, access_token, refresh_token } = response.data;

          apiClient.setAuthToken(access_token);

          set({
            user: { ...user, id: String(user.id) },
            access_token,
            refresh_token,
            isLoading: false,
          });

          console.log('[AuthStore] 소셜 로그인 성공:', user.email);
        } catch (error: any) {
          console.error('[AuthStore] 소셜 로그인 실패:', error.message);
          set({ isLoading: false });
          throw new Error(error.message || '소셜 로그인에 실패했습니다.');
        }
      },

      refreshAccessToken: async () => {
        try {
          const { refresh_token } = get();
          if (!refresh_token) {
            console.log('[AuthStore] 리프레시 토큰이 없습니다.');
            return false;
          }

          console.log('[AuthStore] 토큰 갱신 시도');
          const response = await apiClient.post<AuthResponse>('/auth/refresh', {
            refresh_token,
          });

          const { user, access_token, refresh_token: new_refresh_token } = response.data;

          apiClient.setAuthToken(access_token);

          set({
            user: { ...user, id: String(user.id) },
            access_token,
            refresh_token: new_refresh_token,
          });

          console.log('[AuthStore] 토큰 갱신 성공');
          return true;
        } catch (error: any) {
          console.error('[AuthStore] 토큰 갱신 실패:', error.message);
          // 토큰 갱신 실패 시 로그아웃
          get().logout();
          return false;
        }
      },

      logout: async () => {
        try {
          console.log('[AuthStore] 로그아웃 진행');

          // API 클라이언트에서 토큰 제거
          apiClient.removeAuthToken();

          // 상태 클리어
          set({
            user: null,
            access_token: null,
            refresh_token: null,
            isLoading: false,
          });

          console.log('[AuthStore] 로그아웃 완료');
        } catch (error) {
          console.error('[AuthStore] 로그아웃 중 오류:', error);
          // 오류가 발생해도 강제로 클리어
          set({
            user: null,
            access_token: null,
            refresh_token: null,
            isLoading: false,
          });
        }
      },

      updateProfile: async (profileData: Partial<User>) => {
        try {
          console.log('[AuthStore] 프로필 업데이트 시도');
          const { user: currentUser } = get();

          const response = await apiClient.patch<User>('/auth/me/profile', profileData);
          const updatedUser = response.data;

          const newUser = {
            ...updatedUser,
            role: currentUser?.role || 'USER',
            id: String(updatedUser.id || currentUser?.id),
          };

          set({ user: newUser });
          console.log('[AuthStore] 프로필 업데이트 성공');
        } catch (error: any) {
          console.error('[AuthStore] 프로필 업데이트 실패:', error.message);
          throw new Error(error.message || '프로필 업데이트에 실패했습니다.');
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
        apiClient.setAuthToken(accessToken);
        set({ access_token: accessToken, refresh_token: refreshToken });
      },

      setUser: (user: User) => {
        set({ user: { ...user, id: String(user.id) } });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        access_token: state.access_token,
        refresh_token: state.refresh_token,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[AuthStore] 스토리지에서 상태 복원');

        if (state?.access_token) {
          // API 클라이언트에 토큰 설정
          apiClient.setAuthToken(state.access_token);

          // 사용자 ID를 문자열로 변환
          if (state.user && state.user.id !== undefined) {
            state.user.id = String(state.user.id);
          }

          console.log('[AuthStore] 토큰 복원 완료');
        } else {
          console.log('[AuthStore] 저장된 토큰이 없습니다.');
        }
      },
    }
  )
);