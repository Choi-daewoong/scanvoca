// src/types/auth.ts

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  phone?: string;
  role: 'USER' | 'PROVIDER' | 'ADMIN';
  is_active: boolean;
  is_approved: boolean;
  is_superuser: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'user' | 'provider';
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SocialLoginRequest {
  provider: 'google' | 'apple' | 'naver' | 'kakao';
  code?: string;
  id_token?: string;
  state?: string;
}

export interface SocialLoginResult {
  access_token: string;
  refresh_token: string;
  user: User;
  is_new_user: boolean;
}

export interface AccountLinkingRequired {
  message: string;
  link_token: string;
  social_email: string;
  existing_email: string;
}

export interface AccountLinkingRequest {
  link_token: string;
  password?: string;
}