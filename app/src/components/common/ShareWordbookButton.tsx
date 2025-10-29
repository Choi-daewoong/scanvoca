import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { shareWordbook } from '../../services/wordbookExportImport';
import { useTheme } from '../../styles/ThemeProvider';

interface ShareWordbookButtonProps {
  wordbookId: number;
  wordbookName: string;
}

/**
 * 단어장 공유 버튼 컴포넌트
 *
 * 사용법:
 * <ShareWordbookButton wordbookId={wordbookId} wordbookName={wordbookName} />
 */
export default function ShareWordbookButton({ wordbookId, wordbookName }: ShareWordbookButtonProps) {
  const { theme } = useTheme();
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;

    try {
      setIsSharing(true);
      console.log(`📤 단어장 "${wordbookName}" 공유 시작...`);

      await shareWordbook(wordbookId);

      // 성공 메시지 (선택적)
      // Alert.alert('공유 완료', '단어장을 공유했습니다!');

    } catch (error: any) {
      console.error('공유 실패:', error);

      // 에러 메시지 표시
      if (error.message === '단어장을 찾을 수 없습니다.') {
        Alert.alert('오류', '단어장을 찾을 수 없습니다.');
      } else if (error.message === '단어장에 단어가 없습니다.') {
        Alert.alert('공유 불가', '단어가 없는 단어장은 공유할 수 없습니다.');
      } else if (error.message === '이 기기에서는 공유 기능을 사용할 수 없습니다.') {
        Alert.alert('공유 불가', '이 기기에서는 공유 기능을 사용할 수 없습니다.');
      } else {
        Alert.alert('오류', '단어장 공유에 실패했습니다.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.shareButton, { backgroundColor: theme.colors.primary }]}
      onPress={handleShare}
      disabled={isSharing}
    >
      {isSharing ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.shareButtonText}>📤 공유</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shareButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
