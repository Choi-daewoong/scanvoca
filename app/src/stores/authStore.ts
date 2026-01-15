// src/stores/authStore.ts
/**
 * Phase 1: 로컬 전용 인증 시스템 (AsyncStorage)
 * Phase 2: 백엔드 서버 연동으로 전환 예정
 *
 * WARNING: Phase 1에서는 비밀번호를 평문으로 저장합니다.
 * 이는 MVP 테스트용이며, Phase 2에서 서버 기반 인증으로 전환됩니다.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import type {
  User,
  LoginCredentials,
  RegisterData,
  SocialLoginRequest,
} from '../types/auth';

// 로컬 사용자 저장 키
const LOCAL_USERS_KEY = '@local_users';

// 로컬 사용자 데이터 구조
interface LocalUser {
  id: string;
  email: string;
  password: string; // Phase 1: 평문 저장 (MVP용)
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// UUID 생성 함수 (간단한 버전)
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// 로컬 사용자 DB 헬퍼 함수들
const localUserDB = {
  async getAll(): Promise<LocalUser[]> {
    try {
      const data = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('[LocalUserDB] 사용자 목록 조회 실패:', error);
      return [];
    }
  },

  async save(users: LocalUser[]): Promise<void> {
    try {
      await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    } catch (error) {
      logger.error('[LocalUserDB] 사용자 목록 저장 실패:', error);
      throw error;
    }
  },

  async findByEmail(email: string): Promise<LocalUser | null> {
    const users = await this.getAll();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async create(userData: Omit<LocalUser, 'id' | 'created_at' | 'updated_at'>): Promise<LocalUser> {
    const users = await this.getAll();

    // 이메일 중복 확인
    const exists = users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase());
    if (exists) {
      throw new Error('이미 사용 중인 이메일입니다.');
    }

    const newUser: LocalUser = {
      ...userData,
      id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    users.push(newUser);
    await this.save(users);
    return newUser;
  },

  async update(userId: string, updates: Partial<LocalUser>): Promise<LocalUser> {
    const users = await this.getAll();
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    users[index] = {
      ...users[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await this.save(users);
    return users[index];
  },
};

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
          logger.debug('[AuthStore] 백엔드 로그인 시도:', credentials.email);
          set({ isLoading: true });

          // 백엔드 API 호출
          const { apiService } = await import('../services/apiService');
          const response = await apiService.login({
            email: credentials.email,
            password: credentials.password,
          });

          // 사용자 정보 가져오기
          apiService.setAuthToken(response.access_token);
          const userProfile = await apiService.getMe();

          // User 객체 생성
          const user: User = {
            id: String(userProfile.id),
            email: userProfile.email,
            username: userProfile.display_name || userProfile.email,
            full_name: userProfile.display_name || userProfile.email,
            role: 'user' as any,
            is_active: userProfile.is_active,
            is_approved: userProfile.is_verified,
            is_superuser: false,
            created_at: userProfile.created_at,
            updated_at: userProfile.updated_at,
          };

          set({
            user,
            access_token: response.access_token,
            refresh_token: response.refresh_token,
            isLoading: false,
          });

          logger.info('[AuthStore] 백엔드 로그인 성공:', user.email);

          // 로그인 후 기본 단어장 생성 확인
          logger.debug('[AuthStore] 기본 단어장 생성 확인 중...');
          const { initialDataService } = await import('../services/initialDataService');
          await initialDataService.setupInitialWordbooks();
        } catch (error: any) {
          logger.error('[AuthStore] 백엔드 로그인 실패:', error);
          set({ isLoading: false });
          throw new Error(error.message || '로그인에 실패했습니다.');
        }
      },

      register: async (userData: RegisterData) => {
        try {
          logger.debug('[AuthStore] 백엔드 회원가입 시도:', userData.email);
          set({ isLoading: true });

          // 백엔드 API 호출
          const { apiService } = await import('../services/apiService');
          const userProfile = await apiService.register({
            email: userData.email,
            password: userData.password,
            display_name: userData.name,
          });

          // 회원가입 후 자동 로그인
          const response = await apiService.login({
            email: userData.email,
            password: userData.password,
          });

          // 토큰 설정
          apiService.setAuthToken(response.access_token);

          // User 객체 생성
          const user: User = {
            id: String(userProfile.id),
            email: userProfile.email,
            username: userProfile.display_name || userProfile.email,
            full_name: userProfile.display_name || userProfile.email,
            role: 'user' as any,
            is_active: userProfile.is_active,
            is_approved: userProfile.is_verified,
            is_superuser: false,
            created_at: userProfile.created_at,
            updated_at: userProfile.updated_at,
          };

          set({
            user,
            access_token: response.access_token,
            refresh_token: response.refresh_token,
            isLoading: false,
          });

          logger.info('[AuthStore] 백엔드 회원가입 성공:', user.email);

          // 회원가입 후 기본 단어장 생성
          logger.debug('[AuthStore] 기본 단어장 생성 확인 중...');
          const { initialDataService } = await import('../services/initialDataService');
          await initialDataService.setupInitialWordbooks();
        } catch (error: any) {
          logger.error('[AuthStore] 백엔드 회원가입 실패:', error);
          set({ isLoading: false });
          throw new Error(error.message || '회원가입에 실패했습니다.');
        }
      },

      socialLogin: async (request: SocialLoginRequest) => {
        try {
          logger.debug('[AuthStore] 소셜 로그인 시도:', request.provider);
          set({ isLoading: true });

          if (request.provider === 'google') {
            // socialAuthService를 통해 Google Sign-In 수행 (이미 완료된 경우 건너뜀)
            let authResult = request;

            // code나 id_token이 없으면 socialAuthService로 로그인 수행
            if (!request.code && !request.id_token) {
              const { socialAuthService } = await import('../services/socialAuth');
              const result = await socialAuthService.signInWithGoogle();

              if (!result.email) {
                throw new Error('구글 로그인에서 이메일 정보를 가져올 수 없습니다.');
              }

              authResult = {
                provider: 'google',
                code: result.accessToken,
                id_token: result.idToken,
              };
            }

            // 백엔드 API 호출 - Google ID와 이메일로 로그인/회원가입
            const { socialAuthService } = await import('../services/socialAuth');
            const googleUserInfo = await socialAuthService.getCurrentGoogleUser();

            if (!googleUserInfo?.data?.user) {
              throw new Error('구글 사용자 정보를 가져올 수 없습니다.');
            }

            const { apiService } = await import('../services/apiService');
            const response = await apiService.googleLogin({
              email: googleUserInfo.data.user.email,
              name: googleUserInfo.data.user.name || googleUserInfo.data.user.email.split('@')[0],
              google_id: googleUserInfo.data.user.id,
            });

            // 사용자 정보 가져오기
            apiService.setAuthToken(response.access_token);
            const userProfile = await apiService.getMe();

            // User 객체 생성
            const user: User = {
              id: String(userProfile.id),
              email: userProfile.email,
              username: userProfile.display_name || userProfile.email,
              full_name: userProfile.display_name || userProfile.email,
              role: 'USER' as any,
              is_active: userProfile.is_active,
              is_approved: userProfile.is_verified,
              is_superuser: false,
              created_at: userProfile.created_at,
              updated_at: userProfile.updated_at,
            };

            set({
              user,
              access_token: response.access_token,
              refresh_token: response.refresh_token,
              isLoading: false,
            });

            logger.info('[AuthStore] 구글 로그인 성공:', user.email);

            // 로그인 후 기본 단어장 생성 확인
            logger.debug('[AuthStore] 기본 단어장 생성 확인 중...');
            const { initialDataService } = await import('../services/initialDataService');
            await initialDataService.setupInitialWordbooks();
          } else {
            throw new Error(`${request.provider} 로그인은 현재 지원하지 않습니다.`);
          }
        } catch (error: any) {
          logger.error('[AuthStore] 소셜 로그인 실패:', error.message);
          set({ isLoading: false });
          throw new Error(error.message || '소셜 로그인에 실패했습니다.');
        }
      },

      refreshAccessToken: async () => {
        const { refresh_token } = get();
        if (!refresh_token) {
          logger.debug('[AuthStore] No refresh token available.');
          return false;
        }

        try {
          logger.debug('[AuthStore] Attempting to refresh access token...');
          const { apiService } = await import('../services/apiService');
          const response = await apiService.refreshToken(refresh_token);

          set({
            access_token: response.access_token,
            refresh_token: response.refresh_token,
          });

          apiService.setAuthToken(response.access_token);
          logger.info('[AuthStore] Access token refreshed successfully.');
          return true;
        } catch (error: any) {
          logger.error('[AuthStore] Failed to refresh access token:', error.message);
          // If refresh fails, log the user out completely
          get().logout();
          return false;
        }
      },

      logout: async () => {
        try {
          logger.debug('[AuthStore] 로그아웃 진행');

          // API 클라이언트 토큰 제거
          const { apiService } = await import('../services/apiService');
          apiService.removeAuthToken();

          // 상태 클리어
          set({
            user: null,
            access_token: null,
            refresh_token: null,
            isLoading: false,
          });

          logger.info('[AuthStore] 로그아웃 완료');
        } catch (error) {
          logger.error('[AuthStore] 로그아웃 중 오류:', error);
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
          logger.debug('[AuthStore] 프로필 업데이트 시도');
          const { user: currentUser } = get();

          if (!currentUser) {
            throw new Error('로그인이 필요합니다.');
          }

          // 로컬 DB 업데이트
          const updatedLocalUser = await localUserDB.update(currentUser.id, {
            display_name: profileData.full_name || profileData.username,
          });

          // User 객체 업데이트
          const newUser: User = {
            ...currentUser,
            username: updatedLocalUser.display_name,
            full_name: updatedLocalUser.display_name,
            updated_at: updatedLocalUser.updated_at,
          };

          set({ user: newUser });
          logger.info('[AuthStore] 프로필 업데이트 성공');
        } catch (error: any) {
          logger.error('[AuthStore] 프로필 업데이트 실패:', error.message);
          throw new Error(error.message || '프로필 업데이트에 실패했습니다.');
        }
      },

      setTokens: (accessToken: string, refreshToken: string) => {
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
        logger.debug('[AuthStore] AsyncStorage에서 상태 복원');

        if (state?.access_token) {
          // 사용자 ID를 문자열로 변환
          if (state.user && state.user.id !== undefined) {
            state.user.id = String(state.user.id);
          }

          // API 클라이언트에 토큰 설정 (비동기 import)
          import('../services/apiService').then(({ apiService }) => {
            apiService.setAuthToken(state.access_token!);
            logger.debug('[AuthStore] API 클라이언트에 토큰 설정 완료');
          });

          logger.info('[AuthStore] 상태 복원 완료 - 로그인 상태 유지됨');
        } else {
          logger.debug('[AuthStore] 저장된 토큰이 없습니다.');
        }
      },
    }
  )
);
