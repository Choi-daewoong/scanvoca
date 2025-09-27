// src/stores/authStore.ts

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  SocialLoginRequest,
  SocialLoginResult,
} from '../types/auth';

// 간단한 사용자 데이터 타입 (로컬 저장용)
interface LocalUser {
  id: string;
  email: string;
  username: string;
  full_name: string;
  password: string; // 실제 앱에서는 해싱 필요
  phone?: string;
  role: string;
  created_at: string;
}

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

// AsyncStorage 키
const USERS_KEY = 'local_users';

// 로컬 사용자 관리 헬퍼 함수들
const saveUser = async (user: LocalUser): Promise<void> => {
  try {
    const existingUsers = await getUsers();
    const updatedUsers = [...existingUsers.filter(u => u.email !== user.email), user];
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
  } catch (error) {
    console.error('사용자 저장 실패:', error);
    throw error;
  }
};

const getUsers = async (): Promise<LocalUser[]> => {
  try {
    const usersData = await AsyncStorage.getItem(USERS_KEY);
    return usersData ? JSON.parse(usersData) : [];
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    return [];
  }
};

const findUserByEmail = async (email: string): Promise<LocalUser | null> => {
  const users = await getUsers();
  return users.find(user => user.email === email) || null;
};

const authenticateUser = async (email: string, password: string): Promise<LocalUser | null> => {
  const user = await findUserByEmail(email);
  if (user && user.password === password) {
    return user;
  }
  return null;
};

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

          // AsyncStorage에서 사용자 인증
          const user = await authenticateUser(credentials.email, credentials.password);

          if (!user) {
            throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
          }

          // 간단한 토큰 생성 (실제 앱에서는 JWT 사용)
          const access_token = `local_token_${user.id}_${Date.now()}`;
          const refresh_token = `refresh_token_${user.id}_${Date.now()}`;

          set({
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              full_name: user.full_name,
              phone: user.phone,
              role: user.role as any,
              is_active: true,
              is_approved: true,
              is_superuser: false,
              created_at: user.created_at,
              updated_at: new Date().toISOString(),
            },
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

          // 이미 존재하는 이메일인지 확인
          const existingUser = await findUserByEmail(userData.email);
          if (existingUser) {
            throw new Error('이미 사용 중인 이메일입니다.');
          }

          // 새 사용자 생성
          const newUser: LocalUser = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            email: userData.email,
            username: userData.name,
            full_name: userData.name,
            password: userData.password, // 실제 앱에서는 해싱 필요
            phone: userData.phone,
            role: userData.role.toUpperCase(),
            created_at: new Date().toISOString(),
          };

          // AsyncStorage에 저장
          await saveUser(newUser);

          set({ isLoading: false });
          console.log('[AuthStore] 회원가입 성공:', newUser.email);
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

          // 소셜 로그인은 현재 미구현 상태
          set({ isLoading: false });
          throw new Error('소셜 로그인은 현재 지원하지 않습니다.');
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

          console.log('[AuthStore] 로컬 앱에서는 토큰 갱신이 필요하지 않습니다.');
          return true;
        } catch (error: any) {
          console.error('[AuthStore] 토큰 갱신 실패:', error.message);
          return false;
        }
      },

      logout: async () => {
        try {
          console.log('[AuthStore] 로그아웃 진행');

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

          if (!currentUser) {
            throw new Error('로그인이 필요합니다.');
          }

          // 로컬에서는 메모리 상태만 업데이트
          const newUser = {
            ...currentUser,
            ...profileData,
            id: String(currentUser.id),
            updated_at: new Date().toISOString(),
          };

          set({ user: newUser });
          console.log('[AuthStore] 프로필 업데이트 성공');
        } catch (error: any) {
          console.error('[AuthStore] 프로필 업데이트 실패:', error.message);
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
        console.log('[AuthStore] 스토리지에서 상태 복원');

        if (state?.access_token) {
          // 사용자 ID를 문자열로 변환
          if (state.user && state.user.id !== undefined) {
            state.user.id = String(state.user.id);
          }

          console.log('[AuthStore] 상태 복원 완료');
        } else {
          console.log('[AuthStore] 저장된 토큰이 없습니다.');
        }
      },
    }
  )
);