import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { importWordbookFromFile } from '../../services/wordbookExportImport';
import { useTheme } from '../../styles/ThemeProvider';
import { useNavigation } from '@react-navigation/native';

/**
 * 단어장 가져오기 버튼 컴포넌트
 *
 * 사용법:
 * <ImportWordbookButton />
 */
export default function ImportWordbookButton() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (isImporting) return;

    try {
      setIsImporting(true);
      console.log('📥 단어장 Import 시작...');

      // 1. 파일 선택 다이얼로그
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        console.log('사용자가 파일 선택 취소');
        setIsImporting(false);
        return;
      }

      const fileUri = result.assets[0].uri;
      console.log(`📄 선택된 파일: ${fileUri}`);

      // 2. 파일 읽기
      const jsonData = await FileSystem.readAsStringAsync(fileUri);

      // 3. Import 함수 호출
      const newWordbookId = await importWordbookFromFile(jsonData);

      // 4. 성공 다이얼로그
      setIsImporting(false);

      Alert.alert(
        '가져오기 완료',
        `단어장을 성공적으로 가져왔습니다!`,
        [
          {
            text: '확인',
            onPress: () => {
              // 새로 생성된 단어장 화면으로 이동
              navigation.navigate('WordbookDetail' as never, {
                wordbookId: newWordbookId
              } as never);
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('Import 실패:', error);
      setIsImporting(false);

      // 에러 메시지 표시
      if (error.message?.includes('파일을 읽을 수 없습니다')) {
        Alert.alert('오류', '파일을 읽을 수 없습니다. JSON 파일인지 확인해주세요.');
      } else if (error.message?.includes('올바른 단어장 파일이 아닙니다')) {
        Alert.alert('오류', '올바른 단어장 파일이 아닙니다.');
      } else {
        Alert.alert('오류', '단어장 가져오기에 실패했습니다.');
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.importButton, { backgroundColor: theme.colors.primary }]}
      onPress={handleImport}
      disabled={isImporting}
    >
      {isImporting ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.importButtonText}>📥 가져오기</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  importButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
