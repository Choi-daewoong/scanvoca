import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';

const SettingsScreen: React.FC = () => {
  const handleDatabaseInfo = () => {
    Alert.alert(
      '데이터베이스 정보',
      '• 총 단어 수: 153,256개\n• 한국어 의미: 235,437개\n• 예문: 415개\n• CEFR 레벨: A1-B2\n• 빈도순위: 285개 단어',
      [{ text: '확인' }]
    );
  };

  const handleExportData = () => {
    Alert.alert('데이터 내보내기', '단어장 데이터 내보내기 기능은 향후 업데이트에서 제공됩니다.', [
      { text: '확인' },
    ]);
  };

  const handleNotificationSettings = () => {
    Alert.alert('알림 설정', '학습 알림 설정 기능은 향후 업데이트에서 제공됩니다.', [
      { text: '확인' },
    ]);
  };

  const SettingItem = ({
    title,
    subtitle,
    onPress,
    rightText,
  }: {
    title: string;
    subtitle?: string;
    onPress: () => void;
    rightText?: string;
  }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightText && <Text style={styles.settingRightText}>{rightText}</Text>}
      <Text style={styles.settingArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* 앱 정보 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <SettingItem
          title="데이터베이스 정보"
          subtitle="단어 및 의미 통계 확인"
          onPress={handleDatabaseInfo}
        />
        <SettingItem
          title="앱 버전"
          subtitle="현재 설치된 앱 버전"
          onPress={() => Alert.alert('버전', 'v1.0.0 (개발 중)')}
          rightText="1.0.0"
        />
      </View>

      {/* 학습 설정 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>학습 설정</Text>
        <SettingItem
          title="알림 설정"
          subtitle="학습 리마인더 및 알림"
          onPress={handleNotificationSettings}
        />
        <SettingItem
          title="학습 모드"
          subtitle="플래시카드 및 퀴즈 설정"
          onPress={() => Alert.alert('학습 모드', '설정 기능은 향후 추가됩니다.')}
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
        <Text style={styles.sectionTitle}>데이터 관리</Text>
        <SettingItem
          title="단어장 백업"
          subtitle="내 단어장을 파일로 내보내기"
          onPress={handleExportData}
        />
        <SettingItem
          title="학습 기록 초기화"
          subtitle="모든 학습 진도를 리셋"
          onPress={() =>
            Alert.alert(
              '학습 기록 초기화',
              '정말로 모든 학습 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
              [
                { text: '취소', style: 'cancel' },
                { text: '삭제', style: 'destructive' },
              ]
            )
          }
        />
      </View>

      {/* OCR 설정 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>스캔 설정</Text>
        <SettingItem
          title="OCR 언어"
          subtitle="텍스트 인식 언어 설정"
          onPress={() => Alert.alert('OCR 언어', '현재 영어만 지원됩니다.')}
          rightText="영어"
        />
        <SettingItem
          title="자동 단어 필터링"
          subtitle="스캔 시 불필요한 단어 자동 제거"
          onPress={() => Alert.alert('필터링', '설정 기능은 향후 추가됩니다.')}
          rightText="켜짐"
        />
      </View>

      {/* 접근성 및 기타 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>기타</Text>
        <SettingItem
          title="도움말"
          subtitle="앱 사용법 및 FAQ"
          onPress={() =>
            Alert.alert(
              '도움말',
              '1. 카메라로 텍스트를 촬영하세요\n2. 인식된 단어를 확인하고 선택하세요\n3. 단어장에 추가하여 학습하세요'
            )
          }
        />
        <SettingItem
          title="문의하기"
          subtitle="버그 신고 및 기능 제안"
          onPress={() => Alert.alert('문의하기', '개발자 이메일: dev@example.com')}
        />
        <SettingItem
          title="오픈소스 라이센스"
          subtitle="사용된 라이브러리 정보"
          onPress={() =>
            Alert.alert(
              '오픈소스',
              '• React Native\n• Expo SDK\n• React Navigation\n• Kengdic Dictionary\n• Webster\'s Dictionary'
            )
          }
        />
      </View>

      {/* 하단 여백 */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 20,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  settingRightText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  settingArrow: {
    fontSize: 18,
    color: '#C7C7CC',
    fontWeight: 'bold',
  },
  bottomSpacing: {
    height: 40,
  },
});

export default SettingsScreen;
