import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Database
import databaseService from './src/database/database';
import { verifyDatabaseIntegrity } from './src/utils/databaseCheck';

// Environment & Configuration
import { validateEnv, debugEnv } from './src/utils/env';

// Authentication
import { useAuthStore } from './src/stores/authStore';

// Navigation & Theme
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/styles/ThemeProvider';
import { LoadingScreen, ErrorScreen } from './src/components/common';

export default function App() {
  const [isDbInitialized, setIsDbInitialized] = useState(false);
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

      // 데이터베이스 초기화
      console.log('🗄️ 데이터베이스 초기화 중...');
      try {
        await databaseService.initialize();
        console.log('✅ 데이터베이스 초기화 성공');
      } catch (dbError) {
        console.error('❌ 데이터베이스 초기화 실패:', dbError);
        // 데이터베이스 초기화에 실패해도 앱을 계속 실행 (사용자 테이블만 없을 수 있음)
        setIsDbInitialized(true);
        setIsLoading(false);
        return;
      }

      // 데이터베이스 무결성 검사 및 기본 설정
      try {
        const isHealthy = await verifyDatabaseIntegrity();
        if (!isHealthy) {
          console.warn('⚠️ 데이터베이스 무결성 검사 실패, 기본 기능만 제공');
        }
      } catch (integrityError) {
        console.warn('⚠️ 데이터베이스 무결성 검사 중 오류:', integrityError);
      }

      setIsDbInitialized(true);
      console.log('✅ 앱 초기화 완료!');
    } catch (error) {
      console.error('❌ 앱 초기화 실패:', error);
      Alert.alert(
        '초기화 오류',
        '앱 초기화 중 오류가 발생했습니다.\n데이터베이스 연결을 확인하고 앱을 다시 시작해 주세요.',
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

  // 데이터베이스 초기화 실패
  if (!isDbInitialized) {
    return (
      <ThemeProvider>
        <ErrorScreen onRetry={initializeApp} />
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

