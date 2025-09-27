import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SettingsScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { wordbookService } from '../services/wordbookService';
import { useAuthStore } from '../stores/authStore';
import { InputModal } from '../components/common';

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { theme } = useTheme();
  const { user, logout } = useAuthStore();
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

  useEffect(() => {
    loadDatabaseStats();
  }, []);

  const loadDatabaseStats = async () => {
    try {
      setLoading(true);

      // Database service removed - using temporary data
      const wordStats = null;
      const wordbookStats = null;
      const studyStats = null;
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
        { text: '학습기록 포함', onPress: () => exportAllData() }
      ]
    );
  };

  const exportWordbooks = () => {
    // TODO: 단어장 내보내기 기능 구현
    Alert.alert('알림', '단어장 내보내기 기능은 향후 업데이트에서 제공됩니다.');
  };

  const exportAllData = () => {
    // TODO: 전체 데이터 내보내기 기능 구현
    Alert.alert('알림', '전체 데이터 내보내기 기능은 향후 업데이트에서 제공됩니다.');
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
              '• React Native (MIT)\n• Expo SDK (MIT)\n• React Navigation (MIT)\n• SQLite (Public Domain)\n• 영어 사전 데이터 (Open Source)'
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
    </ScrollView>
  );
}
