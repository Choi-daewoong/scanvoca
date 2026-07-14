import { apiFetch, setTokens, clearTokens } from './api';
import { User, TokenResponse } from '@/types';

export const authService = {
  async login(email: string, password: string, persistent = false): Promise<TokenResponse> {
    const data = await apiFetch<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    setTokens(data.access_token, data.refresh_token, persistent);
    return data;
  },

  async googleLogin(idToken: string, persistent = false): Promise<TokenResponse> {
    const data = await apiFetch<TokenResponse>('/api/v1/auth/google-login', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
      skipAuth: true,
    });
    setTokens(data.access_token, data.refresh_token, persistent);
    return data;
  },

  async register(email: string, password: string, display_name?: string): Promise<User> {
    return apiFetch<User>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name }),
      skipAuth: true,
    });
  },

  async guestLogin(): Promise<TokenResponse> {
    const data = await apiFetch<TokenResponse>('/api/v1/auth/guest', {
      method: 'POST',
      skipAuth: true,
    });
    // 게스트 세션도 브라우저 재시작 후 이어지도록 로그인 유지(localStorage)로 저장
    setTokens(data.access_token, data.refresh_token, true);
    return data;
  },

  // 새 계정을 만드는 게 아니라 지금 쓰던 게스트 계정에 이메일/비밀번호를 붙이는 업그레이드
  async upgradeGuest(email: string, password: string, display_name?: string): Promise<User> {
    return apiFetch<User>('/api/v1/auth/upgrade-guest', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name }),
    });
  },

  async getMe(): Promise<User> {
    return apiFetch<User>('/api/v1/auth/me');
  },

  async updateProfile(display_name: string): Promise<User> {
    return apiFetch<User>('/api/v1/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ display_name }),
    });
  },

  async forgotPassword(email: string): Promise<void> {
    await apiFetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },

  async resetPassword(email: string, otp: string, new_password: string): Promise<void> {
    await apiFetch('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, new_password }),
      skipAuth: true,
    });
  },

  // 회원 탈퇴 - 서버에서 계정과 연관 데이터를 삭제한 뒤 로컬 토큰도 제거
  async deleteAccount(): Promise<void> {
    await apiFetch('/api/v1/auth/me', { method: 'DELETE' });
    clearTokens();
  },

  logout() {
    clearTokens();
  },
};
