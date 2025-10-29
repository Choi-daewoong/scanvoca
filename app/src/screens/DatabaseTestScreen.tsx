import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
// NOTE: 이 화면은 더 이상 사용되지 않습니다 (Database 제거됨)
import { WordWithMeaning } from '../types/types';

export default function DatabaseTestScreen() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [sampleWords, setSampleWords] = useState<WordWithMeaning[]>([]);

  // 데이터베이스 초기화
  const initDatabase = async () => {
    setLoading(true);
    try {setIsInitialized(true);
      addTestResult('✅ Database initialized successfully');
    } catch (error) {
      addTestResult(`❌ Database initialization failed: ${error}`);
    }
    setLoading(false);
  };

  // 테스트 결과 추가
  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // 단어 검색 테스트
  const testWordSearch = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'Database not initialized');
      return;
    }

    setLoading(true);
    try {
      // "hello" 단어 검색
      const results =addTestResult(`🔍 Search "hello": Found ${results.length} results`);

      if (results.length > 0) {
        setSampleWords(results);
        addTestResult(`📝 Sample: ${results[0].word} - ${results[0].meanings[0]?.korean_meaning || 'No meaning'}`);
      }
    } catch (error) {
      addTestResult(`❌ Search failed: ${error}`);
    }
    setLoading(false);
  };

  // 정확한 단어 찾기 테스트
  const testExactWordFind = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'Database not initialized');
      return;
    }

    setLoading(true);
    try {
      // Database service removed - using temporary data
      const word = null;
      if (word) {
        addTestResult(`🎯 Exact "apple": ${word.word} - ${word.meanings[0]?.korean_meaning || 'No meaning'}`);
      } else {
        addTestResult(`🎯 Exact "apple": Not found`);
      }
    } catch (error) {
      addTestResult(`❌ Exact search failed: ${error}`);
    }
    setLoading(false);
  };

  // 단어장 조회 테스트
  const testWordbooks = async () => {
    if (!isInitialized) {
      Alert.alert('Error', 'Database not initialized');
      return;
    }

    setLoading(true);
    try {
      const wordbooks =addTestResult(`📚 Wordbooks: Found ${wordbooks.length} wordbooks`);
    } catch (error) {
      addTestResult(`❌ Wordbook query failed: ${error}`);
    }
    setLoading(false);
  };

  // 초기화
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Database Test Screen</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isInitialized ? '✅ Connected' : '❌ Not Connected'}
        </Text>
        {loading && <Text style={styles.loadingText}>Loading...</Text>}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testWordSearch}>
          <Text style={styles.buttonText}>Search "hello"</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testExactWordFind}>
          <Text style={styles.buttonText}>Find "apple"</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testWordbooks}>
          <Text style={styles.buttonText}>List Wordbooks</Text>
        </TouchableOpacity>
      </View>

      {sampleWords.length > 0 && (
        <View style={styles.sampleContainer}>
          <Text style={styles.sampleTitle}>Sample Words:</Text>
          {sampleWords.map((word, index) => (
            <View key={index} style={styles.wordItem}>
              <Text style={styles.wordText}>{word.word}</Text>
              <Text style={styles.meaningText}>
                {word.meanings[0]?.korean_meaning || 'No meaning'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView style={styles.logContainer}>
        <Text style={styles.logTitle}>Test Log:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.logText}>
            {result}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4F46E5',
    padding: 10,
    borderRadius: 8,
    margin: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  sampleContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  sampleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  wordItem: {
    marginBottom: 8,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
  },
  meaningText: {
    fontSize: 14,
    color: '#666',
  },
  logContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});