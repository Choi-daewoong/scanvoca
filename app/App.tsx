import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';

// Smart Dictionary Service (GPT + Local JSON)
import smartDictionaryService from './src/services/smartDictionaryService';
import masteredWordsCache from './src/services/masteredWordsCache';

// Environment & Configuration
import { validateEnv, debugEnv } from './src/utils/env';

// Authentication
import { useAuthStore } from './src/stores/authStore';

// Navigation & Theme
import RootNavigator from './src/navigation/RootNavigator';
import { RootStackParamList } from './src/navigation/types';
import { ThemeProvider } from './src/styles/ThemeProvider';
import { LoadingScreen, ErrorScreen } from './src/components/common';

// Wordbook Import
import { importWordbookFromFile } from './src/services/wordbookExportImport';
import { initialDataService } from './src/services/initialDataService';

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
  const navigationRef = useRef<any>(null);

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

  // 딥링크 처리 - 파일로 앱 열기
  useEffect(() => {
    // 앱이 완전히 초기화된 후에만 딥링크 처리
    if (!isAppInitialized || !isAuthInitialized) {
      return;
    }

    console.log('📥 딥링크 리스너 등록...');

    // 앱이 실행 중일 때 파일 열기
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 앱이 종료된 상태에서 파일로 실행될 때
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('📥 초기 URL 감지:', url);
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAppInitialized, isAuthInitialized]);

  const handleDeepLink = async ({ url }: { url: string }) => {
    try {
      console.log('📥 파일 URL 수신:', url);

      // URL이 파일인지 확인
      if (!url.startsWith('file://') && !url.startsWith('content://')) {
        console.log('⚠️ 파일 URL이 아님, 무시');
        return;
      }

      // 파일 읽기
      let fileContent: string;

      try {
        if (url.startsWith('file://')) {
          // iOS: file:// URL
          const filePath = url.replace('file://', '');
          console.log('📄 파일 경로:', filePath);
          fileContent = await FileSystem.readAsStringAsync(filePath);
        } else if (url.startsWith('content://')) {
          // Android: content:// URI
          console.log('📄 Content URI:', url);
          fileContent = await FileSystem.readAsStringAsync(url);
        } else {
          console.warn('⚠️ 지원하지 않는 URL 스킴:', url);
          return;
        }
      } catch (readError) {
        console.error('❌ 파일 읽기 실패:', readError);
        Alert.alert('오류', '파일을 읽을 수 없습니다.');
        return;
      }

      // JSON 파싱
      let data: any;
      try {
        data = JSON.parse(fileContent);
      } catch (parseError) {
        console.error('❌ JSON 파싱 실패:', parseError);
        Alert.alert('오류', '올바른 JSON 파일이 아닙니다.');
        return;
      }

      // 단어장 파일인지 검증
      const isSingleWordbook = data.name && data.words && Array.isArray(data.words);
      const isBulkBackup = data.version && data.wordbooks && Array.isArray(data.wordbooks);

      if (!isSingleWordbook && !isBulkBackup) {
        console.warn('⚠️ 단어장 파일이 아님');
        Alert.alert('오류', '올바른 단어장 파일이 아닙니다.');
        return;
      }

      // 단일 단어장 가져오기
      if (isSingleWordbook) {
        Alert.alert(
          '단어장 가져오기',
          `"${data.name}" 단어장을 가져오시겠습니까?\n\n단어 수: ${data.words.length}개`,
          [
            { text: '취소', style: 'cancel' },
            {
              text: '가져오기',
              onPress: async () => {
                try {
                  console.log('📥 단어장 가져오기 시작...');
                  const wordbookId = await importWordbookFromFile(fileContent);

                  Alert.alert(
                    '완료',
                    '단어장을 가져왔습니다!',
                    [
                      {
                        text: '확인',
                        onPress: () => {
                          // 단어장 상세 화면으로 이동
                          if (navigationRef.current) {
                            navigationRef.current.navigate('WordbookDetail', {
                              wordbookId,
                              wordbookName: data.name
                            });
                          }
                        }
                      }
                    ]
                  );
                } catch (error: any) {
                  console.error('❌ 단어장 가져오기 실패:', error);
                  Alert.alert('오류', error.message || '단어장 가져오기에 실패했습니다.');
                }
              }
            }
          ]
        );
      }
      // 전체 백업 가져오기
      else if (isBulkBackup) {
        Alert.alert(
          '전체 백업 가져오기',
          `${data.wordbooks.length}개의 단어장을 가져오시겠습니까?\n\n총 단어 수: ${data.metadata?.totalWords || '?'}개`,
          [
            { text: '취소', style: 'cancel' },
            {
              text: '가져오기',
              onPress: async () => {
                try {
                  console.log('📥 전체 백업 가져오기 시작...');

                  let successCount = 0;
                  for (const wb of data.wordbooks) {
                    try {
                      await importWordbookFromFile(JSON.stringify(wb));
                      successCount++;
                    } catch (error) {
                      console.error(`단어장 "${wb.name}" 가져오기 실패:`, error);
                    }
                  }

                  Alert.alert(
                    '완료',
                    `${successCount}개의 단어장을 가져왔습니다!`
                  );
                } catch (error: any) {
                  console.error('❌ 전체 백업 가져오기 실패:', error);
                  Alert.alert('오류', '백업 가져오기에 실패했습니다.');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('❌ 딥링크 처리 실패:', error);
      Alert.alert('오류', '파일 처리 중 오류가 발생했습니다.');
    }
  };

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

      // 외운 단어 캐시 초기화 (OCR 필터링 속도 향상)
      console.log('📚 외운 단어 캐시 초기화 중...');
      await masteredWordsCache.initialize();

      // 앱 최초 실행 시 기본 단어장 생성
      console.log('📖 기본 단어장 생성 확인 중...');
      await initialDataService.setupInitialWordbooks();

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
      <NavigationContainer ref={navigationRef} linking={linking}>
        <StatusBar style="auto" />
        <RootNavigator isAuthenticated={isAuthenticated} />
      </NavigationContainer>
    </ThemeProvider>
  );
}

