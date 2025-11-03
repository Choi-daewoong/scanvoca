import { useState, useEffect, useCallback } from 'react';
import { BackHandler, Alert } from 'react-native';
import { useWordbook } from './useWordbook';
import { wordbookService } from '../services/wordbookService';
import { Wordbook } from '../types/types';

export interface WordbookItem {
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

export interface WordbookGroup {
  id: number;
  name: string;
  wordbookIds: number[];
  isExpanded: boolean;
}

export interface UseWordbookManagementReturn {
  // 상태
  wordbooks: WordbookItem[];
  groups: WordbookGroup[];
  isSelectionMode: boolean;
  selectedWordbooks: number[];
  showNewWordbookModal: boolean;
  showGroupModal: boolean;
  newWordbookName: string;
  newGroupName: string;

  // 액션
  setShowNewWordbookModal: (show: boolean) => void;
  setShowGroupModal: (show: boolean) => void;
  setNewWordbookName: (name: string) => void;
  setNewGroupName: (name: string) => void;
  toggleSelectionMode: () => void;
  toggleWordbookSelection: (id: number) => void;
  handleLongPress: (id: number) => void;
  handleCreateWordbook: () => Promise<void>;
  handleCreateGroup: () => void;
  confirmCreateGroup: () => void;
  deleteSelectedWordbooks: () => void;
  moveWordbookUp: (id: number) => Promise<void>;
  moveWordbookDown: (id: number) => Promise<void>;
  toggleGroupExpansion: (id: number) => void;
  ungroupWordbooks: (id: number) => void;
  loadWordbooksData: () => Promise<void>;
}

export function useWordbookManagement(): UseWordbookManagementReturn {
  const { loadWordbooks, wordbooks: hookWordbooks } = useWordbook();
  const [wordbooks, setWordbooks] = useState<WordbookItem[]>([]);
  const [groups, setGroups] = useState<WordbookGroup[]>([]);
  const [showNewWordbookModal, setShowNewWordbookModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newWordbookName, setNewWordbookName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedWordbooks, setSelectedWordbooks] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const loadWordbooksData = useCallback(async () => {
    try {
      await loadWordbooks();
      const list = hookWordbooks;
      const mapped: WordbookItem[] = list.map((wb: Wordbook) => ({
        id: wb.id,
        name: wb.name,
        wordCount: (wb as any).word_count || 0,
        icon: '📖',
        lastStudied: '—',
        progressPercent: 0,
        order: (wb as any).display_order || 0,
        groupId: (wb as any).group_id || undefined,
      }));
      setWordbooks(mapped);
      setGroups([]);
    } catch (e) {
      console.error('Failed to load wordbooks', e);
    }
  }, [loadWordbooks, hookWordbooks]);

  useEffect(() => {
    loadWordbooksData();
  }, []);

  // 안드로이드 뒤로가기 버튼 처리
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedWordbooks([]);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isSelectionMode]);

  const moveWordbookUp = useCallback(async (wordbookId: number) => {
    const currentIndex = wordbooks.findIndex(wb => wb.id === wordbookId && !wb.groupId);
    if (currentIndex > 0) {
      const reorderedWordbooks = [...wordbooks];
      const targetIndex = currentIndex - 1;

      const temp = reorderedWordbooks[currentIndex].order;
      reorderedWordbooks[currentIndex].order = reorderedWordbooks[targetIndex].order;
      reorderedWordbooks[targetIndex].order = temp;

      setWordbooks(reorderedWordbooks.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }
  }, [wordbooks]);

  const moveWordbookDown = useCallback(async (wordbookId: number) => {
    const ungroupedWordbooks = wordbooks.filter(wb => !wb.groupId);
    const currentIndex = ungroupedWordbooks.findIndex(wb => wb.id === wordbookId);

    if (currentIndex < ungroupedWordbooks.length - 1) {
      const reorderedWordbooks = [...wordbooks];
      const currentWb = reorderedWordbooks.find(wb => wb.id === wordbookId);
      const nextWb = ungroupedWordbooks[currentIndex + 1];
      const nextWbInAll = reorderedWordbooks.find(wb => wb.id === nextWb.id);

      if (currentWb && nextWbInAll) {
        const temp = currentWb.order;
        currentWb.order = nextWbInAll.order;
        nextWbInAll.order = temp;

        setWordbooks(reorderedWordbooks.sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
    }
  }, [wordbooks]);

  const toggleSelectionMode = useCallback(() => {
    const newSelectionMode = !isSelectionMode;
    setIsSelectionMode(newSelectionMode);
    if (!newSelectionMode) {
      setSelectedWordbooks([]);
    }
  }, [isSelectionMode]);

  const toggleWordbookSelection = useCallback((wordbookId: number) => {
    setSelectedWordbooks(prev => {
      if (prev.includes(wordbookId)) {
        return prev.filter(id => id !== wordbookId);
      } else {
        return [...prev, wordbookId];
      }
    });
  }, []);

  const handleLongPress = useCallback((wordbookId: number) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedWordbooks([wordbookId]);
    }
  }, [isSelectionMode]);

  const handleCreateGroup = useCallback(() => {
    if (selectedWordbooks.length < 2) {
      Alert.alert('알림', '그룹을 만들려면 최소 2개의 단어장을 선택해주세요.');
      return;
    }
    setShowGroupModal(true);
  }, [selectedWordbooks]);

  const confirmCreateGroup = useCallback(() => {
    if (newGroupName.trim() && selectedWordbooks.length >= 2) {
      const newGroup: WordbookGroup = {
        id: Date.now(),
        name: newGroupName.trim(),
        wordbookIds: selectedWordbooks,
        isExpanded: true,
      };

      setGroups(prev => [...prev, newGroup]);

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
  }, [newGroupName, selectedWordbooks]);

  const deleteSelectedWordbooks = useCallback(() => {
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
  }, [selectedWordbooks]);

  const toggleGroupExpansion = useCallback((groupId: number) => {
    setGroups(prev =>
      prev.map(group =>
        group.id === groupId
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  }, []);

  const ungroupWordbooks = useCallback((groupId: number) => {
    Alert.alert(
      '그룹 해제',
      '이 그룹을 해제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          onPress: () => {
            setWordbooks(prev =>
              prev.map(wb =>
                wb.groupId === groupId
                  ? { ...wb, groupId: undefined }
                  : wb
              )
            );
            setGroups(prev => prev.filter(g => g.id !== groupId));
          }
        }
      ]
    );
  }, []);

  const handleCreateWordbook = useCallback(async () => {
    if (!newWordbookName.trim()) return;
    try {
      const newWordbookId = await wordbookService.createWordbook(
        newWordbookName.trim(),
        ''
      );

      if (newWordbookId) {
        const item: WordbookItem = {
          id: newWordbookId,
          name: newWordbookName.trim(),
          wordCount: 0,
          icon: '📚',
          lastStudied: '방금 전',
          progressPercent: 0,
          order: (wordbooks[wordbooks.length - 1]?.order || 0) + 1,
        };
        setWordbooks(prev => [...prev, item]);
      }
    } catch (e) {
      console.error('Failed to create wordbook', e);
    } finally {
      setNewWordbookName('');
      setShowNewWordbookModal(false);
    }
  }, [newWordbookName, wordbooks]);

  return {
    wordbooks,
    groups,
    isSelectionMode,
    selectedWordbooks,
    showNewWordbookModal,
    showGroupModal,
    newWordbookName,
    newGroupName,
    setShowNewWordbookModal,
    setShowGroupModal,
    setNewWordbookName,
    setNewGroupName,
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
    loadWordbooksData,
  };
}
