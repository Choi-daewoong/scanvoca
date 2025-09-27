import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Data Management
import { registerGlobalClearFunctions } from './src/utils/clearAllData';
import initialDataService from './src/services/initialDataService';

// Environment & Configuration
import { validateEnv, debugEnv } from './src/utils/env';

// TTS Service
import ttsService from './src/services/ttsService';

// Authentication
import { useAuthStore } from './src/stores/authStore';

// Navigation & Theme
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/styles/ThemeProvider';
import { LoadingScreen, ErrorScreen } from './src/components/common';

export default function App() {
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

      // 🔧 개발 도구 등록 (데이터 초기화 함수)
      console.log('🔧 개발 도구 등록 중...');
      registerGlobalClearFunctions();

      // 📚 초기 단어장 데이터 로딩
      console.log('📚 초기 단어장 데이터 확인 중...');
      try {
        const wasInitialized = await initialDataService.initializeApp();
        if (wasInitialized) {
          console.log('🎉 100개 기초 단어장이 새로 생성되었습니다!');
        }

        const initInfo = await initialDataService.getInitializationInfo();
        console.log('📊 초기화 정보:', initInfo);
      } catch (error) {
        console.error('❌ 초기 단어장 로딩 실패:', error);
        // 초기 단어장 로딩 실패해도 앱은 계속 실행
      }

      // TTS 서비스 초기화 및 테스트
      console.log('🔊 TTS 서비스 초기화 중...');
      try {
        const ttsStatus = ttsService.getDiagnostics();
        console.log('🔍 TTS 진단 정보:', ttsStatus);

        if (ttsStatus.isInitialized) {
          console.log('✅ TTS 서비스 초기화 성공:', ttsStatus.status);
          // TTS 자동 테스트 제거 (사용자 요청으로 hello 발음 방지)
        } else {
          console.warn('⚠️ TTS 서비스 사용 불가:', ttsStatus.status);
        }
      } catch (ttsError) {
        console.error('❌ TTS 서비스 초기화 실패:', ttsError);
      }

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

  // 앱 시작 - 인증 상태에 따른 네비게이션
  const isAuthenticated = !!(user && access_token);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <RootNavigator isAuthenticated={isAuthenticated} />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

