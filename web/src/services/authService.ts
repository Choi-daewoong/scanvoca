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

  logout() {
    clearTokens();
  },
};
