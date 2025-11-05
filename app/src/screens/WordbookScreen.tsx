import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { WordbookScreenProps } from '../navigation/types';
import { useTheme } from '../styles/ThemeProvider';
import { useWordbookManagement, WordbookItem, WordbookGroup } from '../hooks/useWordbookManagement';
// import ImportWordbookButton from '../components/common/ImportWordbookButton'; // TODO: expo-document-picker 네이티브 모듈 필요
import CreateWordbookModal from '../components/wordbook/CreateWordbookModal';
import CreateGroupModal from '../components/wordbook/CreateGroupModal';
import RenameGroupModal from '../components/wordbook/RenameGroupModal';

export default function WordbookScreen({ navigation }: WordbookScreenProps) {
  const { theme } = useTheme();
  const {
    wordbooks,
    groups,
    isSelectionMode,
    selectedWordbooks,
    showNewWordbookModal,
    showGroupModal,
    showRenameGroupModal,
    newWordbookName,
    newGroupName,
    renameGroupName,
    renamingGroupId,
    setShowNewWordbookModal,
    setShowGroupModal,
    setShowRenameGroupModal,
    setNewWordbookName,
    setNewGroupName,
    setRenameGroupName,
    toggleSelectionMode,
    toggleWordbookSelection,
    handleLongPress,
    handleCreateWordbook,
    handleCreateGroup,
    confirmCreateGroup,
    deleteSelectedWordbooks,
    moveWordbookUp,
    moveWordbookDown,
    toggleGroupExpansion,
    ungroupWordbooks,
    confirmRenameGroup,
    handleGroupOptions,
    loadWordbooksData,
  } = useWordbookManagement();

  // 화면 포커스 시 단어장 목록 다시 로드
  useFocusEffect(
    React.useCallback(() => {
      console.log('📚 WordbookScreen focused - 단어장 목록 재로드');
      loadWordbooksData();
    }, [loadWordbooksData])
  );

  const handleWordbookPress = (wordbook: WordbookItem) => {
    navigation.navigate('WordbookDetail', {
      wordbookId: wordbook.id,
      wordbookName: wordbook.name
    });
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
            onPress={() => handleGroupOptions(group.id)}
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

  const renderWordbookItem = (wordbook: WordbookItem, isInGroup = false) => {
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

          {isSelectionMode && isSelected && !isInGroup && (
            <View style={styles.moveButtons}>
              <TouchableOpacity
                style={[styles.moveBtn, !canMoveUp && styles.moveBtnDisabled]}
                onPress={() => moveWordbookUp(wordbook.id)}
                disabled={!canMoveUp}
              >
                <Text style={[styles.moveBtnText, !canMoveUp && styles.moveBtnTextDisabled]}>
                  ↑
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.moveBtn, !canMoveDown && styles.moveBtnDisabled]}
                onPress={() => moveWordbookDown(wordbook.id)}
                disabled={!canMoveDown}
              >
                <Text style={[styles.moveBtnText, !canMoveDown && styles.moveBtnTextDisabled]}>
                  ↓
                </Text>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>나의 단어장</Text>
          <Text style={styles.headerSubtitle}>학습할 단어장을 선택하세요</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* <ImportWordbookButton /> */}
          <TouchableOpacity
            style={styles.selectionToggleBtn}
            onPress={toggleSelectionMode}
          >
            <Text style={styles.selectionToggleBtnText}>
              {isSelectionMode ? '완료' : '편집'}
            </Text>
          </TouchableOpacity>
        </View>
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
        {groups.map(renderGroupItem)}

        {wordbooks
          .filter(wb => !wb.groupId)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(wordbook => renderWordbookItem(wordbook, false))}

        {!isSelectionMode && (
          <TouchableOpacity
            style={styles.newWordbookBtn}
            onPress={() => setShowNewWordbookModal(true)}
          >
            <Text style={styles.newWordbookBtnText}>➕ 새 단어장 만들기</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modals */}
      <CreateWordbookModal
        visible={showNewWordbookModal}
        wordbookName={newWordbookName}
        onChangeName={setNewWordbookName}
        onCreate={handleCreateWordbook}
        onClose={() => {
          setShowNewWordbookModal(false);
          setNewWordbookName('');
        }}
      />

      <CreateGroupModal
        visible={showGroupModal}
        groupName={newGroupName}
        selectedWordbooks={selectedWordbooks}
        wordbooks={wordbooks}
        onChangeName={setNewGroupName}
        onCreate={confirmCreateGroup}
        onClose={() => {
          setShowGroupModal(false);
          setNewGroupName('');
        }}
      />

      <RenameGroupModal
        visible={showRenameGroupModal}
        currentName={groups.find(g => g.id === renamingGroupId)?.name || ''}
        newName={renameGroupName}
        onChangeName={setRenameGroupName}
        onRename={confirmRenameGroup}
        onClose={() => {
          setShowRenameGroupModal(false);
          setRenameGroupName('');
        }}
      />
    </SafeAreaView>
  );
}

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
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  selectionToggleBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectionToggleBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectionActionsTop: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectionBtnSecondary: {
    backgroundColor: '#e7f5ff',
  },
  selectionBtnDelete: {
    backgroundColor: '#ffe5e5',
  },
  selectionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionBtnTextSecondary: {
    color: '#1971c2',
  },
  selectionBtnTextDelete: {
    color: '#c92a2a',
  },
  selectionBtnTextDisabled: {
    opacity: 0.3,
  },
  content: {
    flex: 1,
  },
  groupContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
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
    fontSize: 24,
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  groupMeta: {
    fontSize: 12,
    color: '#6c757d',
  },
  groupOptionsBtn: {
    padding: 8,
  },
  groupOptionsText: {
    fontSize: 20,
    color: '#6c757d',
  },
  groupContent: {
    paddingTop: 8,
  },
  wordbookItem: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  wordbookItemInGroup: {
    marginHorizontal: 8,
    marginBottom: 8,
  },
  wordbookItemSelected: {
    borderColor: '#4f46e5',
    borderWidth: 2,
  },
  wordbookTouchable: {
    padding: 16,
  },
  selectionCheckbox: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#dee2e6',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  checkboxText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  dragHandle: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  dragIcon: {
    fontSize: 16,
    color: '#adb5bd',
  },
  moveButtons: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  moveBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: {
    opacity: 0.3,
  },
  moveBtnText: {
    fontSize: 16,
    color: '#495057',
  },
  moveBtnTextDisabled: {
    color: '#adb5bd',
  },
  wordbookContent: {
    paddingLeft: 40,
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
    marginBottom: 8,
  },
  wordCount: {
    fontSize: 14,
    color: '#6c757d',
  },
  lastStudied: {
    fontSize: 14,
    color: '#6c757d',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    color: '#6c757d',
  },
  progressPercent: {
    fontSize: 12,
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
  },
  newWordbookBtn: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4f46e5',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  newWordbookBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4f46e5',
  },
});
