import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WordbookScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import databaseService from '../database/database';

interface WordbookItem {
  id: number;
  name: string;
  wordCount: number;
  icon: string;
  lastStudied: string;
  progressPercent: number;
  isSelected?: boolean;
  groupId?: number;
  order?: number;
}

interface WordbookGroup {
  id: number;
  name: string;
  wordbookIds: number[];
  isExpanded: boolean;
}

export default function WordbookScreen({ navigation }: WordbookScreenProps) {
  const { theme } = useTheme();
  const [wordbooks, setWordbooks] = useState<WordbookItem[]>([]);
  const [groups, setGroups] = useState<WordbookGroup[]>([]);
  const [showNewWordbookModal, setShowNewWordbookModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newWordbookName, setNewWordbookName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedWordbooks, setSelectedWordbooks] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // HTML 목업과 동일한 데이터 (order 추가)
  const wordbookData: WordbookItem[] = [
    {
      id: 1,
      name: "기초 영단어",
      wordCount: 32,
      icon: "📖",
      lastStudied: "2시간 전",
      progressPercent: 85,
      order: 0,
    },
    {
      id: 2,
      name: "토익 필수 단어",
      wordCount: 156,
      icon: "💼",
      lastStudied: "1일 전",
      progressPercent: 67,
      order: 1,
    },
    {
      id: 3,
      name: "일상 회화 표현",
      wordCount: 89,
      icon: "💬",
      lastStudied: "3일 전",
      progressPercent: 42,
      order: 2,
    },
    {
      id: 4,
      name: "스캔한 단어들",
      wordCount: 23,
      icon: "📷",
      lastStudied: "어제",
      progressPercent: 12,
      order: 3,
    },
    {
      id: 5,
      name: "고급 어휘",
      wordCount: 78,
      icon: "🎓",
      lastStudied: "1주일 전",
      progressPercent: 28,
      order: 4,
    },
  ];

  useEffect(() => {
    setWordbooks(wordbookData.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, []);

  // 안드로이드 뒤로가기 버튼 처리
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isSelectionMode) {
          // 편집 모드가 활성화된 경우 편집 모드만 종료
          setIsSelectionMode(false);
          setSelectedWordbooks([]);
          return true; // 이벤트를 소비하여 기본 뒤로가기 동작 방지
        }
        return false; // 기본 뒤로가기 동작 허용
      }
    );

    return () => backHandler.remove();
  }, [isSelectionMode]);

  const moveWordbookUp = (wordbookId: number) => {
    const currentIndex = wordbooks.findIndex(wb => wb.id === wordbookId && !wb.groupId);
    if (currentIndex > 0) {
      const reorderedWordbooks = [...wordbooks];
      const targetIndex = currentIndex - 1;

      // 두 아이템의 order 값 교환
      const temp = reorderedWordbooks[currentIndex].order;
      reorderedWordbooks[currentIndex].order = reorderedWordbooks[targetIndex].order;
      reorderedWordbooks[targetIndex].order = temp;

      setWordbooks(reorderedWordbooks.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }
  };

  const moveWordbookDown = (wordbookId: number) => {
    const ungroupedWordbooks = wordbooks.filter(wb => !wb.groupId);
    const currentIndex = ungroupedWordbooks.findIndex(wb => wb.id === wordbookId);

    if (currentIndex < ungroupedWordbooks.length - 1) {
      const reorderedWordbooks = [...wordbooks];
      const currentWb = reorderedWordbooks.find(wb => wb.id === wordbookId);
      const nextWb = ungroupedWordbooks[currentIndex + 1];
      const nextWbInAll = reorderedWordbooks.find(wb => wb.id === nextWb.id);

      if (currentWb && nextWbInAll) {
        // 두 아이템의 order 값 교환
        const temp = currentWb.order;
        currentWb.order = nextWbInAll.order;
        nextWbInAll.order = temp;

        setWordbooks(reorderedWordbooks.sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
    }
  };

  const toggleSelectionMode = () => {
    const newSelectionMode = !isSelectionMode;
    setIsSelectionMode(newSelectionMode);
    if (!newSelectionMode) {
      setSelectedWordbooks([]);
    }
  };

  const toggleWordbookSelection = (wordbookId: number) => {
    setSelectedWordbooks(prev => {
      if (prev.includes(wordbookId)) {
        return prev.filter(id => id !== wordbookId);
      } else {
        return [...prev, wordbookId];
      }
    });
  };

  const handleLongPress = (wordbookId: number) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedWordbooks([wordbookId]);
    }
  };

  const handleCreateGroup = () => {
    if (selectedWordbooks.length < 2) {
      Alert.alert('알림', '그룹을 만들려면 최소 2개의 단어장을 선택해주세요.');
      return;
    }
    setShowGroupModal(true);
  };

  const confirmCreateGroup = () => {
    if (newGroupName.trim() && selectedWordbooks.length >= 2) {
      const newGroup: WordbookGroup = {
        id: Date.now(),
        name: newGroupName.trim(),
        wordbookIds: selectedWordbooks,
        isExpanded: true,
      };

      setGroups(prev => [...prev, newGroup]);

      // 그룹에 속한 단어장들에 groupId 설정
      setWordbooks(prev =>
        prev.map(wb =>
          selectedWordbooks.includes(wb.id)
            ? { ...wb, groupId: newGroup.id }
            : wb
        )
      );

      setNewGroupName('');
      setShowGroupModal(false);
      setIsSelectionMode(false);
      setSelectedWordbooks([]);

      Alert.alert('완료', `"${newGroup.name}" 그룹이 생성되었습니다.`);
    }
  };

  const deleteSelectedWordbooks = () => {
    Alert.alert(
      '단어장 삭제',
      `선택된 ${selectedWordbooks.length}개 단어장을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setWordbooks(prev => prev.filter(wb => !selectedWordbooks.includes(wb.id)));
            setIsSelectionMode(false);
            setSelectedWordbooks([]);
          }
        }
      ]
    );
  };

  const toggleGroupExpansion = (groupId: number) => {
    setGroups(prev =>
      prev.map(group =>
        group.id === groupId
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  };

  const ungroupWordbooks = (groupId: number) => {
    Alert.alert(
      '그룹 해제',
      '이 그룹을 해제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: () => {
            // 그룹에서 단어장들 제거
            setWordbooks(prev =>
              prev.map(wb =>
                wb.groupId === groupId
                  ? { ...wb, groupId: undefined }
                  : wb
              )
            );
            // 그룹 삭제
            setGroups(prev => prev.filter(g => g.id !== groupId));
          }
        }
      ]
    );
  };

  const handleWordbookPress = (wordbook: WordbookItem) => {
    navigation.navigate('WordbookDetail', {
      wordbookId: wordbook.id,
      wordbookName: wordbook.name
    });
  };

  const handleCreateWordbook = () => {
    if (newWordbookName.trim()) {
      const newWordbook: WordbookItem = {
        id: Date.now(),
        name: newWordbookName.trim(),
        wordCount: 0,
        icon: "📚",
        lastStudied: "방금 전",
        progressPercent: 0,
      };
      setWordbooks([...wordbooks, newWordbook]);
      setNewWordbookName('');
      setShowNewWordbookModal(false);
    }
  };

  const renderGroupItem = (group: WordbookGroup) => {
    const groupWordbooks = wordbooks.filter(wb => group.wordbookIds.includes(wb.id));
    const totalWords = groupWordbooks.reduce((sum, wb) => sum + wb.wordCount, 0);
    const avgProgress = Math.round(
      groupWordbooks.reduce((sum, wb) => sum + wb.progressPercent, 0) / groupWordbooks.length
    );

    return (
      <View key={`group-${group.id}`} style={styles.groupContainer}>
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => toggleGroupExpansion(group.id)}
        >
          <View style={styles.groupHeaderLeft}>
            <Text style={styles.groupExpandIcon}>
              {group.isExpanded ? '📂' : '📁'}
            </Text>
            <View style={styles.groupInfo}>
              <Text style={styles.groupTitle}>{group.name}</Text>
              <Text style={styles.groupMeta}>
                {groupWordbooks.length}개 단어장 • {totalWords}개 단어 • {avgProgress}% 완료
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.groupOptionsBtn}
            onPress={() => ungroupWordbooks(group.id)}
          >
            <Text style={styles.groupOptionsText}>⋯</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {group.isExpanded && (
          <View style={styles.groupContent}>
            {groupWordbooks.map(wordbook => renderWordbookItem(wordbook, true))}
          </View>
        )}
      </View>
    );
  };

  const renderWordbookItem = (wordbook: WordbookItem, isInGroup = false, index?: number) => {
    const isSelected = selectedWordbooks.includes(wordbook.id);
    const ungroupedWordbooks = wordbooks.filter(wb => !wb.groupId);
    const currentIndex = ungroupedWordbooks.findIndex(wb => wb.id === wordbook.id);
    const canMoveUp = currentIndex > 0;
    const canMoveDown = currentIndex < ungroupedWordbooks.length - 1;

    return (
    <View
      key={wordbook.id}
      style={[
        styles.wordbookItem,
        isInGroup && styles.wordbookItemInGroup,
        isSelectionMode && isSelected && styles.wordbookItemSelected,
      ]}
    >
      <TouchableOpacity
        style={styles.wordbookTouchable}
        onPress={() => {
          if (isSelectionMode) {
            toggleWordbookSelection(wordbook.id);
          } else {
            handleWordbookPress(wordbook);
          }
        }}
        onLongPress={() => handleLongPress(wordbook.id)}
      >
      {isSelectionMode && (
        <View style={styles.selectionCheckbox}>
          <View style={[
            styles.checkboxContainer,
            selectedWordbooks.includes(wordbook.id) && styles.checkboxChecked
          ]}>
            {selectedWordbooks.includes(wordbook.id) && (
              <Text style={styles.checkboxText}>✓</Text>
            )}
          </View>
        </View>
      )}

      {!isSelectionMode && !isInGroup && (
        <View style={styles.dragHandle}>
          <Text style={styles.dragIcon}>⋮⋮</Text>
        </View>
      )}

      {/* 선택 모드에서 이동 버튼들 */}
      {isSelectionMode && isSelected && !isInGroup && (
        <View style={styles.moveButtons}>
          <TouchableOpacity
            style={[styles.moveBtn, !canMoveUp && styles.moveBtnDisabled]}
            onPress={() => moveWordbookUp(wordbook.id)}
            disabled={!canMoveUp}
          >
            <Text style={[styles.moveBtnText, !canMoveUp && styles.moveBtnTextDisabled]}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.moveBtn, !canMoveDown && styles.moveBtnDisabled]}
            onPress={() => moveWordbookDown(wordbook.id)}
            disabled={!canMoveDown}
          >
            <Text style={[styles.moveBtnText, !canMoveDown && styles.moveBtnTextDisabled]}>↓</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.wordbookContent}>
        <View style={styles.wordbookHeader}>
          <Text style={styles.wordbookTitle}>{wordbook.name}</Text>
          <Text style={styles.wordbookIcon}>{wordbook.icon}</Text>
        </View>
        <View style={styles.wordbookMeta}>
          <Text style={styles.wordCount}>{wordbook.wordCount}개 단어</Text>
          <Text style={styles.lastStudied}>{wordbook.lastStudied}</Text>
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>학습 진행률</Text>
          <Text style={styles.progressPercent}>{wordbook.progressPercent}%</Text>
        </View>
        <View style={styles.miniProgressBar}>
          <View
            style={[
              styles.miniProgressFill,
              { width: `${wordbook.progressPercent}%` }
            ]}
          />
        </View>
      </View>
      </TouchableOpacity>
    </View>
  );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f8f9fa',
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      backgroundColor: '#ffffff',
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#212529',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 16,
      color: '#6c757d',
    },
    selectionToggleBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: '#4f46e5',
      borderRadius: 8,
    },
    selectionToggleBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    // Group Styles
    groupContainer: {
      marginBottom: 16,
      backgroundColor: '#ffffff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e9ecef',
      overflow: 'hidden',
    },
    groupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#f8f9fa',
    },
    groupHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    groupExpandIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    groupInfo: {
      flex: 1,
    },
    groupTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#212529',
      marginBottom: 2,
    },
    groupMeta: {
      fontSize: 12,
      color: '#6c757d',
    },
    groupOptionsBtn: {
      padding: 8,
    },
    groupOptionsText: {
      fontSize: 18,
      color: '#6c757d',
    },
    groupContent: {
      paddingLeft: 16,
      backgroundColor: '#ffffff',
    },
    // Wordbook Styles
    wordbookItem: {
      backgroundColor: '#ffffff',
      marginBottom: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e9ecef',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    wordbookTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      flex: 1,
    },
    wordbookItemInGroup: {
      marginBottom: 8,
      marginRight: 16,
      borderColor: '#dee2e6',
    },
    wordbookItemSelected: {
      borderColor: '#4f46e5',
      backgroundColor: '#f8faff',
    },
    selectionCheckbox: {
      marginRight: 12,
    },
    checkboxContainer: {
      width: 24,
      height: 24,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#4f46e5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: '#4f46e5',
    },
    checkboxText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    dragHandle: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    dragIcon: {
      fontSize: 16,
      color: '#adb5bd',
    },
    wordbookContent: {
      flex: 1,
      paddingLeft: 12,
    },
    wordbookHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    wordbookTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#212529',
    },
    wordbookIcon: {
      fontSize: 24,
    },
    wordbookMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    wordCount: {
      fontSize: 14,
      color: '#495057',
      fontWeight: '500',
    },
    lastStudied: {
      fontSize: 14,
      color: '#6c757d',
    },
    progressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    progressText: {
      fontSize: 13,
      color: '#6c757d',
    },
    progressPercent: {
      fontSize: 13,
      fontWeight: '600',
      color: '#4f46e5',
    },
    miniProgressBar: {
      height: 6,
      backgroundColor: '#e9ecef',
      borderRadius: 3,
      overflow: 'hidden',
    },
    miniProgressFill: {
      height: '100%',
      backgroundColor: '#4f46e5',
      borderRadius: 3,
    },
    // Selection Actions
    selectionActionsTop: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: '#f8f9fa',
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
    },
    selectionBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: '#4f46e5',
      borderRadius: 8,
      alignItems: 'center',
    },
    selectionBtnSecondary: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#4f46e5',
    },
    selectionBtnDelete: {
      backgroundColor: '#ef4444',
    },
    selectionBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    selectionBtnTextSecondary: {
      color: '#4f46e5',
    },
    selectionBtnTextDelete: {
      color: '#ffffff',
    },
    selectionBtnTextDisabled: {
      opacity: 0.5,
    },
    // Move Buttons
    moveButtons: {
      flexDirection: 'column',
      gap: 4,
      marginLeft: 8,
    },
    moveBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#4f46e5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    moveBtnDisabled: {
      backgroundColor: '#e9ecef',
    },
    moveBtnText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    moveBtnTextDisabled: {
      color: '#adb5bd',
    },
    newWordbookBtn: {
      backgroundColor: '#4f46e5',
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 40,
    },
    newWordbookBtnText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: '#ffffff',
      margin: 20,
      padding: 24,
      borderRadius: 16,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: '#212529',
      marginBottom: 20,
      textAlign: 'center',
    },
    groupPreview: {
      marginBottom: 20,
    },
    groupPreviewTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: '#495057',
      marginBottom: 8,
    },
    groupPreviewItems: {
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      padding: 12,
      maxHeight: 120,
    },
    groupPreviewItem: {
      fontSize: 14,
      color: '#212529',
      marginBottom: 4,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: '#e9ecef',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      marginBottom: 24,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalBtnCancel: {
      backgroundColor: '#6c757d',
      marginRight: 8,
    },
    modalBtnConfirm: {
      backgroundColor: '#4f46e5',
      marginLeft: 8,
    },
    modalBtnText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>나의 단어장</Text>
          <Text style={styles.headerSubtitle}>학습할 단어장을 선택하세요</Text>
        </View>
        <TouchableOpacity
          style={styles.selectionToggleBtn}
          onPress={toggleSelectionMode}
        >
          <Text style={styles.selectionToggleBtnText}>
            {isSelectionMode ? '완료' : '편집'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Selection Mode Actions */}
      {isSelectionMode && (
        <View style={styles.selectionActionsTop}>
          <TouchableOpacity
            style={[styles.selectionBtn, styles.selectionBtnSecondary]}
            onPress={handleCreateGroup}
            disabled={selectedWordbooks.length < 2}
          >
            <Text style={[
              styles.selectionBtnText,
              styles.selectionBtnTextSecondary,
              selectedWordbooks.length < 2 && styles.selectionBtnTextDisabled
            ]}>
              📁 그룹 만들기 ({selectedWordbooks.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.selectionBtn, styles.selectionBtnDelete]}
            onPress={deleteSelectedWordbooks}
            disabled={selectedWordbooks.length === 0}
          >
            <Text style={[
              styles.selectionBtnText,
              styles.selectionBtnTextDelete,
              selectedWordbooks.length === 0 && styles.selectionBtnTextDisabled
            ]}>
              🗑️ 삭제
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 그룹들 렌더링 */}
        {groups.map(renderGroupItem)}

        {/* 그룹에 속하지 않은 단어장들 렌더링 */}
        {wordbooks
          .filter(wb => !wb.groupId)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((wordbook, index) => renderWordbookItem(wordbook, false, index))}


        {/* New Wordbook Button */}
        {!isSelectionMode && (
          <TouchableOpacity
            style={styles.newWordbookBtn}
            onPress={() => setShowNewWordbookModal(true)}
          >
            <Text style={styles.newWordbookBtnText}>➕ 새 단어장 만들기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* New Wordbook Modal */}
      <Modal
        visible={showNewWordbookModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewWordbookModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>새 단어장 만들기</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="단어장 이름을 입력하세요"
              value={newWordbookName}
              onChangeText={setNewWordbookName}
              maxLength={20}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setShowNewWordbookModal(false);
                  setNewWordbookName('');
                }}
              >
                <Text style={styles.modalBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  !newWordbookName.trim() && { opacity: 0.5 }
                ]}
                onPress={handleCreateWordbook}
                disabled={!newWordbookName.trim()}
              >
                <Text style={styles.modalBtnText}>만들기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Group Creation Modal */}
      <Modal
        visible={showGroupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>새 그룹 만들기</Text>

            {/* Group Preview */}
            <View style={styles.groupPreview}>
              <Text style={styles.groupPreviewTitle}>그룹에 포함될 단어장:</Text>
              <ScrollView style={styles.groupPreviewItems}>
                {selectedWordbooks.map(id => {
                  const wordbook = wordbooks.find(wb => wb.id === id);
                  return (
                    <Text key={id} style={styles.groupPreviewItem}>
                      {wordbook?.icon} {wordbook?.name}
                    </Text>
                  );
                })}
              </ScrollView>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="그룹 이름을 입력하세요"
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={20}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setShowGroupModal(false);
                  setNewGroupName('');
                }}
              >
                <Text style={styles.modalBtnText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  !newGroupName.trim() && { opacity: 0.5 }
                ]}
                onPress={confirmCreateGroup}
                disabled={!newGroupName.trim()}
              >
                <Text style={styles.modalBtnText}>그룹 만들기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}