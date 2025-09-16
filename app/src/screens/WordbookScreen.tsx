import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { databaseService } from '../database/database';
import { Wordbook } from '../types/types';

const WordbookScreen: React.FC = () => {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWordbooks();
  }, []);

  const loadWordbooks = async () => {
    try {
      setLoading(true);
      const data = await databaseService.getAllWordbooks();
      setWordbooks(data);
    } catch (error) {
      console.error('Failed to load wordbooks:', error);
      Alert.alert('오류', '단어장을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWordbook = () => {
    Alert.alert('새 단어장', '새 단어장 생성 기능은 아직 구현되지 않았습니다.', [{ text: '확인' }]);
  };

  const handleWordbookPress = (wordbook: Wordbook) => {
    Alert.alert(
      wordbook.name,
      `단어장 상세보기 기능은 아직 구현되지 않았습니다.\n\n설명: ${wordbook.description || '없음'}`,
      [{ text: '확인' }]
    );
  };

  const renderWordbookItem = ({ item }: { item: Wordbook }) => (
    <TouchableOpacity
      style={[styles.wordbookCard, item.is_default && styles.defaultWordbook]}
      onPress={() => handleWordbookPress(item)}
    >
      <View style={styles.wordbookHeader}>
        <Text style={styles.wordbookName}>{item.name}</Text>
        {item.is_default && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>기본</Text>
          </View>
        )}
      </View>

      <Text style={styles.wordbookDescription}>{item.description || '설명이 없습니다'}</Text>

      <View style={styles.wordbookFooter}>
        <Text style={styles.wordbookWordCount}>단어 수: 0개</Text>
        <Text style={styles.wordbookDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>단어장이 없습니다</Text>
      <Text style={styles.emptyDescription}>
        카메라로 단어를 스캔하거나{'\n'}
        직접 단어장을 만들어보세요!
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={handleCreateWordbook}>
        <Text style={styles.createButtonText}>+ 새 단어장 만들기</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>단어장을 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {wordbooks.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>내 단어장 ({wordbooks.length}개)</Text>
            <TouchableOpacity style={styles.headerButton} onPress={handleCreateWordbook}>
              <Text style={styles.headerButtonText}>+ 새로 만들기</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={wordbooks}
            renderItem={renderWordbookItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  wordbookCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  defaultWordbook: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  wordbookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordbookName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  defaultBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  defaultBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  wordbookDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  wordbookFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordbookWordCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  wordbookDate: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default WordbookScreen;
