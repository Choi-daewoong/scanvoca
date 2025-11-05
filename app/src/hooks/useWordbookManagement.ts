import { useState, useEffect, useCallback } from 'react';
import { BackHandler, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
      // wordbookService에서 직접 최신 데이터 가져오기
      const list = await wordbookService.getWordbooks();

      // 각 단어장의 단어 개수와 진행률을 계산
      const mapped: WordbookItem[] = await Promise.all(
        list.map(async (wb: Wordbook) => {
          try {
            // 단어장의 모든 단어 가져오기
            const words = await wordbookService.getWordbookWords(wb.id);
            const wordCount = words.length;

            // 외운 단어 개수 계산 (study_progress.mastered 또는 memorized)
            const memorizedCount = words.filter(w => {
              return w.study_progress?.mastered || w.memorized || false;
            }).length;

            // 진행률 계산
            const progressPercent = wordCount > 0
              ? Math.round((memorizedCount / wordCount) * 100)
              : 0;

            return {
              id: wb.id,
              name: wb.name,
              wordCount,
              icon: '📖',
              lastStudied: '—',
              progressPercent,
              order: (wb as any).display_order || 0,
              groupId: (wb as any).group_id || undefined,
            };
          } catch (err) {
            console.error(`Failed to load words for wordbook ${wb.id}`, err);
            return {
              id: wb.id,
              name: wb.name,
              wordCount: 0,
              icon: '📖',
              lastStudied: '—',
              progressPercent: 0,
              order: (wb as any).display_order || 0,
              groupId: (wb as any).group_id || undefined,
            };
          }
        })
      );

      // AsyncStorage에서 메타데이터 불러오기 (groupId, order)
      try {
        const metadataString = await AsyncStorage.getItem('wordbook_metadata');
        if (metadataString) {
          const metadata = JSON.parse(metadataString);
          // 메타데이터를 mapped에 적용
          const withMetadata = mapped.map(wb => {
            const meta = metadata.find((m: any) => m.id === wb.id);
            return {
              ...wb,
              groupId: meta?.groupId,
              order: meta?.order ?? wb.order
            };
          });
          setWordbooks(withMetadata);
          console.log('✅ 단어장 메타데이터 적용 완료');
        } else {
          setWordbooks(mapped);
        }
      } catch (err) {
        console.error('메타데이터 로드 실패:', err);
        setWordbooks(mapped);
      }

      // AsyncStorage에서 그룹 정보 불러오기
      try {
        const groupsData = await AsyncStorage.getItem('wordbook_groups');
        if (groupsData) {
          const savedGroups: WordbookGroup[] = JSON.parse(groupsData);
          setGroups(savedGroups);
          console.log('✅ 그룹 정보 로드 완료:', savedGroups.length + '개');
        } else {
          setGroups([]);
        }
      } catch (err) {
        console.error('그룹 정보 로드 실패:', err);
        setGroups([]);
      }
    } catch (e) {
      console.error('Failed to load wordbooks', e);
    }
  }, []);

  // 초기 로드는 WordbookScreen의 useFocusEffect에서 처리

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

  const confirmCreateGroup = useCallback(async () => {
    if (newGroupName.trim() && selectedWordbooks.length >= 2) {
      const newGroup: WordbookGroup = {
        id: Date.now(),
        name: newGroupName.trim(),
        wordbookIds: selectedWordbooks,
        isExpanded: false,
      };

      // 그룹 상태 업데이트
      setGroups(prev => {
        const updated = [...prev, newGroup];
        // AsyncStorage에 저장
        AsyncStorage.setItem('wordbook_groups', JSON.stringify(updated))
          .then(() => console.log('✅ 그룹 정보 저장 완료'))
          .catch(err => console.error('❌ 그룹 정보 저장 실패:', err));
        return updated;
      });

      // 단어장에 groupId 설정 및 메타데이터 저장
      setWordbooks(prev => {
        const updated = prev.map(wb =>
          selectedWordbooks.includes(wb.id)
            ? { ...wb, groupId: newGroup.id }
            : wb
        );

        // 단어장 메타데이터 저장
        const metadata = updated.map(wb => ({
          id: wb.id,
          groupId: wb.groupId,
          order: wb.order
        }));
        AsyncStorage.setItem('wordbook_metadata', JSON.stringify(metadata))
          .then(() => console.log('✅ 단어장 메타데이터 저장 완료'))
          .catch(err => console.error('❌ 단어장 메타데이터 저장 실패:', err));

        return updated;
      });

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
    setGroups(prev => {
      const updated = prev.map(group =>
        group.id === groupId
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      );
      // AsyncStorage에 저장
      AsyncStorage.setItem('wordbook_groups', JSON.stringify(updated))
        .catch(err => console.error('❌ 그룹 정보 저장 실패:', err));
      return updated;
    });
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
            setWordbooks(prev => {
              const updated = prev.map(wb =>
                wb.groupId === groupId
                  ? { ...wb, groupId: undefined }
                  : wb
              );

              // 메타데이터 저장
              const metadata = updated.map(wb => ({
                id: wb.id,
                groupId: wb.groupId,
                order: wb.order
              }));
              AsyncStorage.setItem('wordbook_metadata', JSON.stringify(metadata))
                .catch(err => console.error('❌ 단어장 메타데이터 저장 실패:', err));

              return updated;
            });

            setGroups(prev => {
              const updated = prev.filter(g => g.id !== groupId);
              // AsyncStorage에 저장
              AsyncStorage.setItem('wordbook_groups', JSON.stringify(updated))
                .then(() => console.log('✅ 그룹 해제 완료'))
                .catch(err => console.error('❌ 그룹 정보 저장 실패:', err));
              return updated;
            });
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
