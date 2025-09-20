// src/utils/env.ts

/**
 * 환경변수 관리 유틸리티
 * Expo에서는 EXPO_PUBLIC_ 접두사가 필요합니다.
 */

export const ENV = {
  // 개발 환경
  isDev: __DEV__,
  isProduction: !__DEV__,

  // API 설정
  API_BASE_URL: __DEV__
    ? process.env.EXPO_PUBLIC_API_BASE_URL_DEV || 'http://localhost:8000'
    : process.env.EXPO_PUBLIC_API_BASE_URL_PROD || 'https://api.scanvoca.com',

  // Google OAuth
  GOOGLE_CLIENT_ID_IOS: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '',
  GOOGLE_CLIENT_ID_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '',
  GOOGLE_CLIENT_ID_WEB: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '',

  // Apple OAuth
  APPLE_CLIENT_ID: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || 'com.scanvoca.app',

  // 카카오 OAuth
  KAKAO_CLIENT_ID: process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID || '',

  // 네이버 OAuth
  NAVER_CLIENT_ID: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '',
  NAVER_CLIENT_SECRET: process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET || '',

  // 앱 설정
  APP_SCHEME: process.env.EXPO_PUBLIC_APP_SCHEME || 'com.scanvoca.app',
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Scan Voca',

  // 환경 설정
  ENV_NAME: process.env.EXPO_PUBLIC_ENV || 'development',
} as const;

/**
 * 필수 환경변수 검증
 */
export const validateEnv = () => {
  const errors: string[] = [];

  // 프로덕션에서 필수인 환경변수들
  if (!ENV.isDev) {
    if (!ENV.API_BASE_URL.includes('https')) {
      errors.push('프로덕션에서는 HTTPS API URL이 필요합니다.');
    }
  }

  // Google 로그인을 사용할 경우 필수
  if (!ENV.GOOGLE_CLIENT_ID_WEB && ENV.ENV_NAME !== 'development') {
    console.warn('Google 로그인을 사용하려면 GOOGLE_CLIENT_ID_WEB이 필요합니다.');
  }

  if (errors.length > 0) {
    throw new Error(`환경변수 검증 실패:\n${errors.join('\n')}`);
  }

  console.log('[ENV] 환경변수 로드 완료:', {
    environment: ENV.ENV_NAME,
    isDev: ENV.isDev,
    apiUrl: ENV.API_BASE_URL,
    appScheme: ENV.APP_SCHEME,
  });
};

/**
 * 디버그용 환경변수 출력 (개발 환경에서만)
 */
export const debugEnv = () => {
  if (!ENV.isDev) return;

  console.log('[ENV] 현재 환경변수:', {
    ...ENV,
    // 민감한 정보는 마스킹
    GOOGLE_CLIENT_ID_WEB: ENV.GOOGLE_CLIENT_ID_WEB ? '***' : '',
    NAVER_CLIENT_SECRET: ENV.NAVER_CLIENT_SECRET ? '***' : '',
  });
};