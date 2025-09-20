// Root Stack Navigator (Auth + Main + Modal screens)
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../styles/ThemeProvider';
import { RootStackParamList } from './types';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import WordbookScreen from '../screens/WordbookScreen';

// Modal/Stack Screens
import CameraScreen from '../screens/CameraScreen';
import WordDetailScreen from '../screens/WordDetailScreen';
import ScanResultsScreen from '../screens/ScanResultsScreen';
import QuizSessionScreen from '../screens/QuizSessionScreen';
import QuizResultsScreen from '../screens/QuizResultsScreen';
import WordbookDetailScreen from '../screens/WordbookDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StudyStatsScreen from '../screens/StudyStatsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface RootNavigatorProps {
  isAuthenticated: boolean;
}

export default function RootNavigator({ isAuthenticated }: RootNavigatorProps) {
  const { theme } = useTheme();

  console.log('🔒 RootNavigator - 인증 상태:', isAuthenticated);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#111827',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: 'bold',
        },
        headerBackTitleVisible: false,
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        // 🔐 인증되지 않은 사용자 - Auth Stack
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        // ✅ 인증된 사용자 - Main App Stack
        <>
          {/* Main Screens */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Scan"
            component={ScanScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Wordbook"
            component={WordbookScreen}
            options={{ headerShown: false }}
          />

          {/* Modal Screens - 인증된 사용자만 접근 가능 */}
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{
              title: '카메라 스캔',
              headerBackTitle: '돌아가기',
            }}
          />

          <Stack.Screen
            name="WordDetail"
            component={WordDetailScreen}
            options={{
              title: '단어 상세',
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          <Stack.Screen
            name="ScanResults"
            component={ScanResultsScreen}
            options={{
              title: '스캔 결과',
              headerBackTitle: '스캔',
            }}
          />

          <Stack.Screen
            name="QuizSession"
            component={QuizSessionScreen}
            options={{
              title: '퀴즈',
              headerBackTitle: '단어장',
              gestureEnabled: false, // 퀴즈 중에는 뒤로가기 제스처 비활성화
            }}
          />

          <Stack.Screen
            name="QuizResults"
            component={QuizResultsScreen}
            options={{
              title: '퀴즈 결과',
              headerBackTitle: '퀴즈',
              gestureEnabled: false,
            }}
          />

          <Stack.Screen
            name="WordbookDetail"
            component={WordbookDetailScreen}
            options={{
              title: '단어장 상세',
              headerBackTitle: '단어장',
            }}
          />

          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: '설정',
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          <Stack.Screen
            name="StudyStats"
            component={StudyStatsScreen}
            options={{
              title: '학습 통계',
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}