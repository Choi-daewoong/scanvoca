import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'ocr_filter_settings';

export interface OCRFilterSettings {
  excludeMastered: boolean;
  excludeBasic: boolean;
  minimumDifficulty: number;
}

const DEFAULT_SETTINGS: OCRFilterSettings = {
  excludeMastered: true,  // 기본: 외운 단어 제외
  excludeBasic: false,
  minimumDifficulty: 1
};

export interface UseOCRFilterSettingsReturn {
  settings: OCRFilterSettings;
  excludeMastered: boolean;
  excludeBasic: boolean;
  minimumDifficulty: number;
  setExcludeMastered: (value: boolean) => Promise<void>;
  setExcludeBasic: (value: boolean) => Promise<void>;
  setMinimumDifficulty: (value: number) => Promise<void>;
  updateSettings: (updates: Partial<OCRFilterSettings>) => Promise<void>;
  loadSettings: () => Promise<OCRFilterSettings>;
  isLoading: boolean;
}

/**
 * OCR 필터 설정 관리 hook
 * CameraScreen과 SettingsScreen에서 공통으로 사용
 */
export function useOCRFilterSettings(): UseOCRFilterSettingsReturn {
  const [settings, setSettings] = useState<OCRFilterSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // 설정 불러오기
  const loadSettings = useCallback(async (): Promise<OCRFilterSettings> => {
    try {
      setIsLoading(true);
      const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);

      if (settingsJson) {
        const loadedSettings = JSON.parse(settingsJson);
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...loadedSettings
        };
        setSettings(mergedSettings);
        return mergedSettings;
      }

      setSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('OCR 필터 설정 불러오기 실패:', error);
      setSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 설정 저장
  const saveSettings = useCallback(async (newSettings: OCRFilterSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('OCR 필터 설정 저장 실패:', error);
      throw error;
    }
  }, []);

  // 설정 업데이트
  const updateSettings = useCallback(async (updates: Partial<OCRFilterSettings>) => {
    const newSettings = { ...settings, ...updates };
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  // 개별 설정 변경 함수들
  const setExcludeMastered = useCallback(async (value: boolean) => {
    await updateSettings({ excludeMastered: value });
  }, [updateSettings]);

  const setExcludeBasic = useCallback(async (value: boolean) => {
    await updateSettings({ excludeBasic: value });
  }, [updateSettings]);

  const setMinimumDifficulty = useCallback(async (value: number) => {
    await updateSettings({ minimumDifficulty: value });
  }, [updateSettings]);

  // 컴포넌트 마운트 시 설정 불러오기
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    excludeMastered: settings.excludeMastered,
    excludeBasic: settings.excludeBasic,
    minimumDifficulty: settings.minimumDifficulty,
    setExcludeMastered,
    setExcludeBasic,
    setMinimumDifficulty,
    updateSettings,
    loadSettings,
    isLoading,
  };
}
