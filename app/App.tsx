import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { Alert } from 'react-native';

// Smart Dictionary Service (GPT + Local JSON)
import smartDictionaryService from './src/services/smartDictionaryService';

// Environment & Configuration
import { validateEnv, debugEnv } from './src/utils/env';

// Authentication
import { useAuthStore } from './src/stores/authStore';

// Navigation & Theme
import RootNavigator from './src/navigation/RootNavigator';
import { RootStackParamList } from './src/navigation/types';
import { ThemeProvider } from './src/styles/ThemeProvider';
import { LoadingScreen, ErrorScreen } from './src/components/common';

// Deep Linking 구성
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['com.scanvoca.app://', 'https://scanvoca.com'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      ForgotPassword: 'forgot-password',
      MainTabs: {
        screens: {
          Home: 'home',
          Scan: 'scan',
          Wordbook: 'wordbook',
        }
      },
      Camera: 'camera',
      WordDetail: 'word/:wordId',
      ScanResults: 'scan-results',
      QuizSession: 'quiz/:wordbookId',
      QuizResults: 'quiz-results',
      WordbookDetail: 'wordbook/:wordbookId',
      Settings: 'settings',
    }
  }
};

export default function App() {
  const [isAppInitialized, setIsAppInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);

  // 인증 상태 관리
  const { user, access_token } = useAuthStore();

  useEffect(() => {
    initializeApp();
  }, []);

  // 인증 상태 변화 감지
  useEffect(() => {
    // Zustand 스토어가 AsyncStorage에서 데이터를 복원한 후 초기화 완료로 표시
    const timer = setTimeout(() => {
      setIsAuthInitialized(true);
      console.log('🔐 인증 상태 초기화 완료:', {
        hasUser: !!user,
        hasToken: !!access_token,
        userEmail: user?.email
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [user, access_token]);

  const initializeApp = async () => {
    try {
      setIsLoading(true);

      console.log('🚀 앱 초기화 시작...');

      // 환경변수 검증
      console.log('⚙️ 환경변수 검증 중...');
      validateEnv();
      debugEnv();

      // Smart Dictionary Service 초기화 (GPT + Local JSON)
      console.log('🤖 Smart Dictionary Service 초기화 중...');
      await smartDictionaryService.initialize();

      setIsAppInitialized(true);
      console.log('✅ 앱 초기화 완료!');
    } catch (error) {
      console.error('❌ 앱 초기화 실패:', error);
      Alert.alert(
        '초기화 오류',
        '앱 초기화 중 오류가 발생했습니다.\n앱을 다시 시작해 주세요.',
        [{ text: '확인' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 앱 초기화 중
  if (isLoading || !isAuthInitialized) {
    return (
      <ThemeProvider>
        <LoadingScreen />
      </ThemeProvider>
    );
  }

  // 앱 초기화 실패
  if (!isAppInitialized) {
    return (
      <ThemeProvider>
        <ErrorScreen onRetry={initializeApp} />
      </ThemeProvider>
    );
  }

  // 앱 시작 - 인증 상태에 따른 네비게이션
  const isAuthenticated = !!(user && access_token);

  return (
    <ThemeProvider>
      <NavigationContainer linking={linking}>
        <StatusBar style="auto" />
        <RootNavigator isAuthenticated={isAuthenticated} />
      </NavigationContainer>
    </ThemeProvider>
  );
}

