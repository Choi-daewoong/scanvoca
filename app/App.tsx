import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Alert } from 'react-native';

// Database
import { databaseService } from './src/database/database';

// Screens (placeholder)
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import WordbookScreen from './src/screens/WordbookScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setIsLoading(true);

      // 데이터베이스 초기화
      await databaseService.initialize();
      setIsDbInitialized(true);

      console.log('App initialized successfully');
    } catch (error) {
      console.error('App initialization failed:', error);
      Alert.alert('초기화 오류', '앱 초기화 중 오류가 발생했습니다. 앱을 다시 시작해 주세요.', [
        { text: '확인' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>앱을 초기화하는 중...</Text>
        <Text style={styles.loadingSubText}>데이터베이스를 준비하고 있습니다</Text>
      </View>
    );
  }

  if (!isDbInitialized) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>데이터베이스 초기화 실패</Text>
        <Text style={styles.errorSubText}>앱을 다시 시작해 주세요</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
          headerStyle: {
            backgroundColor: '#F8F8F8',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: '홈',
            headerTitle: 'AI 영단어장',
          }}
        />
        <Tab.Screen
          name="Camera"
          component={CameraScreen}
          options={{
            tabBarLabel: '스캔',
            headerTitle: '단어 스캔',
          }}
        />
        <Tab.Screen
          name="Wordbook"
          component={WordbookScreen}
          options={{
            tabBarLabel: '단어장',
            headerTitle: '내 단어장',
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: '설정',
            headerTitle: '설정',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  loadingSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
