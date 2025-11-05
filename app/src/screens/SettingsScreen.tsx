import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator } from 'react-native';
import { SettingsScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { wordbookService } from '../services/wordbookService';
import { useAuthStore } from '../stores/authStore';
import { InputModal } from '../components/common';
import { useOCRFilterSettings } from '../hooks/useOCRFilterSettings';
import { shareWordbook, exportWordbookToFile } from '../services/wordbookExportImport';

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { theme } = useTheme();
  const { user, logout } = useAuthStore();
  const {
    excludeMastered,
    excludeBasic,
    setExcludeMastered,
    setExcludeBasic,
  } = useOCRFilterSettings();
  const [databaseStats, setDatabaseStats] = useState({
    totalWords: 0,
    totalMeanings: 0,
    totalExamples: 0,
    totalWordbooks: 0,
    studiedWords: 0,
  });
  const [dailyGoal, setDailyGoal] = useState(10);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoFilter, setAutoFilter] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);

  useEffect(() => {
    loadDatabaseStats();
  }, []);

  const loadDatabaseStats = async () => {
    try {
      setLoading(true);

      // Load from wordbookService (AsyncStorage based)
      const { wordbookService } = await import('../services/wordbookService');
      const wordbooks = await wordbookService.getWordbooks();

      let totalWords = 0;
      let totalMeanings = 0;

      for (const wordbook of wordbooks) {
        const words = await wordbookService.getWordbookWords(wordbook.id);
        totalWords += words.length;
        totalMeanings += words.reduce((sum: number, w: any) => sum + (w.meanings?.length || 0), 0);
      }

      setDatabaseStats({
        totalWords,
        totalMeanings,
        totalExamples: 0, // TODO: Calculate from word examples
        totalWordbooks: wordbooks.length,
        studiedWords: 0, // TODO: Calculate from study progress
      });
    } catch (error) {
      console.error('Failed to load database stats:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleDatabaseInfo = () => {
    Alert.alert(
      '데이터베이스 정보',
      `• 총 단어 수: ${databaseStats.totalWords.toLocaleString()}개\n• 한국어 의미: ${databaseStats.totalMeanings.toLocaleString()}개\n• 예문: ${databaseStats.totalExamples.toLocaleString()}개\n• 내 단어장: ${databaseStats.totalWordbooks}개\n• 학습한 단어: ${databaseStats.studiedWords}개`,
      [{ text: '확인' }]
    );
  };

  const handleDailyGoalChange = () => {
    setShowGoalModal(true);
  };

  const handleGoalConfirm = (value: string) => {
    const newGoal = parseInt(value || '10');
    if (newGoal > 0 && newGoal <= 100) {
      setDailyGoal(newGoal);
      Alert.alert('완료', `일일 목표가 ${newGoal}개로 설정되었습니다.`);
    } else {
      Alert.alert('오류', '1-100 사이의 숫자를 입력해주세요.');
    }
    setShowGoalModal(false);
  };

  // saveFilterSettings는 hook에서 자동으로 처리됨 (제거)

  const handleGoalCancel = () => {
    setShowGoalModal(false);
  };

  const handleResetStudyProgress = async () => {
    Alert.alert(
      '학습 기록 초기화',
      '정말로 모든 학습 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: 학습 기록 초기화 기능 구현
              Alert.alert('완료', '모든 학습 기록이 초기화되었습니다.');
              loadDatabaseStats(); // 통계 새로고침
            } catch (error) {
              Alert.alert('오류', '학습 기록 초기화에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      '데이터 내보내기',
      '내보낼 데이터를 선택하세요',
      [
        { text: '취소', style: 'cancel' },
        { text: '단어장만', onPress: () => exportWordbooks() },
        { text: '전체 백업', onPress: () => exportAllData() }
      ]
    );
  };

  const exportWordbooks = async () => {
    try {
      console.log('단어장 내보내기 시작...');

      // 1. 단어장 목록 조회
      const wordbooks = await wordbookService.getWordbooks();

      if (wordbooks.length === 0) {
        Alert.alert('알림', '내보낼 단어장이 없습니다.');
        return;
      }

      // 2. 단어장 선택 다이얼로그 표시
      const buttons = wordbooks.map((wb) => ({
        text: wb.name,
        onPress: () => handleWordbookSelected(wb.id),
      }));

      // 취소 버튼 추가
      buttons.push({
        text: '취소',
        onPress: () => Promise.resolve(),
      });

      Alert.alert(
        '단어장 선택',
        '내보낼 단어장을 선택하세요',
        buttons
      );

    } catch (error) {
      console.error('단어장 목록 조회 실패:', error);
      Alert.alert('오류', '단어장 목록을 불러오지 못했습니다.');
    }
  };

  const handleWordbookSelected = async (wordbookId: number) => {
    try {
      console.log(`단어장 ${wordbookId} 내보내기 시작...`);

      // 선택한 단어장 내보내기
      await shareWordbook(wordbookId);

      console.log('단어장 공유 완료');

    } catch (error: any) {
      console.error('단어장 내보내기 실패:', error);

      // 에러 메시지 표시
      if (error.message === '단어장을 찾을 수 없습니다.') {
        Alert.alert('오류', '단어장을 찾을 수 없습니다.');
      } else if (error.message === '단어장에 단어가 없습니다.') {
        Alert.alert('공유 불가', '단어가 없는 단어장은 공유할 수 없습니다.');
      } else if (error.message === '이 기기에서는 공유 기능을 사용할 수 없습니다.') {
        Alert.alert('공유 불가', '이 기기에서는 공유 기능을 사용할 수 없습니다.');
      } else {
        Alert.alert('오류', '단어장 내보내기에 실패했습니다.');
      }
    }
  };

  const exportAllData = async () => {
    if (isExportingAll) return;

    try {
      setIsExportingAll(true);
      console.log('전체 단어장 백업 시작...');

      // 1. 단어장 목록 조회
      const wordbooks = await wordbookService.getWordbooks();

      if (wordbooks.length === 0) {
        Alert.alert('알림', '백업할 단어장이 없습니다.');
        setIsExportingAll(false);
        return;
      }

      // 2. 모든 단어장을 하나의 JSON으로 묶기
      const bulkData: any = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        wordbooks: [],
        metadata: {
          totalWordbooks: wordbooks.length,
          totalWords: 0
        }
      };

      // 3. 각 단어장 데이터 수집
      for (const wb of wordbooks) {
        const jsonString = await exportWordbookToFile(wb.id);
        const sharedWordbook = JSON.parse(jsonString);
        bulkData.wordbooks.push(sharedWordbook);
        bulkData.metadata.totalWords += sharedWordbook.words.length;
      }

      // 4. JSON 문자열로 변환
      const bulkJsonString = JSON.stringify(bulkData, null, 2);

      // 5. 파일로 저장 및 공유
      const FileSystem = await import('expo-file-system/legacy');
      const { cacheDirectory, writeAsStringAsync, deleteAsync, EncodingType } = FileSystem;

      const fileName = `scan_voca_backup_${Date.now()}.json`;
      const fileUri = `${cacheDirectory}${fileName}`;

      await writeAsStringAsync(fileUri, bulkJsonString, {
        encoding: EncodingType.UTF8
      });

      console.log(`전체 백업 파일 생성: ${fileUri}`);

      // 6. 공유 다이얼로그 호출
      const Sharing = await import('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        throw new Error('이 기기에서는 공유 기능을 사용할 수 없습니다.');
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: '전체 단어장 백업',
        UTI: 'public.json'
      });

      console.log('전체 백업 공유 완료');

      // 7. 임시 파일 삭제
      try {
        await deleteAsync(fileUri, { idempotent: true });
      } catch (error) {
        console.warn('임시 파일 삭제 실패:', error);
      }

    } catch (error: any) {
      console.error('전체 백업 실패:', error);
      Alert.alert('오류', error.message || '전체 데이터 백업에 실패했습니다.');
    } finally {
      setIsExportingAll(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말로 로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              Alert.alert('완료', '로그아웃되었습니다.');
            } catch (error) {
              Alert.alert('오류', '로그아웃 중 오류가 발생했습니다.');
            }
          }
        }
      ]
    );
  };

  const SettingItem = ({
    title,
    subtitle,
    onPress,
    rightText,
    rightComponent,
    showArrow = true,
  }: {
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightText?: string;
    rightComponent?: React.ReactNode;
    showArrow?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightComponent && rightComponent}
      {rightText && <Text style={styles.settingRightText}>{rightText}</Text>}
      {showArrow && onPress && <Text style={styles.settingArrow}>›</Text>}
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    section: {
      backgroundColor: theme.colors.background.primary,
      marginTop: theme.spacing.lg,
    },
    sectionTitle: {
      ...theme.typography.h5,
      color: theme.colors.text.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.background.secondary,
      fontWeight: '600',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      minHeight: 60,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      ...theme.typography.body1,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
    },
    settingSubtitle: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
    },
    settingRightText: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      marginRight: theme.spacing.sm,
    },
    settingArrow: {
      ...theme.typography.h6,
      color: theme.colors.text.tertiary,
      fontWeight: 'bold',
    },
    bottomSpacing: {
      height: theme.spacing.xl,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      ...theme.typography.body1,
      color: theme.colors.text.secondary,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    loadingCard: {
      backgroundColor: theme.colors.background.primary,
      borderRadius: 12,
      padding: theme.spacing.xl,
      alignItems: 'center',
      minWidth: 200,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>설정을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 앱 정보 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 앱 정보</Text>
        <SettingItem
          title="데이터베이스 정보"
          subtitle={loading ? '로딩 중...' : `단어 ${databaseStats.totalWords.toLocaleString()}개 • 학습 ${databaseStats.studiedWords}개`}
          onPress={handleDatabaseInfo}
        />
        <SettingItem
          title="앱 버전"
          subtitle="현재 설치된 앱 버전"
          onPress={() => Alert.alert('버전', 'v1.0.0 (Phase 4 개발 중)')}
          rightText="1.0.0"
        />
      </View>

      {/* 학습 설정 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 학습 설정</Text>
        <SettingItem
          title="일일 학습 목표"
          subtitle="하루에 학습할 단어 수 설정"
          onPress={handleDailyGoalChange}
          rightText={`${dailyGoal}개`}
        />
        <SettingItem
          title="학습 알림"
          subtitle="정기적인 학습 리마인더"
          rightComponent={
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{
                false: theme.colors.border.light,
                true: theme.colors.primary.light
              }}
              thumbColor={notificationsEnabled ? theme.colors.primary.main : theme.colors.text.tertiary}
            />
          }
          showArrow={false}
        />
        <SettingItem
          title="난이도 설정"
          subtitle="CEFR 레벨 기준 조정"
          onPress={() => Alert.alert('난이도', '자동 조정 중입니다.')}
          rightText="자동"
        />
      </View>

      {/* 데이터 관리 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💾 데이터 관리</Text>
        <SettingItem
          title="단어장 백업"
          subtitle="내 단어장을 파일로 내보내기"
          onPress={handleExportData}
        />
        <SettingItem
          title="학습 기록 초기화"
          subtitle="모든 학습 진도를 리셋"
          onPress={handleResetStudyProgress}
        />
      </View>

      {/* 스캔 설정 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📷 스캔 설정</Text>
        <SettingItem
          title="OCR 언어"
          subtitle="텍스트 인식 언어 설정"
          onPress={() => Alert.alert('OCR 언어', '현재 영어만 지원됩니다.')}
          rightText="영어"
        />
        <SettingItem
          title="자동 단어 필터링"
          subtitle="스캔 시 불필요한 단어 자동 제거"
          rightComponent={
            <Switch
              value={autoFilter}
              onValueChange={setAutoFilter}
              trackColor={{
                false: theme.colors.border.light,
                true: theme.colors.primary.light
              }}
              thumbColor={autoFilter ? theme.colors.primary.main : theme.colors.text.tertiary}
            />
          }
          showArrow={false}
        />
        <SettingItem
          title="외운 단어 자동 제외"
          subtitle="이미 암기한 단어는 스캔 결과에서 제외합니다"
          rightComponent={
            <Switch
              value={excludeMastered}
              onValueChange={setExcludeMastered}
              trackColor={{
                false: theme.colors.border.light,
                true: theme.colors.primary.light
              }}
              thumbColor={excludeMastered ? theme.colors.primary.main : theme.colors.text.tertiary}
            />
          }
          showArrow={false}
        />
        <SettingItem
          title="기초 단어 제외"
          subtitle="레벨 1 (a, the, is 등) 단어는 제외합니다"
          rightComponent={
            <Switch
              value={excludeBasic}
              onValueChange={setExcludeBasic}
              trackColor={{
                false: theme.colors.border.light,
                true: theme.colors.primary.light
              }}
              thumbColor={excludeBasic ? theme.colors.primary.main : theme.colors.text.tertiary}
            />
          }
          showArrow={false}
        />
      </View>

      {/* 접근성 및 기타 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ 기타</Text>
        <SettingItem
          title="학습 통계"
          subtitle="상세한 학습 진도 및 분석"
          onPress={() => navigation.navigate('StudyStats')}
        />
        <SettingItem
          title="도움말"
          subtitle="앱 사용법 및 FAQ"
          onPress={() =>
            Alert.alert(
              '📖 사용법',
              '1. 📷 카메라로 텍스트를 촬영하세요\n2. ✅ 인식된 단어를 확인하고 선택하세요\n3. 📚 단어장에 추가하여 학습하세요\n4. 🧠 퀴즈로 실력을 확인하세요'
            )
          }
        />
        <SettingItem
          title="문의하기"
          subtitle="버그 신고 및 기능 제안"
          onPress={() => Alert.alert('📧 문의하기', '이슈나 제안사항이 있으시면\nGitHub Repository에서 문의해 주세요.')}
        />
        <SettingItem
          title="오픈소스 라이센스"
          subtitle="사용된 라이브러리 정보"
          onPress={() =>
            Alert.alert(
              '📄 라이센스',
              '• React Native (MIT)\n• Expo SDK (MIT)\n• React Navigation (MIT)\n• OpenAI GPT API\n• ML Kit Text Recognition'
            )
          }
        />
      </View>

      {/* 계정 관리 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 계정 관리</Text>
        <SettingItem
          title="현재 계정"
          subtitle={user?.email || '로그인된 계정'}
          showArrow={false}
        />
        <SettingItem
          title="로그아웃"
          subtitle="현재 계정에서 로그아웃"
          onPress={handleLogout}
        />
      </View>

      {/* 하단 여백 */}
      <View style={styles.bottomSpacing} />

      {/* InputModal for Daily Goal */}
      <InputModal
        visible={showGoalModal}
        title="일일 목표 설정"
        message="하루에 학습할 단어 수를 입력하세요 (1-100)"
        placeholder="숫자 입력"
        defaultValue={dailyGoal.toString()}
        keyboardType="numeric"
        onConfirm={handleGoalConfirm}
        onCancel={handleGoalCancel}
        confirmText="설정"
        cancelText="취소"
      />

      {/* 전체 백업 로딩 오버레이 */}
      {isExportingAll && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary.main} />
            <Text style={[styles.loadingText, { marginTop: theme.spacing.md }]}>
              전체 단어장 백업 중...
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
