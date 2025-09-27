// src/services/socialAuth.ts

import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { ENV } from '../utils/env';

// OAuth 설정
const redirectUri = AuthSession.makeRedirectUri({
  scheme: ENV.APP_SCHEME,
  path: 'auth',
});

export interface SocialAuthResult {
  provider: 'google' | 'apple' | 'kakao' | 'naver';
  accessToken?: string;
  idToken?: string;
  code?: string;
  email?: string;
  name?: string;
  photo?: string;
}

class SocialAuthService {
  private isGoogleConfigured = false;

  constructor() {
    // Google 클라이언트 ID가 유효할 때만 초기화 (더미값 제외)
    if (ENV.GOOGLE_CLIENT_ID_WEB &&
        ENV.GOOGLE_CLIENT_ID_WEB.length > 0 &&
        !ENV.GOOGLE_CLIENT_ID_WEB.includes('dummy')) {
      this.configureGoogleSignIn();
    } else {
      console.warn('[SocialAuth] Google Client ID가 설정되지 않음. 소셜 로그인 비활성화');
    }
  }

  private configureGoogleSignIn() {
    try {
      (GoogleSignin as any).configure({
        webClientId: ENV.GOOGLE_CLIENT_ID_WEB,
        iosClientId: ENV.GOOGLE_CLIENT_ID_IOS,
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
      });
      this.isGoogleConfigured = true;
      console.log('[SocialAuth] Google Sign-In 설정 완료');
    } catch (error) {
      console.error('[SocialAuth] Google Sign-In 설정 실패:', error);
      this.isGoogleConfigured = false;
    }
  }

  // Google 로그인
  async signInWithGoogle(): Promise<SocialAuthResult> {
    if (!this.isGoogleConfigured) {
      throw new Error('Google Sign-In이 설정되지 않았습니다. 환경변수를 확인해주세요.');
    }

    try {
      console.log('[SocialAuth] Google 로그인 시작');

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      console.log('[SocialAuth] Google 로그인 성공:', {
        email: userInfo.data?.user.email,
        name: userInfo.data?.user.name,
      });

      return {
        provider: 'google',
        idToken: userInfo.data?.idToken || undefined,
        accessToken: userInfo.data?.serverAuthCode || undefined,
        email: userInfo.data?.user.email,
        name: userInfo.data?.user.name,
        photo: userInfo.data?.user.photo,
      };
    } catch (error: any) {
      console.error('[SocialAuth] Google 로그인 실패:', error);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Google 로그인이 취소되었습니다.');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error('Google 로그인이 이미 진행 중입니다.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play 서비스를 사용할 수 없습니다.');
      } else {
        throw new Error('Google 로그인에 실패했습니다.');
      }
    }
  }

  // Apple 로그인 (iOS 전용)
  async signInWithApple(): Promise<SocialAuthResult> {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple 로그인은 iOS에서만 지원됩니다.');
    }

    try {
      console.log('[SocialAuth] Apple 로그인 시작');

      const request = new AuthSession.AuthRequest({
        clientId: ENV.APPLE_CLIENT_ID,
        scopes: ['openid', 'email', 'name'],
        responseType: AuthSession.ResponseType.Code,
        redirectUri,
        additionalParameters: {},
        state: await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          Math.random().toString()
        ),
      });

      const result = await request.promptAsync({
        authorizationEndpoint: 'https://appleid.apple.com/auth/authorize',
      });

      if (result.type === 'success') {
        console.log('[SocialAuth] Apple 로그인 성공');

        return {
          provider: 'apple',
          code: result.params.code,
          idToken: result.params.id_token,
        };
      } else {
        throw new Error('Apple 로그인이 취소되었습니다.');
      }
    } catch (error: any) {
      console.error('[SocialAuth] Apple 로그인 실패:', error);
      throw new Error('Apple 로그인에 실패했습니다.');
    }
  }

  // 카카오 로그인 (OAuth 2.0)
  async signInWithKakao(): Promise<SocialAuthResult> {
    try {
      console.log('[SocialAuth] 카카오 로그인 시작');

      const state = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString()
      );

      const request = new AuthSession.AuthRequest({
        clientId: ENV.KAKAO_CLIENT_ID,
        scopes: [],
        responseType: AuthSession.ResponseType.Code,
        redirectUri,
        state,
      });

      const result = await request.promptAsync({
        authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
      });

      if (result.type === 'success') {
        console.log('[SocialAuth] 카카오 로그인 성공');

        return {
          provider: 'kakao',
          code: result.params.code,
        };
      } else {
        throw new Error('카카오 로그인이 취소되었습니다.');
      }
    } catch (error: any) {
      console.error('[SocialAuth] 카카오 로그인 실패:', error);
      throw new Error('카카오 로그인에 실패했습니다.');
    }
  }

  // 네이버 로그인 (OAuth 2.0)
  async signInWithNaver(): Promise<SocialAuthResult> {
    try {
      console.log('[SocialAuth] 네이버 로그인 시작');

      const state = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString()
      );

      const request = new AuthSession.AuthRequest({
        clientId: ENV.NAVER_CLIENT_ID,
        scopes: [],
        responseType: AuthSession.ResponseType.Code,
        redirectUri,
        state,
      });

      const result = await request.promptAsync({
        authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
      });

      if (result.type === 'success') {
        console.log('[SocialAuth] 네이버 로그인 성공');

        return {
          provider: 'naver',
          code: result.params.code,
        };
      } else {
        throw new Error('네이버 로그인이 취소되었습니다.');
      }
    } catch (error: any) {
      console.error('[SocialAuth] 네이버 로그인 실패:', error);
      throw new Error('네이버 로그인에 실패했습니다.');
    }
  }

  // Google 로그아웃
  async signOutGoogle(): Promise<void> {
    try {
      await GoogleSignin.signOut();
      console.log('[SocialAuth] Google 로그아웃 성공');
    } catch (error) {
      console.error('[SocialAuth] Google 로그아웃 실패:', error);
    }
  }

  // 현재 Google 로그인 상태 확인
  async isGoogleSignedIn(): Promise<boolean> {
    try {
      return await GoogleSignin.isSignedIn();
    } catch (error) {
      console.error('[SocialAuth] Google 로그인 상태 확인 실패:', error);
      return false;
    }
  }

  // 현재 Google 사용자 정보 가져오기
  async getCurrentGoogleUser() {
    try {
      const userInfo = await GoogleSignin.signInSilently();
      return userInfo;
    } catch (error) {
      console.error('[SocialAuth] 현재 Google 사용자 정보 가져오기 실패:', error);
      return null;
    }
  }
}

export const socialAuthService = new SocialAuthService();