// Navigation types for Scan_Voca app
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SmartWordDefinition } from '../types/types';

// Detected Word from OCR scan
export interface DetectedWord {
  word: string;
  definition?: SmartWordDefinition;
  isFiltered?: boolean;
  filterReason?: string;
}

// Root Stack Navigator (전체 앱 네비게이션)
export type RootStackParamList = {
  // Auth screens
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;

  // Main tabs (하단 탭 네비게이션)
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;

  // Main screens (deprecated - use MainTabs instead)
  Home: undefined;
  Scan: undefined;
  Wordbook: undefined;

  // Modal screens (인증 필요)
  Camera: undefined;
  WordDetail: { wordId: number };
  ScanResults: {
    scannedText?: string;
    imageUri?: string;
    detectedWords?: DetectedWord[];
    excludedCount?: number;
    excludedWords?: DetectedWord[];
  };
  QuizSession: { wordbookId?: number; questionCount?: number };
  QuizResults: {
    session: any;
    correctCount: number;
    totalCount: number;
    wordbookId?: number;
  };
  WordbookDetail: { wordbookId: number; wordbookName?: string };
  Settings: undefined;
  StudyStats: undefined;
};

// Main Tab Navigator (하단 탭)
export type MainTabParamList = {
  Home: undefined;
  Scan: undefined;
  Wordbook: undefined;
};

// Screen Props Types
export type RootStackScreenProps<Screen extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Screen>;

export type MainTabScreenProps<Screen extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, Screen>,
    NativeStackScreenProps<RootStackParamList>
  >;

// Navigation prop shortcuts
// Auth screens
export type LoginScreenProps = RootStackScreenProps<'Login'>;
export type RegisterScreenProps = RootStackScreenProps<'Register'>;
export type ForgotPasswordScreenProps = RootStackScreenProps<'ForgotPassword'>;

// Main app screens
export type HomeScreenProps = RootStackScreenProps<'Home'>;
export type ScanScreenProps = RootStackScreenProps<'Scan'>;
export type WordbookScreenProps = RootStackScreenProps<'Wordbook'>;

// Modal screens
export type WordDetailScreenProps = RootStackScreenProps<'WordDetail'>;
export type ScanResultsScreenProps = RootStackScreenProps<'ScanResults'>;
export type QuizSessionScreenProps = RootStackScreenProps<'QuizSession'>;
export type QuizResultsScreenProps = RootStackScreenProps<'QuizResults'>;
export type CameraScreenProps = RootStackScreenProps<'Camera'>;
export type WordbookDetailScreenProps = RootStackScreenProps<'WordbookDetail'>;
export type SettingsScreenProps = RootStackScreenProps<'Settings'>;
export type StudyStatsScreenProps = RootStackScreenProps<'StudyStats'>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}